import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

// Deliberately refuses hosted databases and requires an empty, dedicated local database.
const connection = process.env.PILOT_TEST_DATABASE_URL;
if (!connection) { console.error('NOT RUN: set PILOT_TEST_DATABASE_URL for an EMPTY localhost database named trustleaf_pilot_test and install psql. Never use production.'); process.exit(2); }
const url = new URL(connection);
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert.equal(url.pathname, '/trustleaf_pilot_test');
assert.equal(url.search, '', 'connection overrides are not allowed');
const connectionEnv = { PGHOST: url.hostname.replaceAll(/[\[\]]/g, ''), PGPORT: url.port || '5432',
  PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '5' };
const sql = (text, application = 'pilot-setup') => new Promise((resolve, reject) => {
  const child = spawn(process.env.PSQL_BIN ?? 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, ...connectionEnv, PGAPPNAME: application, PGOPTIONS: '-c statement_timeout=20000 -c lock_timeout=15000' }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let out = '', err = ''; child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; });
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)));
  child.stdin.end(text);
});
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const command = (who, action, input) => `select public.trustleaf_operations_pilot(${literal('did:privy:concurrency-' + who)},${literal(action)},${literal(JSON.stringify({ operationId: randomUUID(), ...input }))}::jsonb);`;
const mutation = async (who, action, input) => JSON.parse(await sql(command(who, action, input)));

