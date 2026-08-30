import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enrollmentSql = (await readFile(
  new URL('../supabase/migrations/20260826150000_trustleaf_auth_rbac_minimum.sql', import.meta.url),
  'utf8',
)).toLowerCase();
const bootstrapSql = (await readFile(
  new URL('../supabase/migrations/20260829110000_trustleaf_synthetic_admin_bootstrap.sql', import.meta.url),
  'utf8',
)).toLowerCase();

// Enrollment is self-service only for non-admin synthetic actors. The SQL
// function, not caller metadata, selects the authenticated subject.
for (const role of ['doctor', 'patient', 'dispensary']) {
  assert.match(enrollmentSql, new RegExp(`requested_role trustleaf_private\\.actor_role`));
  assert.match(enrollmentSql, /values \(new_actor_ref, caller_subject, requested_role, 'pending'\)/);
  assert.match(enrollmentSql, /if requested_role = 'admin' then/);
  assert.match(enrollmentSql, /admin_enrollment_forbidden/);
  assert.ok(role.length > 0);
}
assert.match(enrollmentSql, /caller_subject uuid := auth\.uid\(\)/);
assert.match(enrollmentSql, /actor_already_enrolled/);
assert.match(enrollmentSql, /idempotency_conflict/);
assert.match(enrollmentSql, /pg_advisory_xact_lock\(42826001\)/);

// The bootstrap route is deliberately outside authenticated/service-role API
// access. It has a single-winner lock, refuses reuse, and appends audit.
assert.match(bootstrapSql, /bootstrap_first_synthetic_admin/);
assert.match(bootstrapSql, /pg_has_role\(session_user, 'trustleaf_server', 'member'\)/);
assert.match(bootstrapSql, /bootstrap_operator_required/);
assert.match(bootstrapSql, /pg_advisory_xact_lock\(42826002\)/);
assert.match(bootstrapSql, /admin_bootstrap_already_completed/);
assert.match(bootstrapSql, /bootstrap_subject_already_bound/);
assert.match(bootstrapSql, /bootstrap_operation_reused/);
assert.match(bootstrapSql, /insert into trustleaf_private\.audit_events/);
assert.match(bootstrapSql, /insert into trustleaf_private\.idempotency_journal/);
assert.match(bootstrapSql, /revoke all on function trustleaf_private\.bootstrap_first_synthetic_admin/);
assert.match(bootstrapSql, /from public, anon, authenticated, service_role, trustleaf_auditor/);
assert.match(bootstrapSql, /grant execute on function trustleaf_private\.bootstrap_first_synthetic_admin[\s\S]*to trustleaf_server/);
assert.doesNotMatch(bootstrapSql, /email|rut|diagnos|dosis|gramaje|wallet|service[_-]?key|sb_secret_/);

console.log('Supabase identity bootstrap contract: non-admin enrollment and one-time operator-only synthetic admin checks passed');
