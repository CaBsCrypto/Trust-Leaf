import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort();
for (const requiredMigration of [
  '20260826060000_trustleaf_synthetic_security_baseline.sql',
  '20260826150000_trustleaf_auth_rbac_minimum.sql',
  '20260829110000_trustleaf_synthetic_admin_bootstrap.sql',
  '20260829120000_trustleaf_synthetic_availability_booking.sql',
  '20260830100000_privy_identity_bindings.sql',
  '20260830103000_privy_identity_server_rpc.sql',
  '20260830110000_privy_first_admin_bootstrap.sql',
  '20260830120000_privy_server_rpc_gateway.sql',
  '20260831100000_privy_actor_enrollment.sql',
]) assert.ok(migrationFiles.includes(requiredMigration), `missing migration: ${requiredMigration}`);

const sql = (await readFile(new URL('../supabase/migrations/20260826060000_trustleaf_synthetic_security_baseline.sql', import.meta.url), 'utf8')).toLowerCase();
const config = (await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8')).toLowerCase();
const bootstrapSql = (await readFile(new URL('../supabase/migrations/20260829110000_trustleaf_synthetic_admin_bootstrap.sql', import.meta.url), 'utf8')).toLowerCase();
const privyEnrollmentSql = (await readFile(new URL('../supabase/migrations/20260831100000_privy_actor_enrollment.sql', import.meta.url), 'utf8')).toLowerCase();
const tables = [
  'actor_bindings',
  'encrypted_objects',
  'relationship_grants',
  'patient_entitlements',
  'receipt_bindings',
  'audit_events',
  'idempotency_journal',
];

assert.match(sql, /create schema trustleaf_private authorization postgres/);
assert.doesNotMatch(sql, /create\s+(table|view|function)\s+public\./);
assert.doesNotMatch(sql, /create\s+policy/);
assert.doesNotMatch(sql, /grant\s+.+\s+to\s+(anon|authenticated|service_role|public)/);
assert.match(sql, /revoke all on schema trustleaf_private from public, anon, authenticated, service_role/);
assert.match(sql, /audit_events_append_only/);
assert.match(sql, /before update or delete on trustleaf_private\.audit_events/);

for (const table of tables) {
  assert.match(sql, new RegExp(`alter table trustleaf_private\\.${table} enable row level security`));
  assert.match(sql, new RegExp(`alter table trustleaf_private\\.${table} force row level security`));
}

for (const forbidden of ['rut', 'email', 'diagnosis', 'diagnostico', 'dose', 'dosis', 'gramaje', 'wallet', 'address', 'prescription_pdf']) {
  assert.doesNotMatch(sql, new RegExp(`\\b${forbidden}\\b`));
}
assert.doesNotMatch(sql, /storage\.buckets|storage\.objects|create extension|service[_-]?key|secret/);
assert.doesNotMatch(bootstrapSql, /grant execute[^;]*to\s+(anon|authenticated|service_role|public)/);
assert.match(privyEnrollmentSql, /patients activate immediately/);
assert.match(privyEnrollmentSql, /requested_role not in \('patient', 'doctor', 'dispensary'\)/);
assert.match(privyEnrollmentSql, /revoke all on function public\.trustleaf_enroll_privy_actor/);
assert.doesNotMatch(privyEnrollmentSql, /\b(email|rut|diagnos|dosis|gramaje|wallet|service[_-]?key|sb_secret)\b/);
assert.match(bootstrapSql, /revoke all on function trustleaf_private\.bootstrap_first_synthetic_admin/);
assert.match(bootstrapSql, /to trustleaf_server/);
for (const forbidden of ['rut', 'email', 'diagnosis', 'diagnostico', 'dose', 'dosis', 'gramaje', 'wallet', 'address', 'prescription_pdf', 'service_key', 'sb_secret']) {
  assert.doesNotMatch(bootstrapSql, new RegExp(`\\b${forbidden}\\b`));
}

for (const section of ['api', 'realtime', 'studio', 'storage', 'edge_runtime', 'analytics']) {
  assert.match(config, new RegExp(`\\[${section}\\]\\s+enabled = false`));
}
assert.match(config, /\[db\.seed\]\s+# if enabled[^]*?enabled = false/);
assert.match(config, /\[auth\][^]*?enable_signup = false/);
assert.match(config, /^project_id = "trustleaf-synthetic-local"/m);
assert.doesNotMatch(config, /\.supabase\.co|project[_-]?ref/);

console.log('supabase migration security: versioning, private schema, deny-by-default RLS, grants, audit immutability and no-sensitive-data checks passed');