// The holder makes both connections wait; observing both waiters proves overlap.
async function competing(lockExpression, statements) {
  const holder = spawn(process.env.PSQL_BIN ?? 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, ...connectionEnv, PGAPPNAME: 'pilot-barrier' }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const held = new Promise((resolve, reject) => {
    let output = '';
    holder.stdout.on('data', chunk => { output += chunk; if (output.includes('LOCK_READY')) resolve(); });
    holder.once('error', reject); holder.once('exit', () => reject(new Error('Barrier ended before ready')));
  });
  const finished = new Promise(resolve => holder.once('exit', resolve));
  holder.stdin.write(`begin; select ${lockExpression}; select 'LOCK_READY';\n`);
  let pending;
  try {
    await held;
    pending = Promise.allSettled(statements.map((statement, i) => sql(`set role service_role; ${statement}`, `pilot-racer-${i}`)));
    const deadline = Date.now() + 10000;
    while (true) {
      const count = await sql("select count(*) from pg_stat_activity where application_name like 'pilot-racer-%' and wait_event_type='Lock';");
      if (Number(count) === statements.length) break;
      if (Date.now() > deadline) throw new Error('Both independent transactions did not reach the lock barrier');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } finally { holder.stdin.end('commit;\n'); await finished; }
  return pending;
}
assert.equal(await sql("select count(*) from information_schema.tables where table_schema in ('public','trustleaf_private');"), '0', 'Test DB must be empty; this runner does not drop data.');
await sql(`do $$begin create role anon; exception when duplicate_object then null; end$$;
  do $$begin create role authenticated; exception when duplicate_object then null; end$$;
  do $$begin create role service_role; exception when duplicate_object then null; end$$;
  create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;
  grant usage on schema auth to anon,authenticated,service_role;`);
const migrations = new URL('../../supabase/migrations/', import.meta.url);
for (const name of (await readdir(migrations)).filter(n => n.endsWith('.sql') && n !== '20260906120000_monthly_dispensing_quota.sql').sort()) await sql(await readFile(new URL(name, migrations), 'utf8'));
await sql("select public.trustleaf_bootstrap_first_privy_admin('did:privy:concurrency-admin');");
for (const [who, role] of [['doctor', 'doctor'], ['patient', 'patient'], ['patient2', 'patient'], ['a', 'dispensary'], ['b', 'dispensary'], ['operator', 'dispensary']]) {
  // Fixture activation is intentionally confined to the verified empty local database.
  await sql(`select public.trustleaf_enroll_privy_actor('did:privy:concurrency-${who}','${role}');
    update trustleaf_private.actor_bindings set state='active'; ${command(who, 'join', { acceptSyntheticOnly: true })}`);
}
const orgA = JSON.parse(await sql(command('a', 'create-organization', { name: 'Concurrent A' }))).resourceRef;
const orgB = JSON.parse(await sql(command('b', 'create-organization', { name: 'Concurrent B' }))).resourceRef;
const slotRef = randomUUID(), bookingRef = randomUUID();
const agenda = (who, action, input) => sql(`select public.trustleaf_privy_agenda('did:privy:concurrency-${who}',${literal(action)},${literal(JSON.stringify({ ...input, operationId: randomUUID() }))}::jsonb);`);
await agenda('doctor', 'publish', { slotRef, startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 88200000).toISOString() });
await agenda('patient', 'reserve', { slotRef, bookingRef, version: 1 });
await sql(command('doctor', 'start-encounter', { resourceRef: bookingRef }));
await sql(command('doctor', 'complete-encounter', { resourceRef: bookingRef, version: 1, issueTreatment: true, allowanceMg: 30000, periodCount: 3 }));
const treatmentRef = await sql('select treatment_ref from trustleaf_private.pilot_treatments;');
for (const org of [orgA, orgB]) await sql(command('patient', 'grant', { resourceRef: treatmentRef, organizationRef: org }));
const batch = { lotCode: 'CONCURRENT-001', product: 'Synthetic flower', sourceReference: 'QA ONLY', expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), quantityMg: 100000 };
const batchA = JSON.parse(await sql(command('a', 'receive-batch', batch))).resourceRef;
const batchB = JSON.parse(await sql(command('b', 'receive-batch', batch))).resourceRef;
const firstA = { resourceRef: treatmentRef, batchRef: batchA, quantityMg: 20000, operationId: randomUUID() };
const firstB = { resourceRef: treatmentRef, batchRef: batchB, quantityMg: 20000, operationId: randomUUID() };
const patientRef = await sql(`select patient_ref from trustleaf_private.pilot_treatments where treatment_ref=${literal(treatmentRef)};`);
const patientLock = `pg_advisory_xact_lock(hashtextextended('pilot-patient|'||${literal(patientRef)},0))`;
const results = await competing(patientLock, [command('a', 'dispense', firstA), command('b', 'dispense', firstB)]);
assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
assert.match(results.find(r => r.status === 'rejected').reason.message, /PILOT_STOCK_OR_QUOTA_CONFLICT/);
assert.equal(await sql('select sum(quantity_mg) from trustleaf_private.pilot_deliveries;'), '20000');
assert.equal(await sql('select sum(quantity_mg) from trustleaf_private.pilot_movements;'), '180000');
const winner = results[0].status === 'fulfilled' ? ['a', firstA] : ['b', firstB];
assert.equal((await mutation(winner[0], 'dispense', winner[1])).replayed, true, 'retry after losing the committed response');
assert.equal(await sql('select count(*) from trustleaf_private.pilot_deliveries;'), '1');
await assert.rejects(mutation(winner[0], 'dispense', { ...winner[1], quantityMg: 1000 }), /PILOT_REPLAY_CONFLICT/);

