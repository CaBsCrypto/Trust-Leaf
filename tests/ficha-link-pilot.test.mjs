import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { test } from 'node:test';
import { executeFichaLinkPilot, fichaPilotConfig } from '../api/_lib/ficha-link-pilot.ts';
import { pdfCommitment } from '../api/_lib/ficha-link-proof.ts';
import { createPrivyIdentityVerifier } from '../api/_lib/privy-identity.ts';
import { operationsDatabase } from './sql/operations-db.mjs';

test('commitment matches the cross-portal v1 formula and depends on each exact byte', () => {
  const document = Buffer.from('synthetic PDF bytes');
  const nonce = Buffer.alloc(32, 9);
  const hash = createHash('sha256').update(document).digest();
  const expected = createHash('sha256').update(Buffer.concat([Buffer.from('TrustLeaf/ClinicalLink/PDF/v1\0'), nonce, hash])).digest('hex');
  assert.equal(pdfCommitment(document, nonce), expected);
  assert.notEqual(pdfCommitment(Buffer.from('synthetic PDF byteS'), nonce), expected);
  assert.notEqual(pdfCommitment(document, Buffer.alloc(32, 8)), expected);
});

test('shared onboarding, clinician confirmation and rebind preserve consent, contract and actor continuity', async () => {
  const { db, subjects, actors } = await operationsDatabase({ roles: {
    admin: 'admin', patient: 'patient', otherPatient: 'patient', doctor: 'doctor', otherDoctor: 'doctor',
  } });
  try {
    const appId = 'shared-app-test';
    const clientId = 'cannabis-client-test';
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const env = {
      TRUSTLEAF_FICHA_LINK_PILOT_ENABLED: 'true', TRUSTLEAF_FICHA_LINK_MODE: 'synthetic', STELLAR_NETWORK: 'testnet',
      VERCEL_ENV: 'preview', TRUSTLEAF_FICHA_LINK_ORIGIN: 'https://ficha-demo-example.vercel.app',
      SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', TRUSTLEAF_FICHA_LINK_SUPABASE_REF: 'abcdefghijklmnopqrst',
      SUPABASE_SECRET_KEY: 'test-store-key', TRUSTLEAF_FICHA_LINK_SERVICE_TOKEN: `tl_clp_${'42'.repeat(32)}`,
      TRUSTLEAF_FICHA_LINK_SHARED_ENROLLMENT_ENABLED: 'true', TRUSTLEAF_SHARED_PRIVY_APP_ID: appId,
      TRUSTLEAF_SHARED_PRIVY_CLIENT_ID: clientId, TRUSTLEAF_SHARED_PRIVY_VERIFICATION_KEY: keys.publicKey.export({ type: 'spki', format: 'pem' }),
    };
    const workflowRef = randomUUID();
    const bookingRef = randomUUID();
    const consultationRef = randomUUID();
    const slotRef = randomUUID();
    const partnerPatientRef = randomUUID();
    const linkRef = randomUUID();
    env.TRUSTLEAF_FICHA_LINK_CONSULTATIONS = JSON.stringify({ [bookingRef]: consultationRef });
    const now = Math.floor(Date.now() / 1000);
    const jwt = (subject, claims = {}) => {
      const input = [ { alg: 'ES256', typ: 'JWT' }, { aud: appId, iss: 'privy.io', sub: subject, iat: now,
        exp: now + 300, ...claims } ].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
      return `${input}.${sign('sha256', Buffer.from(input), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    };
    const access = (client = clientId, subject = subjects.patient) => jwt(subject, { app_client_id: client, sid: 'session-credential' });
    const doctorAccess = access(clientId, subjects.doctor);
    let grant = false;
    const enrollmentConsents = [];
    const events = [];
    let intent;
    let state = 'pending';
    let corrupted = false;
    const contractId = 'CDUN6FXFX6OYLP6DS3W7RC72GBVMS3TFJ7LFTB3LGVPF6PWMR6FCZSYE';
    const fetcher = async (target, init) => {
      const url = new URL(target);
      const headers = new Headers(init.headers);
      const body = init.body ? JSON.parse(init.body) : null;
      if (url.origin === env.SUPABASE_URL) {
        assert.equal(headers.get('privy-access-token'), null);
        if (url.pathname.endsWith('/trustleaf_resolve_privy_actor')) {
          return Response.json((await db.query('select * from public.trustleaf_resolve_privy_actor($1)', [body.subject])).rows);
        }
        const rpc = url.pathname.split('/').pop();
        assert.ok(['trustleaf_ficha_link_pilot', 'trustleaf_ficha_shared_pilot'].includes(rpc));
        try {
          const { rows } = await db.query(`select public.${rpc}($1,$2,$3) as data`, [body.p_subject, body.p_action, body.p_data]);
          return Response.json(rows[0].data);
        } catch (error) { return Response.json({ code: error.code }, { status: 400 }); }
      }
      assert.equal(url.origin, env.TRUSTLEAF_FICHA_LINK_ORIGIN);
      assert.equal(headers.get('authorization'), `Bearer ${env.TRUSTLEAF_FICHA_LINK_SERVICE_TOKEN}`);
      if (url.pathname.endsWith('/patient-enrollments')) {
        assert.ok(headers.get('privy-access-token'));
        assert.deepEqual(Object.keys(body), ['authorizePrescriptionLinks']);
        enrollmentConsents.push(body.authorizePrescriptionLinks);
        grant ||= body.authorizePrescriptionLinks;
        return Response.json({ status: 'active', partnerPatientRef: grant ? partnerPatientRef : null,
          associationStatus: grant ? 'active' : 'not_authorized' });
      }
      if (url.pathname.endsWith('/partner-prescriptions')) {
        assert.equal(headers.get('privy-access-token'), doctorAccess);
        assert.deepEqual(Object.keys(body).sort(), ['commitment', 'consultationRef', 'documentId', 'partnerPatientRef', 'version']);
        assert.equal(body.consultationRef, consultationRef);
        assert.equal(body.partnerPatientRef, partnerPatientRef);
        intent = body;
      } else assert.equal(headers.get('privy-access-token'), null);
      if (url.pathname.includes('/partner-prescriptions')) {
        return Response.json({ id: workflowRef, state, consultationRef, documentId: intent.documentId, version: 1,
          commitment: corrupted ? '00'.repeat(32) : intent.commitment, network: 'testnet', contractId,
          transactionHash: state === 'confirmed' ? '32'.repeat(32) : null, rxId: state === 'confirmed' ? '679' : null });
      }
      if (url.pathname.endsWith('/clinical-link-events')) {
        events.push(body);
        return Response.json({ eventId: body.eventId, linkRef, revision: body.revision, result: 'applied' }, { status: 202 });
      }
      assert.equal(url.pathname, `/api/v1/clinical-links/${linkRef}/proof`);
      return Response.json({ linkRef, revision: 1, integrityStatus: 'verified', commitment: intent.commitment });
    };
    const verify = createPrivyIdentityVerifier(env);
    const call = (role, action, data = {}, accessToken) => executeFichaLinkPilot({
      token: jwt(subjects[role], { cr: String(now), linked_accounts: '[]' }), action, data, accessToken, env, verifier: verify, fetcher,
    });

    await db.exec('reset role');
    for (const key of ['patient', 'doctor']) await db.query('insert into trustleaf_private.pilot_participants(actor_ref) values($1)', [actors[key]]);
    await db.query(`insert into trustleaf_private.availability_slots(slot_ref,doctor_actor_ref,starts_at,ends_at,state)
      values($1,$2,now(),now()+interval '30 minutes','booked')`, [slotRef, actors.doctor]);
    await db.query('insert into trustleaf_private.appointment_bookings(booking_ref,slot_ref,patient_actor_ref) values($1,$2,$3)', [bookingRef, slotRef, actors.patient]);
    await db.query('insert into trustleaf_private.pilot_encounters(booking_ref,doctor_ref,patient_ref) values($1,$2,$3)', [bookingRef, actors.doctor, actors.patient]);
    await db.exec('set role service_role');

    await assert.rejects(() => call('patient', 'enroll-account', { authorizePrescriptionLinks: true }, access('wrong-client')), { statusCode: 401 });
    await assert.rejects(() => call('patient', 'enroll-account', { authorizePrescriptionLinks: true }, access(clientId, subjects.otherPatient)), { status: 403 });
    const activation = await call('patient', 'enroll-account', { authorizePrescriptionLinks: false }, access());
    assert.deepEqual(activation, { status: 'active', associationStatus: 'not_authorized', accountUrl: `${env.TRUSTLEAF_FICHA_LINK_ORIGIN}/patient?tab=perfil` });
    assert.deepEqual((await call('doctor', 'snapshot')).consultations, []);
    await assert.rejects(() => call('doctor', 'issue', { bookingRef }, doctorAccess), { status: 404 });
    assert.equal((await call('patient', 'enroll-account', { authorizePrescriptionLinks: true }, access())).associationStatus, 'active');
    assert.equal((await call('patient', 'enroll-account', { authorizePrescriptionLinks: false }, access())).associationStatus, 'active');
    assert.deepEqual(enrollmentConsents, [false, true, false]);
    assert.deepEqual((await call('doctor', 'snapshot')).consultations, [bookingRef]);
    await assert.rejects(() => call('doctor', 'issue', { bookingRef }), { status: 401 });
    await assert.rejects(() => call('doctor', 'issue', { bookingRef }, access(clientId, subjects.patient)), { status: 403 });
    await assert.rejects(() => call('otherDoctor', 'issue', { bookingRef }, access(clientId, subjects.otherDoctor)), { status: 404 });
    const pending = await call('doctor', 'issue', { bookingRef }, doctorAccess);
    assert.equal(pending.clinicalStatus, 'pending');
    assert.equal(intent.documentId, pending.resourceRef);
    assert.deepEqual(events, []);
    const document = { resourceRef: pending.resourceRef };
    await assert.rejects(() => call('patient', 'document', document), { status: 404 });
    state = 'confirmed';
    corrupted = true;
    await assert.rejects(() => call('doctor', 'resend', document), { code: 'FICHA_RESPONSE_INVALID' });
    assert.deepEqual(events, []);
    corrupted = false;
    const confirmed = await call('doctor', 'resend', document);
    assert.deepEqual(confirmed, { resourceRef: pending.resourceRef, clinicalStatus: 'active', deliveryStatus: 'accepted' });
    assert.equal(events.length, 1);
    assert.equal(events[0].commitment, intent.commitment);
    await assert.rejects(() => call('otherPatient', 'document', document), { status: 404 });
    assert.equal((await call('patient', 'document', document)).integrityStatus, 'verified');

    const newSubject = 'did:privy:shared-rebound-patient-1';
    const rebind = (previous, next) => db.query('select public.trustleaf_ficha_rebind_privy_actor($1,$2) as actor', [previous, next]);
    await assert.rejects(() => rebind(subjects.patient, subjects.otherPatient), { code: 'PT409' });
    assert.equal((await rebind(subjects.patient, newSubject)).rows[0].actor, actors.patient);
    assert.equal((await rebind(subjects.patient, newSubject)).rows[0].actor, actors.patient);
    assert.equal((await db.query('select * from public.trustleaf_resolve_privy_actor($1)', [subjects.patient])).rows.length, 0);
    assert.equal((await db.query('select * from public.trustleaf_resolve_privy_actor($1)', [newSubject])).rows[0].role, 'patient');
    subjects.patient = newSubject;
    assert.equal((await call('patient', 'document', document)).integrityStatus, 'verified');
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::integer as count from trustleaf_private.audit_events where action_code='actor.identity.rebound' and actor_ref=$1`, [actors.patient])).rows[0].count, 1);
  } finally { await db.close(); }
});

