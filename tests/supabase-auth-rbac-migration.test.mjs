import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = (await readFile(
  new URL('../supabase/migrations/20260826150000_trustleaf_auth_rbac_minimum.sql', import.meta.url),
  'utf8',
)).toLowerCase();

const tables = [
  'actor_bindings',
  'encrypted_objects',
  'relationship_grants',
  'patient_entitlements',
  'receipt_bindings',
  'audit_events',
  'idempotency_journal',
];

for (const table of tables) {
  assert.match(sql, new RegExp(`create policy [a-z0-9_]+\\s+on trustleaf_private\\.${table}`));
}

assert.match(sql, /auth_subject = \(select auth\.uid\(\)\)/);
assert.match(sql, /create function trustleaf_private\.current_actor_ref\(\)/);
assert.match(sql, /create function trustleaf_private\.current_actor_has_role/);
assert.match(sql, /create function trustleaf_private\.request_actor_enrollment/);
assert.match(sql, /requested_role = 'admin'/);
assert.match(sql, /admin_enrollment_forbidden/);
assert.match(sql, /create function trustleaf_private\.admin_set_actor_state/);
assert.match(sql, /expected_version/);
assert.match(sql, /idempotency_conflict/);
assert.match(sql, /insert into trustleaf_private\.audit_events/);
assert.match(sql, /insert into trustleaf_private\.idempotency_journal/);
assert.match(sql, /idempotency_journal_actor_fk/);
assert.equal((sql.match(/pg_advisory_xact_lock\(42826001\)/g) ?? []).length, 2);
assert.match(sql, /self_admin_lockout_forbidden/);
assert.match(sql, /grant execute on function trustleaf_private\.request_actor_enrollment[^]*to authenticated/);
assert.match(sql, /grant select on trustleaf_private\.audit_events to authenticated, trustleaf_auditor/);
assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]*to authenticated/);
assert.doesNotMatch(sql, /raw_user_meta_data|user_metadata|app_metadata/);
assert.doesNotMatch(sql, /\b(email|rut|diagnosis|diagnostico|dose|dosis|gramaje|wallet|prescription_pdf)\b/);
assert.doesNotMatch(sql, /service[_-]?key|sb_secret_/);
assert.doesNotMatch(sql, /storage\.|create extension|alter table auth\./);

console.log('supabase auth/RBAC migration: auth.uid, object isolation, no direct writes, CAS, idempotency and audit checks passed');