const actorOperator = await sql("select actor_ref from public.trustleaf_resolve_privy_actor('did:privy:concurrency-operator');");
await mutation('a', 'add-operator', { resourceRef: actorOperator });
await assert.rejects(mutation('operator', 'receive-batch', { ...batch, lotCode: 'FORBIDDEN' }), /PILOT_MANAGER_REQUIRED/);
const slot2 = randomUUID(), booking2 = randomUUID();
await agenda('doctor', 'publish', { slotRef: slot2, startsAt: new Date(Date.now() + 90000000).toISOString(), endsAt: new Date(Date.now() + 91800000).toISOString() });
await agenda('patient2', 'reserve', { slotRef: slot2, bookingRef: booking2, version: 1 });
await mutation('doctor', 'start-encounter', { resourceRef: booking2 });
await mutation('doctor', 'complete-encounter', { resourceRef: booking2, version: 1, issueTreatment: true, allowanceMg: 30000, periodCount: 3 });
const treatment2 = await sql(`select treatment_ref from trustleaf_private.pilot_treatments where booking_ref=${literal(booking2)};`);
for (const org of [orgA, orgB]) await mutation('patient2', 'grant', { resourceRef: treatment2, organizationRef: org });
const scarceBatch = (await mutation('a', 'receive-batch', { ...batch, lotCode: 'SCARCE', quantityMg: 15000 })).resourceRef;
const stockResults = await competing(`1 from trustleaf_private.pilot_batches where batch_ref=${literal(scarceBatch)} for update`, [
  command('a', 'dispense', { resourceRef: treatmentRef, batchRef: scarceBatch, quantityMg: 10000 }),
  command('operator', 'dispense', { resourceRef: treatment2, batchRef: scarceBatch, quantityMg: 10000 }),
]);
assert.equal(stockResults.filter(r => r.status === 'fulfilled').length, 1, 'different patients cannot overdraw the same lot');
assert.match(stockResults.find(r => r.status === 'rejected').reason.message, /PILOT_STOCK_OR_QUOTA_CONFLICT/);
assert.equal(await sql(`select sum(quantity_mg) from trustleaf_private.pilot_movements where batch_ref=${literal(scarceBatch)};`), '5000');

const patient2Ref = await sql(`select patient_ref from trustleaf_private.pilot_treatments where treatment_ref=${literal(treatment2)};`);
const retry = { resourceRef: treatment2, batchRef: batchB, quantityMg: 5000, operationId: randomUUID() };
const duplicateResults = await competing(`pg_advisory_xact_lock(hashtextextended('pilot-patient|'||${literal(patient2Ref)},0))`, [command('b', 'dispense', retry), command('b', 'dispense', retry)]);
assert.equal(duplicateResults.filter(r => r.status === 'fulfilled').length, 2, 'identical concurrent retries recover one result');
assert.equal(await sql(`select count(*) from trustleaf_private.pilot_deliveries where treatment_ref=${literal(treatment2)} and batch_ref=${literal(batchB)};`), '1');
await mutation('patient2', 'revoke-grant', { resourceRef: treatment2, organizationRef: orgB });
await assert.rejects(mutation('b', 'dispense', { ...retry, operationId: randomUUID() }), /PILOT_GRANT_REQUIRED/);
await mutation('patient2', 'grant', { resourceRef: treatment2, organizationRef: orgB });
await mutation('a', 'remove-operator', { resourceRef: actorOperator });
await assert.rejects(mutation('operator', 'dispense', { resourceRef: treatment2, batchRef: scarceBatch, quantityMg: 1000 }), /PILOT_DISPENSARY_REQUIRED/);
const batchVersion = Number(await sql(`select version from trustleaf_private.pilot_batches where batch_ref=${literal(batchB)};`));
await mutation('b', 'set-batch-state', { resourceRef: batchB, version: batchVersion, state: 'quarantined' });
await assert.rejects(mutation('b', 'dispense', { ...retry, operationId: randomUUID() }), /PILOT_STOCK_OR_QUOTA_CONFLICT/);
await mutation('b', 'set-batch-state', { resourceRef: batchB, version: batchVersion + 1, state: 'active' });
await sql(`update trustleaf_private.pilot_batches set expires_at=clock_timestamp()-interval '1 second' where batch_ref=${literal(batchB)};`);
await assert.rejects(mutation('b', 'dispense', { ...retry, operationId: randomUUID() }), /PILOT_STOCK_OR_QUOTA_CONFLICT/);
await mutation('doctor', 'revoke-treatment', { resourceRef: treatment2, version: 1 });
await assert.rejects(mutation('b', 'dispense', { ...retry, operationId: randomUUID() }), /PILOT_TREATMENT_EXPIRED/);
console.log('PASS: independent blocked PostgreSQL sessions validate shared quota, shared stock, concurrent retries, lost-response recovery, revocation, expiry, quarantine and operator restrictions. Dedicated test DB retained.');