test('authenticated pilot keeps immutable PDF, rejects other patients, and resends durable events', async () => {
  const { db, subjects, actors } = await operationsDatabase({ roles: { admin: 'admin', patient: 'patient', otherPatient: 'patient', doctor: 'doctor' } });
  try {
    const privileges = (await db.query(`select
      has_function_privilege('anon','public.trustleaf_ficha_link_pilot(text,text,jsonb)','execute') as anon,
      has_function_privilege('authenticated','public.trustleaf_ficha_link_pilot(text,text,jsonb)','execute') as authenticated,
      has_function_privilege('service_role','public.trustleaf_ficha_link_pilot(text,text,jsonb)','execute') as service_role,
      has_table_privilege('service_role','trustleaf_private.ficha_pilot_prescriptions','select') as reads_table`)).rows[0];
    assert.deepEqual(privileges, { anon: false, authenticated: false, service_role: true, reads_table: false });

    const env = {
      TRUSTLEAF_FICHA_LINK_PILOT_ENABLED: 'true', TRUSTLEAF_FICHA_LINK_MODE: 'synthetic', STELLAR_NETWORK: 'testnet',
      VERCEL_ENV: 'preview', TRUSTLEAF_FICHA_LINK_ORIGIN: 'https://ficha-pilot-example.vercel.app',
      SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', TRUSTLEAF_FICHA_LINK_SUPABASE_REF: 'abcdefghijklmnopqrst',
      SUPABASE_SECRET_KEY: 'test-store-key', TRUSTLEAF_FICHA_LINK_SERVICE_TOKEN: `tl_clp_${'21'.repeat(32)}`,
      TRUSTLEAF_FICHA_LINK_ACTOR_KEY: '13'.repeat(32), PRIVY_APP_ID: 'synthetic-app',
      TRUSTLEAF_FICHA_LINK_DOCTOR: actors.doctor, TRUSTLEAF_FICHA_LINK_PATIENT: actors.patient,
      TRUSTLEAF_FICHA_LINK_CONTROL_PATIENT: actors.otherPatient,
    };
    const bindingId = randomUUID();
    const linkRef = randomUUID();
    const partnerPatientRef = randomUUID();
    const challenge = 'X'.repeat(43);
    const allDeliveries = [];
    let actorReference;
    let grant = 'claimed';
    let commitment;
    let available = false;
    let proof = 'pending';
    let expectedOidc = null;
    let oidcReads = 0;
    const oidcToken = 'test-only-vercel-oidc-token';
    const readOidcToken = async () => { oidcReads++; return oidcToken; };
    const fetcher = async (target, init) => {
      const url = new URL(target);
      if (url.origin === env.SUPABASE_URL) {
        assert.equal(new Headers(init.headers).get('apikey'), env.SUPABASE_SECRET_KEY);
        assert.equal(new Headers(init.headers).get('x-vercel-trusted-oidc-idp-token'), null);
        const body = JSON.parse(init.body);
        if (url.pathname.endsWith('/trustleaf_resolve_privy_actor')) {
          return Response.json((await db.query('select * from public.trustleaf_resolve_privy_actor($1)', [body.subject])).rows);
        }
        assert.equal(url.pathname, '/rest/v1/rpc/trustleaf_ficha_link_pilot');
        try {
          const { rows } = await db.query('select public.trustleaf_ficha_link_pilot($1,$2,$3) as data', [body.p_subject, body.p_action, body.p_data]);
          return Response.json(rows[0].data);
        } catch (error) { return Response.json({ code: error.code }, { status: 400 }); }
      }
      assert.equal(url.origin, env.TRUSTLEAF_FICHA_LINK_ORIGIN);
      assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${env.TRUSTLEAF_FICHA_LINK_SERVICE_TOKEN}`);
      assert.equal(new Headers(init.headers).get('x-vercel-trusted-oidc-idp-token'), expectedOidc);
      assert.equal(init.redirect, 'error');
      const body = init.body ? JSON.parse(init.body) : null;
      if (url.pathname.endsWith('/bindings/claim')) {
        assert.deepEqual(Object.keys(body).sort(), ['actorRef', 'code']);
        assert.equal(body.code, challenge);
        assert.match(body.actorRef, /^[a-f0-9]{64}$/);
        actorReference = body.actorRef;
        return Response.json({ bindingId, confirmationCode: '12345678' });
      }
      if (url.pathname.endsWith('/bindings/status')) {
        assert.deepEqual(body, { bindingId, actorRef: actorReference });
        return Response.json({ status: grant, ...(grant === 'active' ? { partnerPatientRef } : {}) });
      }
      if (url.pathname.endsWith('/clinical-link-events')) {
        allDeliveries.push(body);
        if (!available) return Response.json({}, { status: 503 });
        if (body.eventType === 'clinical-link.issued') commitment = body.commitment;
        return Response.json({ eventId: body.eventId, linkRef, revision: body.revision, result: 'applied' }, { status: 202 });
      }
      assert.equal(url.pathname, `/api/v1/clinical-links/${linkRef}/proof`);
      assert.equal(url.searchParams.get('revision'), '1');
      return Response.json({ linkRef, revision: 1, integrityStatus: proof, commitment });
    };
    const verifier = { verify: async token => ({ subject: subjects[token], emails: [] }) };
    const call = (token, action, data = {}, overrides = {}) => executeFichaLinkPilot({
      token, action, data, env: { ...env, ...overrides }, verifier, fetcher, readOidcToken,
    });

    assert.throws(() => fichaPilotConfig({ ...env, VERCEL_ENV: 'production' }), { status: 404 });
    assert.throws(() => fichaPilotConfig({ ...env, SUPABASE_URL: 'https://another.supabase.co' }), { status: 503 });
    assert.throws(() => fichaPilotConfig({ ...env, TRUSTLEAF_FICHA_LINK_ORIGIN: 'https://www.trustleaf.org' }), { status: 503 });
    const oidcOptIn = { TRUSTLEAF_FICHA_LINK_VERCEL_TRUSTED_SOURCE: 'true' };
    const hostedOidc = { ...oidcOptIn, VERCEL: '1' };
    assert.throws(() => fichaPilotConfig({ ...env, ...hostedOidc, TRUSTLEAF_FICHA_LINK_ORIGIN: 'https://ficha.example.invalid' }), { status: 503 });
    expectedOidc = oidcToken;
    assert.deepEqual(await call('patient', 'claim', { code: challenge }, hostedOidc), { confirmationCode: '12345678' });
    expectedOidc = null;
    assert.deepEqual(await call('patient', 'binding-status', {}, oidcOptIn), { status: 'claimed' });
    assert.equal(oidcReads, 1);
    await assert.rejects(() => executeFichaLinkPilot({
      token: 'patient', action: 'binding-status', data: {}, env: { ...env, ...hostedOidc }, verifier, fetcher,
      readOidcToken: async () => { throw new Error('test fixture without a workload token'); },
    }), { code: 'FICHA_TRUSTED_SOURCE_UNAVAILABLE' });
    await assert.rejects(() => call('doctor', 'issue'), { code: 'PILOT_BINDING_INACTIVE' });
    await assert.rejects(() => call('patient', 'issue'), { statusCode: 403 });
    grant = 'active';
    const initial = await call('doctor', 'issue');
    assert.equal(initial.deliveryStatus, 'pending');
    available = true;
    const replay = await call('doctor', 'issue');
    assert.equal(replay.resourceRef, initial.resourceRef);
    assert.equal(replay.deliveryStatus, 'accepted');
    assert.deepEqual(allDeliveries[0], allDeliveries[1]);
    assert.equal(allDeliveries[1].partnerPatientRef, partnerPatientRef);
    assert.equal(allDeliveries[1].documentRevision, 1);
    assert.equal(allDeliveries[1].category, 'cannabis.prescription');
    assert.match(commitment, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(allDeliveries[1]).sort(), ['category', 'clinicalStatus', 'commitment', 'documentRevision', 'eventId',
      'eventType', 'occurredAt', 'partnerPatientRef', 'resourceRef', 'revision', 'schemaVersion']);

    const data = { resourceRef: initial.resourceRef };
    await assert.rejects(() => call('otherPatient', 'document', data), { status: 404 });
    const pending = await call('patient', 'document', data);
    assert.equal(pending.integrityStatus, 'pending');
    assert.equal(Buffer.from(pending.bytes.subarray(0, 5)).toString(), '%PDF-');
    proof = 'verified';
    const verified = await call('patient', 'document', data);
    assert.equal(verified.integrityStatus, 'verified');
    assert.deepEqual(verified.bytes, pending.bytes);

    const revoked = await call('doctor', 'revoke', data);
    assert.equal(revoked.clinicalStatus, 'revoked');
    assert.equal(revoked.deliveryStatus, 'accepted');
    assert.equal(allDeliveries[2].clinicalStatus, 'revoked');
    assert.equal(allDeliveries[2].documentRevision, 1);
    assert.equal(allDeliveries[2].revision, 2);
    assert.equal('commitment' in allDeliveries[2], false);
    await call('doctor', 'resend', data);
    assert.deepEqual(allDeliveries[3], allDeliveries[1]);
    assert.deepEqual(allDeliveries[4], allDeliveries[2]);
    const revokedEvidence = await call('patient', 'document', data);
    assert.equal(revokedEvidence.clinicalStatus, 'revoked');
    assert.equal(revokedEvidence.integrityStatus, 'verified');
    assert.deepEqual(revokedEvidence.bytes, verified.bytes);
    commitment = 'FF'.toLowerCase().repeat(32);
    await assert.rejects(() => call('patient', 'document', data), { code: 'PDF_INTEGRITY_MISMATCH' });
    proof = 'unavailable';
    assert.equal((await call('patient', 'document', data)).integrityStatus, 'unavailable');

    // Corrupt bytes in this disposable test database, then prove the viewer will not serve them.
    await db.exec('reset role');
    await db.query(`update trustleaf_private.ficha_pilot_prescriptions set pdf_base64 = $1 where resource_ref = $2`,
      [Buffer.from('altered synthetic bytes for unit test fixture').toString('base64'), initial.resourceRef]);
    await db.exec('set role service_role');
    await assert.rejects(() => call('patient', 'document', data), { code: 'PDF_INTEGRITY_MISMATCH' });
  } finally { await db.close(); }
});
