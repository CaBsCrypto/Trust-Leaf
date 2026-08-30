-- TrustLeaf synthetic first-admin ceremony. PREPARED LOCALLY; DO NOT APPLY
-- without the baseline and Auth/RBAC increment plus a separate human gate.
--
-- This is intentionally not callable through PostgREST/Auth roles. It is a
-- one-time, direct database-operator ceremony for an already-created
-- *synthetic* Supabase Auth subject. It never accepts profile or clinical data.

begin;

create function trustleaf_private.bootstrap_first_synthetic_admin(
  bootstrap_subject uuid,
  operation_digest bytea
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_actor_ref uuid;
  previous_audit_digest bytea;
  new_audit_digest bytea;
begin
  -- `session_user` preserves the external caller under SECURITY DEFINER. The
  -- synthetic server role is intentionally NOLOGIN and never granted to API
  -- roles. A direct operator must explicitly use its approved membership.
  if not pg_catalog.pg_has_role(session_user, 'trustleaf_server', 'member') then
    raise exception 'BOOTSTRAP_OPERATOR_REQUIRED' using errcode = '42501';
  end if;
  if bootstrap_subject is null then
    raise exception 'BOOTSTRAP_SUBJECT_REQUIRED' using errcode = '22023';
  end if;
  if operation_digest is null or octet_length(operation_digest) <> 32 then
    raise exception 'IDEMPOTENCY_DIGEST_INVALID' using errcode = '22023';
  end if;

  -- A global lock makes the ceremony single-winner even if two operators race.
  perform pg_catalog.pg_advisory_xact_lock(42826002);
  if exists (
    select 1 from trustleaf_private.actor_bindings where role = 'admin'
  ) then
    raise exception 'ADMIN_BOOTSTRAP_ALREADY_COMPLETED' using errcode = '23505';
  end if;
  if exists (
    select 1 from trustleaf_private.actor_bindings where auth_subject = bootstrap_subject
  ) then
    raise exception 'BOOTSTRAP_SUBJECT_ALREADY_BOUND' using errcode = '23505';
  end if;
  if exists (
    select 1 from trustleaf_private.idempotency_journal where operation_digest = bootstrap_first_synthetic_admin.operation_digest
  ) then
    raise exception 'BOOTSTRAP_OPERATION_REUSED' using errcode = '23505';
  end if;

  new_actor_ref := pg_catalog.gen_random_uuid();
  insert into trustleaf_private.actor_bindings (actor_ref, auth_subject, role, state)
  values (new_actor_ref, bootstrap_subject, 'admin', 'active');

  -- Serialized append-only audit chain; neither Auth clients nor service_role
  -- receive INSERT/UPDATE/DELETE grants on this table.
  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into previous_audit_digest
  from trustleaf_private.audit_events order by audit_seq desc limit 1;
  new_audit_digest := pg_catalog.sha256(
    coalesce(previous_audit_digest, '\x'::bytea)
    || operation_digest
    || pg_catalog.convert_to('actor.admin.bootstrap|' || new_actor_ref::text, 'UTF8')
  );
  insert into trustleaf_private.audit_events (
    actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest
  ) values (
    new_actor_ref, 'actor.admin.bootstrap', new_actor_ref, 'allowed', previous_audit_digest, new_audit_digest
  );
  insert into trustleaf_private.idempotency_journal (
    operation_digest, actor_ref, intent_digest, outcome_ref
  ) values (
    operation_digest,
    new_actor_ref,
    pg_catalog.sha256(pg_catalog.convert_to('actor.admin.bootstrap|' || bootstrap_subject::text, 'UTF8')),
    new_actor_ref
  );
  return new_actor_ref;
end
$$;

revoke all on function trustleaf_private.bootstrap_first_synthetic_admin(uuid, bytea)
from public, anon, authenticated, service_role, trustleaf_auditor;
grant execute on function trustleaf_private.bootstrap_first_synthetic_admin(uuid, bytea)
to trustleaf_server;

comment on function trustleaf_private.bootstrap_first_synthetic_admin(uuid, bytea)
is 'One-time synthetic first-admin ceremony. Direct approved operator only; not an Auth/API enrollment path.';

commit;
