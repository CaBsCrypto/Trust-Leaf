import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export async function operationsDatabase({ migrationNames, namespace = 'pilot-fixture', roles } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  // This separate, untracked draft is not part of the pilot's migration dependency chain.
  for (const name of migrationNames ?? (await readdir(migrations)).filter(n => n.endsWith('.sql') && n !== '20260906120000_monthly_dispensing_quota.sql').sort()) {
    await db.exec(await readFile(new URL(name, migrations), 'utf8'));
  }
  const keys = roles ? Object.keys(roles) : ['admin', 'doctor', 'patient', 'dispensary', 'dispensaryB', 'dispensaryRecovery', 'operator', 'otherDoctor', 'otherPatient'];
  const subjects = Object.fromEntries(keys.map(key => [key, `did:privy:${namespace}-${key}`]));
  const actors = {};
  actors.admin = (await db.query('select * from public.trustleaf_bootstrap_first_privy_admin($1)', [subjects.admin])).rows[0].actor_ref;
  for (const key of Object.keys(subjects).filter(k => k !== 'admin')) {
    const role = roles?.[key] ?? (key.includes('Doctor') ? 'doctor' : key.includes('Patient') ? 'patient' : key.startsWith('dispensary') || key === 'operator' ? 'dispensary' : key);
    const row = (await db.query('select * from public.trustleaf_enroll_privy_actor($1,$2)', [subjects[key], role])).rows[0];
    actors[key] = row.actor_ref;
    if (role !== 'patient') await db.query('select * from public.trustleaf_review_pending_privy_actor($1,$2,$3,$4,$5)',
      [subjects.admin, row.actor_ref, row.version ?? 1, 'approve', new Uint8Array(32).fill(Object.keys(actors).length)]);
  }
  await db.exec('set role service_role');
  const call = async (key, action, input = {}) => (await db.query('select public.trustleaf_operations_pilot($1,$2,$3) as data', [subjects[key], action, input])).rows[0].data;
  const agenda = async (key, action, input) => (await db.query('select public.trustleaf_privy_agenda($1,$2,$3) as data', [subjects[key], action, input])).rows[0].data;
  return { db, subjects, actors, call, agenda };
}
