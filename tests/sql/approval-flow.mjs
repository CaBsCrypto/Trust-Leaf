import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migrations = new URL('../../supabase/migrations/', import.meta.url);
const subjects = Object.fromEntries(['admin', 'doctor', 'dispensary', 'patient'].map(role => [role, `did:privy:sql-fixture-${role}`]));
const profiles = {
  doctor: ['Dra. Camila Prueba', 'TEST-RNPI-0001', 'Medicina general | Perfil de prueba'],
  dispensary: ['Dispensario Central Prueba', 'TEST-ISP-0001', 'Operación farmacéutica | Perfil de prueba'],
};
async function rpc(sql, params = [], role = 'service_role') {
  await db.exec(`set role ${role}`);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec('reset role'); }
}
const queue = subject => rpc('select * from public.trustleaf_list_pending_privy_actors($1)', [subject]);
const submit = role => rpc('select * from public.trustleaf_submit_professional_test_application($1,$2,$3,$4,$5)', [subjects[role], role, ...profiles[role]]);
try {
  // Supabase platform roles and auth.uid are the only platform scaffolding.
  // Application tables and functions come from the unmodified migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    if (process.argv.includes('--baseline') && name >= '20260905220000') continue;
    await db.exec(await readFile(new URL(name, migrations), 'utf8'));
    console.log(`Applied ${name}`);
  }
  await rpc('select * from public.trustleaf_bootstrap_first_privy_admin($1)', [subjects.admin]);
  assert.equal((await queue(subjects.admin)).length, 0);
  const patient = await rpc('select * from public.trustleaf_enroll_privy_actor($1,$2)', [subjects.patient, 'patient']);
  assert.equal(patient[0].actor_state, 'active');
  for (const role of ['doctor', 'dispensary']) {
    const enrolled = await submit(role);
    assert.equal(enrolled[0].actor_state, 'pending');
    assert.equal((await submit(role))[0].actor_ref, enrolled[0].actor_ref);
    const pending = (await queue(subjects.admin)).filter(row => row.actor_ref === enrolled[0].actor_ref);
    assert.equal(pending.length, 1, 'resend must not duplicate the queue');
    assert.equal(pending[0].display_name, profiles[role][0]);
    const otherRole = role === 'doctor' ? 'dispensary' : 'doctor';
    await assert.rejects(rpc('select * from public.trustleaf_submit_professional_test_application($1,$2,$3,$4,$5)',
      [subjects[role], otherRole, ...profiles[otherRole]]), { code: '42501' });
    await assert.rejects(rpc('select * from public.trustleaf_submit_professional_test_application($1,$2,$3,$4,$5)',
      [subjects[role], role, null, ...profiles[role].slice(1)]), { code: '22023' });
    const review = 'select * from public.trustleaf_review_pending_privy_actor($1,$2,$3,$4,$5)';
    const args = [subjects.admin, pending[0].actor_ref, pending[0].version, 'approve', new Uint8Array(32).fill(1)];
    await assert.rejects(rpc(review, [subjects.patient, ...args.slice(1)]), { code: '42501' });
    const approved = await rpc(review, args);
    assert.equal(approved[0].actor_state, 'active');
    await assert.rejects(rpc(review, args), { code: '40001' });
    const resolved = await rpc('select * from public.trustleaf_resolve_privy_actor($1)', [subjects[role]]);
    assert.equal(resolved[0].actor_state, 'active');
    assert.equal(resolved[0].role, role);
  }
  assert.equal((await queue(subjects.admin)).length, 0);
  await assert.rejects(queue(subjects.patient), { code: '42501' });
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(rpc('select * from public.trustleaf_list_pending_privy_actors($1)', [subjects.admin], role), { code: '42501' });
    if (role === 'anon') {
      await assert.rejects(rpc('select * from trustleaf_private.actor_bindings', [], role), { code: '42501' });
    } else {
      assert.deepEqual(await rpc('select * from trustleaf_private.actor_bindings', [], role), [], 'RLS must hide all rows without a matching auth subject');
    }
  }
  console.log('PASS: actual SQL enrollment, resend, queue, approval, resolution and permission denials in isolated PostgreSQL.');
} catch (error) {
  console.error('SQL validation failed:', error.code, error.message, error.where ?? '', error.code === 'ERR_ASSERTION' ? error.stack : '');
  process.exitCode = 1;
} finally { await db.close(); }
