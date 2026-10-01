import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { operationsDatabase } from './operations-db.mjs';
import { joinTeam } from './team-fixtures.mjs';

const { values: { baseline } } = parseArgs({ options: { baseline: { type: 'boolean', default: false } } });
// Last tracked migration at origin/main 803937757d39b448279be82951b6300cf1a431b3.
const baselineThrough = '20260922010000_dispensary_onboarding.sql';

async function baselineDatabase() {
  // The shared fixture has no migration cutoff option; keep its scaffold local for red runs.
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    const migrations = new URL('../../supabase/migrations/', import.meta.url);
    const names = (await readdir(migrations)).filter(name => name.endsWith('.sql')
      && name <= baselineThrough && name !== '20260906120000_monthly_dispensing_quota.sql').sort();
    assert.ok(names.includes(baselineThrough), 'baseline migration cutoff must exist');
    for (const name of names) await db.exec(await readFile(new URL(name, migrations), 'utf8'));
    const subjects = Object.fromEntries(['admin', 'doctor', 'patient', 'dispensary', 'dispensaryB',
      'dispensaryRecovery', 'operator', 'otherDoctor', 'otherPatient'].map(key => [key, `did:privy:pilot-fixture-${key}`]));
    const actors = {};
    actors.admin = (await db.query('select * from public.trustleaf_bootstrap_first_privy_admin($1)',
      [subjects.admin])).rows[0].actor_ref;
    for (const key of Object.keys(subjects).filter(key => key !== 'admin')) {
      const role = key.includes('Doctor') ? 'doctor' : key.includes('Patient') ? 'patient'
        : key.startsWith('dispensary') || key === 'operator' ? 'dispensary' : key;
      const row = (await db.query('select * from public.trustleaf_enroll_privy_actor($1,$2)', [subjects[key], role])).rows[0];
      actors[key] = row.actor_ref;
      if (role !== 'patient') await db.query('select * from public.trustleaf_review_pending_privy_actor($1,$2,$3,$4,$5)',
        [subjects.admin, row.actor_ref, row.version ?? 1, 'approve', new Uint8Array(32).fill(Object.keys(actors).length)]);
    }
    await db.exec('set role service_role');
    const call = async (key, action, input = {}) => (await db.query(
      'select public.trustleaf_operations_pilot($1,$2,$3) as data', [subjects[key], action, input])).rows[0].data;
    const agenda = async (key, action, input) => (await db.query(
      'select public.trustleaf_privy_agenda($1,$2,$3) as data', [subjects[key], action, input])).rows[0].data;
    return { db, subjects, actors, call, agenda };
  } catch (error) {
    await db.close();
    throw error;
  }
}

const sorted = values => [...values].sort();
const refs = (items, field) => sorted(items.map(item => item[field]));
const grantKey = (treatment, organization) => `${treatment}:${organization}`;
const projection = snapshot => ({
  treatments: refs(snapshot.treatments, 'treatment_ref'),
  grants: sorted(snapshot.grants.map(grant => grantKey(grant.treatment_ref, grant.organization_ref))),
  patientProfiles: refs(snapshot.patientProfiles, 'patient_ref'),
  deliveries: refs(snapshot.deliveries, 'delivery_ref'),
});
const withoutClock = ({ asOf, ...snapshot }) => snapshot;
const identifier = name => `"${name.replaceAll('"', '""')}"`;
const previousFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network disabled in shared-patient-read regression'); };
let db;
let passed = 0;
const failures = [];

