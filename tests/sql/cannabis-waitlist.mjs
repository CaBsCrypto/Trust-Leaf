import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = new URL('../../supabase/migrations/20261122020000_cannabis_waitlist.sql', import.meta.url);
const doctorsMigration = new URL('../../supabase/migrations/20261123170115_cannabis_waitlist_doctors.sql', import.meta.url);
const signup = (audience, email) => db.query('select public.trustleaf_cannabis_waitlist_signup($1, $2) as result', [audience, email]);
const entries = () => db.query('select audience, email, created_at from trustleaf_private.cannabis_waitlist order by audience');

try {
  // Minimal local roles and private schema needed by the shared migration.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema trustleaf_private;
    revoke all on schema trustleaf_private from public, anon, authenticated, service_role;`);
  await db.exec(await readFile(migration, 'utf8'));
  await db.exec('set role service_role');
  await signup('patient', '\tLEAD@Example.test ');
  await signup('dispensary', 'lead@example.test');
  await db.exec('reset role');
  const originalEntries = (await entries()).rows;
  await db.exec(await readFile(doctorsMigration, 'utf8'));
  assert.deepEqual((await entries()).rows, originalEntries, 'migration preserves the existing lists and timestamps');

  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(signup('patient', 'lead@example.test'), { code: '42501' });
    await assert.rejects(entries(), { code: '42501' });
  }

  await db.exec('set role service_role');
  await assert.rejects(entries(), { code: '42501' });
  for (const [audience, email] of [['unknown', 'lead@example.test'], ['patient', 'lead'], ['patient', null]]) {
    await assert.rejects(signup(audience, email), { code: '22023' });
  }

  assert.deepEqual((await signup('doctor', '\tLEAD@Example.test ')).rows, [{ result: { registered: true } }]);
  await db.exec('reset role');
  const beforeRetry = (await entries()).rows;
  assert.deepEqual(beforeRetry.map(({ audience, email }) => [audience, email]), [
    ['dispensary', 'lead@example.test'], ['doctor', 'lead@example.test'], ['patient', 'lead@example.test'],
  ]);

  await db.exec('set role service_role');
  assert.deepEqual((await signup('doctor', 'lead@example.test')).rows, [{ result: { registered: true } }]);
  await db.exec('reset role');
  assert.deepEqual((await entries()).rows, beforeRetry);
  console.log('Cannabis waitlist SQL passed cohort isolation, normalization, duplicate signup, and role-access checks.');
} finally {
  await db.close();
}
