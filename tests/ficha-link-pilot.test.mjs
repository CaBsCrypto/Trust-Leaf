import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { executeFichaLinkPilot, fichaPilotConfig } from '../api/_lib/ficha-link-pilot.ts';
import { pdfCommitment } from '../api/_lib/ficha-link-proof.ts';
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