try {
  const fixture = await (baseline ? baselineDatabase() : operationsDatabase());
  db = fixture.db;
  const { subjects, actors, call, agenda } = fixture;
  const mutate = (key, action, input = {}) => call(key, action, { ...input, operationId: randomUUID() });
  const forbidden = promise => assert.rejects(promise, { code: '42501' });
  async function owner(sql, args = []) {
    await db.exec('reset role');
    try { return await db.query(sql, args); }
    finally { await db.exec('set role service_role'); }
  }
  async function snapshot(key, input = {}) {
    const first = await call(key, 'snapshot', input);
    const second = await call(key, 'snapshot', input);
    assert.deepEqual(withoutClock(second), withoutClock(first), `${key}: repeated read must be idempotent`);
    assert.equal(first.actorRef, actors[key], 'caller identity must come from the fixture subject');
    assert.equal(first.joined, true);
    assert.equal(first.synthetic, true);
    return first;
  }
  const tables = (await owner(`select tablename from pg_catalog.pg_tables
    where schemaname='trustleaf_private' order by tablename`)).rows.map(row => row.tablename);
  for (const table of ['pilot_audit', 'pilot_operations']) assert.ok(tables.includes(table));
  async function businessRows() {
    const result = {};
    for (const table of tables) {
      result[table] = (await owner(`select to_jsonb(t) as row from trustleaf_private.${identifier(table)} t`))
        .rows.map(row => row.row);
    }
    return result;
  }
  const fingerprint = rows => createHash('sha256').update(JSON.stringify(tables.map(table =>
    [table, sorted(rows[table].map(row => JSON.stringify(row)))]))).digest('hex');
  const businessFingerprint = async () => fingerprint(await businessRows());
  async function testCase(name, check) {
    try {
      await check();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`FAIL: ${name}: ${error.message.split('\n')[0]}`);
    }
  }
  const readOnlyCase = (name, check) => testCase(name, async () => {
    const before = await businessFingerprint();
    try { await check(); }
    finally { assert.equal(await businessFingerprint(), before, `${name}: reads/denials must not mutate business rows`); }
  });

  for (const key of Object.keys(subjects)) await mutate(key, 'join', { acceptSyntheticOnly: true });
  for (const key of ['patient', 'otherPatient']) await mutate(key, 'save-profile', {
    name: `Synthetic ${key}`, email: `${key.toLowerCase()}@example.test`, phone: '000000000', version: 0, syntheticOnly: true,
  });
  const organizationA = (await mutate('dispensary', 'create-organization', { name: 'Synthetic organization A' })).resourceRef;
  const organizationB = (await mutate('dispensaryB', 'create-organization', { name: 'Synthetic organization B' })).resourceRef;
  const organizationC = (await mutate('dispensaryRecovery', 'create-organization', { name: 'Synthetic organization C' })).resourceRef;
  await joinTeam(db, subjects.dispensaryB, subjects.operator);

  async function treatmentFor(patient, doctor, day) {
    const slotRef = randomUUID(), bookingRef = randomUUID();
    await agenda(doctor, 'publish', {
      slotRef, startsAt: new Date(Date.now() + day * 86400000).toISOString(),
      endsAt: new Date(Date.now() + day * 86400000 + 1800000).toISOString(), operationId: randomUUID(),
    });
    await agenda(patient, 'reserve', { slotRef, bookingRef, version: 1, operationId: randomUUID() });
    await mutate(doctor, 'start-encounter', { resourceRef: bookingRef });
    await mutate(doctor, 'save-note', { resourceRef: bookingRef, version: 1, note: `SYNTHETIC completed note for ${patient}` });
    await mutate(doctor, 'complete-encounter', {
      resourceRef: bookingRef, version: 2, issueTreatment: true, allowanceMg: 30000, periodCount: 3,
    });
    return (await snapshot(patient)).treatments[0].treatment_ref;
  }
  const treatment = await treatmentFor('patient', 'doctor', 1);
  const otherTreatment = await treatmentFor('otherPatient', 'otherDoctor', 2);
  for (const organizationRef of [organizationA, organizationB]) await mutate('patient', 'grant', { resourceRef: treatment, organizationRef });
  for (const organizationRef of [organizationA, organizationC]) await mutate('otherPatient', 'grant', { resourceRef: otherTreatment, organizationRef });
  const batches = {};
  for (const key of ['dispensary', 'dispensaryB', 'dispensaryRecovery']) batches[key] = (await mutate(key, 'receive-batch', {
    lotCode: `SYNTHETIC-${key}`, product: 'Synthetic product', sourceReference: 'SYNTHETIC-ONLY',
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), quantityMg: 100000,
  })).resourceRef;
  const dispense = async (key, resourceRef) => (await mutate(key, 'dispense', {
    resourceRef, batchRef: batches[key], quantityMg: 1000,
  })).resourceRef;
  const receiptA = await dispense('dispensary', treatment);
  const receiptB = await dispense('dispensaryB', treatment);
  const otherReceiptA = await dispense('dispensary', otherTreatment);
  const otherReceiptC = await dispense('dispensaryRecovery', otherTreatment);
  const recipients = ['dispensary', 'dispensaryB', 'operator', 'dispensaryRecovery'];
  const organizationFor = { dispensary: organizationA, dispensaryB: organizationB,
    operator: organizationB, dispensaryRecovery: organizationC };
  const initial = {};
  for (const key of [...recipients, 'patient', 'otherPatient', 'doctor', 'otherDoctor']) initial[key] = await snapshot(key);

  function expectedRecipients({ a = true, b = true } = {}) {
    const bProjection = {
      treatments: b ? [treatment] : [], grants: b ? [grantKey(treatment, organizationB)] : [],
      patientProfiles: b ? [actors.patient] : [], deliveries: sorted(b ? [receiptA, receiptB] : [receiptB]),
    };
    return {
      dispensary: {
        treatments: sorted(a ? [treatment, otherTreatment] : [otherTreatment]),
        grants: sorted(a ? [grantKey(treatment, organizationA), grantKey(otherTreatment, organizationA)] : [grantKey(otherTreatment, organizationA)]),
        patientProfiles: sorted(a ? [actors.patient, actors.otherPatient] : [actors.otherPatient]),
        deliveries: sorted(a ? [receiptA, receiptB, otherReceiptA, otherReceiptC] : [receiptA, otherReceiptA, otherReceiptC]),
      },
      dispensaryB: bProjection,
      operator: bProjection,
      dispensaryRecovery: {
        treatments: [otherTreatment], grants: [grantKey(otherTreatment, organizationC)],
        patientProfiles: [actors.otherPatient], deliveries: sorted([otherReceiptA, otherReceiptC]),
      },
    };
  }
  async function recipientProjections() {
    const actual = {};
    for (const key of recipients) {
      const current = await snapshot(key);
      actual[key] = projection(current);
      assert.equal(current.membership.organization_ref, organizationFor[key]);
      for (const field of ['notes', 'bookings', 'encounters']) assert.deepEqual(current[field], [], `${key}: no clinical history`);
      for (const row of current.treatments) {
        assert.equal(row.booking_ref, undefined, 'shared treatments have no booking references');
        assert.equal(row.doctor_ref, undefined, 'shared treatments retain the existing minimal projection');
      }
      for (const row of current.deliveries) {
        for (const field of ['stock_mg', 'source_reference', 'email', 'phone', 'notes']) {
          assert.equal(Object.hasOwn(row, field), false, `receipts must not expose ${field}`);
        }
        assert.equal(row.product, 'Synthetic product');
        assert.ok(row.lot_code.startsWith('SYNTHETIC-'));
        assert.ok(row.organization_name.startsWith('Synthetic organization '));
      }
      const ownReceipts = value => value.deliveries.filter(row => row.organization_ref === organizationFor[key])
        .sort((left, right) => left.delivery_ref.localeCompare(right.delivery_ref));
      assert.deepEqual(ownReceipts(current), ownReceipts(initial[key]), `${key}: own operational receipts must remain unchanged`);
      assert.deepEqual(current.batches, initial[key].batches, `${key}: inventory must remain organization-local`);
      assert.deepEqual(current.movements, initial[key].movements, `${key}: movements must remain organization-local`);
    }
    return actual;
  }
  async function patientHistory(key = 'patient') {
    const current = await snapshot(key);
    for (const field of ['deliveries', 'notes', 'bookings', 'encounters', 'profile']) {
      assert.deepEqual(current[field], initial[key][field], `${key}: own allowed ${field} must remain unchanged`);
    }
    assert.deepEqual(current.batches, []);
    assert.deepEqual(current.movements, []);
    assert.deepEqual(current.members, []);
    assert.deepEqual(refs(current.treatments, 'treatment_ref'), [key === 'patient' ? treatment : otherTreatment]);
  }
  const deniedDispense = () => forbidden(mutate('dispensaryB', 'dispense', {
    resourceRef: treatment, batchRef: batches.dispensaryB, quantityMg: 1000,
  }));
  const activatePatient = () => owner("update trustleaf_private.actor_bindings set state='active',valid_until=null where actor_ref=$1", [actors.patient]);

  await readOnlyCase('active patient: authorized sharing, exact receipt ownership and unrelated patient isolation', async () => {
    assert.equal((await owner('select valid_until from trustleaf_private.actor_bindings where actor_ref=$1', [actors.patient])).rows[0].valid_until, null);
    assert.deepEqual(await recipientProjections(), expectedRecipients());
    await patientHistory();
    await patientHistory('otherPatient');
  });

  await readOnlyCase('anon/authenticated gateway denial and direct private function denial for all caller roles', async () => {
    const privateFunctions = (await owner(`select p.proname from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='trustleaf_private' and p.prokind='f'
        and oidvectortypes(p.proargtypes)='text, text, jsonb'
        and (p.proname='trustleaf_operations_pilot' or p.proname like 'pilot_before_%')
      order by p.proname`)).rows.map(row => row.proname);
    assert.ok(privateFunctions.includes('trustleaf_operations_pilot'));
    assert.ok(privateFunctions.includes('pilot_before_delivery_descriptions'));
    try {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        await db.exec(`set role ${role}`);
        if (role !== 'service_role') await forbidden(call('dispensaryB', 'snapshot'));
        for (const name of privateFunctions) await forbidden(db.query(
          `select trustleaf_private.${identifier(name)}($1,'snapshot','{}'::jsonb)`, [subjects.dispensaryB]));
        for (const table of ['pilot_treatments', 'pilot_grants', 'pilot_patient_profiles', 'pilot_deliveries']) {
          await forbidden(db.query(`select * from trustleaf_private.${identifier(table)}`));
        }
      }
    } finally { await db.exec('set role service_role'); }
  });

  await readOnlyCase('forged patient/treatment/organization input cannot authorize third-party history', async () => {
    const forged = { patientRef: actors.otherPatient, resourceRef: otherTreatment, organizationRef: organizationA };
    for (const key of ['dispensaryB', 'operator']) assert.deepEqual(
      withoutClock(await snapshot(key, forged)), withoutClock(await snapshot(key)));
    assert.deepEqual(withoutClock(await snapshot('otherPatient', {
      patientRef: actors.patient, resourceRef: treatment, organizationRef: organizationB,
    })), withoutClock(await snapshot('otherPatient')));
    assert.deepEqual(await recipientProjections(), expectedRecipients());
  });

  for (const state of ['suspended', 'revoked', 'expired', 'valid_until_past']) {
    await owner(`update trustleaf_private.actor_bindings set state=$1,
      valid_until=case when $2 then statement_timestamp()-interval '1 second' else null end where actor_ref=$3`,
    [state === 'valid_until_past' ? 'active' : state, state === 'valid_until_past', actors.patient]);
    try {
      await readOnlyCase(`patient ${state}: withdraw shared treatment/grants/profile/foreign receipts, preserve own receipts`, async () => {
        const actual = await recipientProjections();
        await forbidden(call('patient', 'snapshot'));
        await deniedDispense();
        await patientHistory('otherPatient');
        const doctor = await snapshot('doctor');
        for (const field of ['treatments', 'deliveries', 'notes', 'bookings', 'encounters']) {
          assert.deepEqual(doctor[field], initial.doctor[field], 'existing medical ownership policy must remain intact');
        }
        assert.deepEqual(actual, expectedRecipients({ a: false, b: false }), 'inactive patient must withdraw only that patient\'s shared projection');
      });
    } finally { await activatePatient(); }
  }

  try {
    await testCase('patient valid_until equality: same-statement boundary withdraws shared data, no read side effects', async () => {
      const before = await businessRows();
      // A data-modifying CTE sets the synthetic boundary; both reads use that exact statement clock.
      const boundary = (await owner(`with boundary as (
        update trustleaf_private.actor_bindings set valid_until=statement_timestamp() where actor_ref=$1
        returning to_jsonb(valid_until) as valid_until
      ) select valid_until,
        jsonb_build_object(
          'dispensary',public.trustleaf_operations_pilot($2,'snapshot','{}'),
          'dispensaryB',public.trustleaf_operations_pilot($3,'snapshot','{}'),
          'operator',public.trustleaf_operations_pilot($4,'snapshot','{}'),
          'dispensaryRecovery',public.trustleaf_operations_pilot($5,'snapshot','{}')) as first,
        jsonb_build_object(
          'dispensary',public.trustleaf_operations_pilot($2,'snapshot','{}'),
          'dispensaryB',public.trustleaf_operations_pilot($3,'snapshot','{}'),
          'operator',public.trustleaf_operations_pilot($4,'snapshot','{}'),
          'dispensaryRecovery',public.trustleaf_operations_pilot($5,'snapshot','{}')) as repeated
        from boundary`, [actors.patient, ...recipients.map(key => subjects[key])])).rows[0];
      const actual = {};
      for (const key of recipients) {
        assert.equal(boundary.first[key].asOf, boundary.valid_until, 'read clock must equal patient validity exactly');
        assert.deepEqual(boundary.repeated[key], boundary.first[key], 'same-statement repeated read must be idempotent');
        actual[key] = projection(boundary.first[key]);
      }
      await forbidden(call('patient', 'snapshot'));
      await deniedDispense();
      await patientHistory('otherPatient');
      const afterReads = await recipientProjections();
      before.actor_bindings.find(row => row.actor_ref === actors.patient).valid_until = boundary.valid_until;
      assert.equal(fingerprint(await businessRows()), fingerprint(before),
        'only the explicit synthetic validity setup may change rows, never reads/audit/operations');
      assert.deepEqual(actual, expectedRecipients({ a: false, b: false }), 'equal patient validity is not active');
      assert.deepEqual(afterReads, actual, 'equality and later past-boundary reads must have the same authorization');
    });
  } finally { await activatePatient(); }

  await owner("update trustleaf_private.actor_bindings set valid_until=statement_timestamp()+interval '1 day' where actor_ref=$1", [actors.patient]);
  try {
    await readOnlyCase('active patient with future valid_until retains authorized sharing and own history', async () => {
      assert.deepEqual(await recipientProjections(), expectedRecipients());
      await patientHistory();
    });
  } finally { await activatePatient(); }

  for (const grantState of ['revoked', 'expired']) {
    if (grantState === 'revoked') await mutate('patient', 'revoke-grant', { resourceRef: treatment, organizationRef: organizationB });
    else await owner("update trustleaf_private.pilot_grants set expires_at=statement_timestamp()-interval '1 second' where treatment_ref=$1 and organization_ref=$2", [treatment, organizationB]);
    try {
      await readOnlyCase(`grant ${grantState}: recipient keeps own receipts, loses shared data, patient keeps own history`, async () => {
        assert.deepEqual(await recipientProjections(), expectedRecipients({ b: false }));
        await patientHistory();
        await deniedDispense();
      });
    } finally { await mutate('patient', 'grant', { resourceRef: treatment, organizationRef: organizationB }); }
  }

  const originalTreatment = (await owner('select * from trustleaf_private.pilot_treatments where treatment_ref=$1', [treatment])).rows[0];
  for (const boundary of ['prescription_valid_until', 'treatment_ends_at', 'revoked']) {
    if (boundary === 'revoked') await owner("update trustleaf_private.pilot_treatments set state='revoked' where treatment_ref=$1", [treatment]);
    else await owner(`update trustleaf_private.pilot_treatments set issued_at=statement_timestamp()-interval '100 days',
      ${identifier(boundary)}=statement_timestamp()-interval '1 second' where treatment_ref=$1`, [treatment]);
    try {
      await readOnlyCase(`treatment ${boundary}: shared data withdrawn without deleting patient/organization receipts`, async () => {
        assert.deepEqual(await recipientProjections(), expectedRecipients({ a: false, b: false }));
        await patientHistory();
        await patientHistory('otherPatient');
      });
    } finally {
      await owner(`update trustleaf_private.pilot_treatments set state=$2,issued_at=$3,
        prescription_valid_until=$4,treatment_ends_at=$5 where treatment_ref=$1`,
      [treatment, originalTreatment.state, originalTreatment.issued_at,
        originalTreatment.prescription_valid_until, originalTreatment.treatment_ends_at]);
    }
  }

  for (const state of ['suspended', 'revoked', 'expired', 'valid_until_past']) {
    await owner(`update trustleaf_private.actor_bindings set state=$1,
      valid_until=case when $2 then statement_timestamp()-interval '1 second' else null end where actor_ref=$3`,
    [state === 'valid_until_past' ? 'active' : state, state === 'valid_until_past', actors.doctor]);
    try {
      await readOnlyCase(`doctor ${state}: existing caller/ownership/shared-read policy remains exactly baseline`, async () => {
        await forbidden(call('doctor', 'snapshot'));
        await patientHistory();
        await patientHistory('otherPatient');
        // Compare to the prior implementation, without deciding a new prescriber-active policy.
        const previousWrapper = baseline ? 'public.trustleaf_operations_pilot'
          : 'trustleaf_private.pilot_before_shared_patient_authorization';
        await forbidden(owner(`select ${previousWrapper}($1,'snapshot','{}')`, [subjects.doctor]));
        for (const key of [...recipients, 'patient', 'otherPatient', 'otherDoctor']) {
          const previous = (await owner(`select ${previousWrapper}($1,'snapshot','{}') as data`, [subjects[key]])).rows[0].data;
          assert.deepEqual(withoutClock(await snapshot(key)), withoutClock(previous), `${key}: medical read policy must match baseline`);
        }
      });
    } finally {
      await owner("update trustleaf_private.actor_bindings set state='active',valid_until=null where actor_ref=$1", [actors.doctor]);
    }
  }

  await mutate('dispensaryB', 'remove-operator', { resourceRef: actors.operator });
  await readOnlyCase('membership removal withdraws all operator history but preserves organization-owned receipts', async () => {
    const removed = await snapshot('operator');
    assert.deepEqual(removed.membership, { actor_ref: null, organization_ref: null, role: null, created_at: null },
      'removed membership retains the existing all-null composite contract');
    assert.equal(removed.staffOnly, true);
    for (const field of ['treatments', 'grants', 'patientProfiles', 'deliveries', 'members', 'batches', 'movements', 'organizations']) {
      assert.deepEqual(removed[field], [], `removed operator must have no ${field}`);
    }
    const manager = await snapshot('dispensaryB');
    assert.deepEqual(projection(manager), expectedRecipients().dispensaryB);
    assert.deepEqual(manager.deliveries, initial.dispensaryB.deliveries);
    await forbidden(mutate('operator', 'dispense', { resourceRef: treatment, batchRef: batches.dispensaryB, quantityMg: 1000 }));
    await patientHistory();
  });

  console.log(`${baseline ? 'BASELINE' : 'CURRENT'}: ${passed} passed, ${failures.length} failed; in-memory PGlite, no network or credentials.`);
  console.log('POLICY PENDING (separate from DEM-SEC-01): doctor-active shared-read policy is not decided; existing medical ownership/caller rules are preserved.');
  console.log('Not covered: hosted Privy/PostgREST or independent PostgreSQL connections.');
  process.exitCode = failures.length ? 1 : 0;
} catch (error) {
  console.error(`FAIL: regression setup/execution: ${error.code ?? 'ERROR'}: ${error.message}`);
  process.exitCode = 1;
} finally {
  try { if (db) await db.close(); }
  finally { globalThis.fetch = previousFetch; }
}
