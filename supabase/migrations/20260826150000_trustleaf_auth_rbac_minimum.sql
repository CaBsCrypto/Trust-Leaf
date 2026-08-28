-- TrustLeaf synthetic Auth/RBAC increment. PREPARED LOCALLY; DO NOT APPLY
-- without a separate human gate. No PII/PHI, clinical payload or real actor.

begin;

alter table trustleaf_private.idempotency_journal
  add constraint idempotency_journal_actor_fk
  foreign key (actor_ref) references trustleaf_private.actor_bindings(actor_ref);

create function trustleaf_private.current_actor_ref()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select actor_ref
  from trustleaf_private.actor_bindings
  where auth_subject = (select auth.uid())
    and state = 'active'
    and (valid_until is null or valid_until > statement_timestamp())
  limit 1
$$;

create function trustleaf_private.current_actor_has_role(expected_role trustleaf_private.actor_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from trustleaf_private.actor_bindings
    where auth_subject = (select auth.uid())
      and role = expected_role
      and state = 'active'
      and (valid_until is null or valid_until > statement_timestamp())
  )
$$;

create function trustleaf_private.current_actor_can_read_object(target_object_ref uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from trustleaf_private.encrypted_objects object_record
    where object_record.object_ref = target_object_ref
      and (
        object_record.owner_actor_ref = trustleaf_private.current_actor_ref()
        or exists (
          select 1
          from trustleaf_private.relationship_grants grant_record
          where grant_record.object_ref = object_record.object_ref
            and grant_record.grantee_actor_ref = trustleaf_private.current_actor_ref()
            and grant_record.state = 'active'
            and (grant_record.valid_until is null or grant_record.valid_until > statement_timestamp())
        )
      )
  )
$$;

create function trustleaf_private.current_actor_can_read_receipt(target_receipt_ref uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from trustleaf_private.receipt_bindings receipt_record
    where receipt_record.receipt_ref = target_receipt_ref
      and (
        receipt_record.patient_actor_ref = trustleaf_private.current_actor_ref()
        or receipt_record.doctor_actor_ref = trustleaf_private.current_actor_ref()
        or trustleaf_private.current_actor_has_role('admin')
        or (
          trustleaf_private.current_actor_has_role('dispensary')
          and exists (
            select 1
            from trustleaf_private.relationship_grants grant_record
            where grant_record.object_ref = receipt_record.encrypted_detail_ref
              and grant_record.grantee_actor_ref = trustleaf_private.current_actor_ref()
              and grant_record.scope in ('receipt:read', 'receipt:operate')
              and grant_record.state = 'active'
              and (grant_record.valid_until is null or grant_record.valid_until > statement_timestamp())
          )
        )
      )
  )
$$;

revoke all on function trustleaf_private.current_actor_ref() from public, anon, service_role;
revoke all on function trustleaf_private.current_actor_has_role(trustleaf_private.actor_role) from public, anon, service_role;
revoke all on function trustleaf_private.current_actor_can_read_object(uuid) from public, anon, service_role;
revoke all on function trustleaf_private.current_actor_can_read_receipt(uuid) from public, anon, service_role;

create policy actor_bindings_select_own_or_admin
on trustleaf_private.actor_bindings
for select
to authenticated
using (
  auth_subject = (select auth.uid())
  or trustleaf_private.current_actor_has_role('admin')
);

create policy encrypted_objects_select_authorized
on trustleaf_private.encrypted_objects
for select
to authenticated
using (trustleaf_private.current_actor_can_read_object(object_ref));

create policy relationship_grants_select_participant_or_admin
on trustleaf_private.relationship_grants
for select
to authenticated
using (
  subject_actor_ref = trustleaf_private.current_actor_ref()
  or grantee_actor_ref = trustleaf_private.current_actor_ref()
  or trustleaf_private.current_actor_has_role('admin')
);

create policy patient_entitlements_select_participant_or_admin
on trustleaf_private.patient_entitlements
for select
to authenticated
using (
  patient_actor_ref = trustleaf_private.current_actor_ref()
  or doctor_actor_ref = trustleaf_private.current_actor_ref()
  or trustleaf_private.current_actor_has_role('admin')
);

create policy receipt_bindings_select_authorized
on trustleaf_private.receipt_bindings
for select
to authenticated
using (trustleaf_private.current_actor_can_read_receipt(receipt_ref));

create policy audit_events_select_self_or_admin
on trustleaf_private.audit_events
for select
to authenticated
using (
  actor_ref = trustleaf_private.current_actor_ref()
  or trustleaf_private.current_actor_has_role('admin')
);

create policy audit_events_select_technical_auditor
on trustleaf_private.audit_events
for select
to trustleaf_auditor
using (true);

create policy idempotency_journal_select_self_or_admin
on trustleaf_private.idempotency_journal
for select
to authenticated
using (
  actor_ref = trustleaf_private.current_actor_ref()
  or trustleaf_private.current_actor_has_role('admin')
);

grant usage on schema trustleaf_private to authenticated, trustleaf_auditor;
grant select on trustleaf_private.actor_bindings to authenticated;
grant select on trustleaf_private.encrypted_objects to authenticated;
grant select on trustleaf_private.relationship_grants to authenticated;
grant select on trustleaf_private.patient_entitlements to authenticated;
grant select on trustleaf_private.receipt_bindings to authenticated;
grant select on trustleaf_private.audit_events to authenticated, trustleaf_auditor;
grant select on trustleaf_private.idempotency_journal to authenticated;

grant execute on function trustleaf_private.current_actor_ref() to authenticated;
grant execute on function trustleaf_private.current_actor_has_role(trustleaf_private.actor_role) to authenticated;
grant execute on function trustleaf_private.current_actor_can_read_object(uuid) to authenticated;
grant execute on function trustleaf_private.current_actor_can_read_receipt(uuid) to authenticated;

create function trustleaf_private.request_actor_enrollment(
  requested_role trustleaf_private.actor_role,
  operation_digest bytea
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_subject uuid := auth.uid();
  new_actor_ref uuid;
  intent_digest bytea;
  previous_intent bytea;
  previous_outcome uuid;
  previous_audit_digest bytea;
  new_audit_digest bytea;
begin
  if caller_subject is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if requested_role = 'admin' then
    raise exception 'ADMIN_ENROLLMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if operation_digest is null or octet_length(operation_digest) <> 32 then
    raise exception 'IDEMPOTENCY_DIGEST_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_subject::text, 0));
  intent_digest := pg_catalog.sha256(pg_catalog.convert_to(caller_subject::text || '|' || requested_role::text, 'UTF8'));

  select journal.intent_digest, journal.outcome_ref
  into previous_intent, previous_outcome
  from trustleaf_private.idempotency_journal journal
  where journal.operation_digest = request_actor_enrollment.operation_digest;
  if found then
    if previous_intent <> intent_digest then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return previous_outcome;
  end if;

  if exists (select 1 from trustleaf_private.actor_bindings where auth_subject = caller_subject) then
    raise exception 'ACTOR_ALREADY_ENROLLED' using errcode = '23505';
  end if;

  new_actor_ref := pg_catalog.gen_random_uuid();
  insert into trustleaf_private.actor_bindings (actor_ref, auth_subject, role, state)
  values (new_actor_ref, caller_subject, requested_role, 'pending');

  -- One global transaction advisory lock keeps the append-only digest chain linear.
  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into previous_audit_digest
  from trustleaf_private.audit_events order by audit_seq desc limit 1;
  new_audit_digest := pg_catalog.sha256(
    coalesce(previous_audit_digest, '\x'::bytea)
    || operation_digest
    || pg_catalog.convert_to('actor.enrollment.requested|' || new_actor_ref::text, 'UTF8')
  );
  insert into trustleaf_private.audit_events (
    actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest
  ) values (
    new_actor_ref, 'actor.enrollment.requested', new_actor_ref, 'allowed', previous_audit_digest, new_audit_digest
  );
  insert into trustleaf_private.idempotency_journal (
    operation_digest, actor_ref, intent_digest, outcome_ref
  ) values (operation_digest, new_actor_ref, intent_digest, new_actor_ref);
  return new_actor_ref;
end
$$;

create function trustleaf_private.admin_set_actor_state(
  target_actor_ref uuid,
  expected_version bigint,
  next_state trustleaf_private.lifecycle_state,
  operation_digest bytea
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_actor_ref uuid;
  target_record trustleaf_private.actor_bindings%rowtype;
  intent_digest bytea;
  previous_intent bytea;
  previous_outcome uuid;
  previous_audit_digest bytea;
  new_audit_digest bytea;
begin
  caller_actor_ref := trustleaf_private.current_actor_ref();
  if caller_actor_ref is null or not trustleaf_private.current_actor_has_role('admin') then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if target_actor_ref is null or expected_version < 1
    or next_state not in ('active', 'suspended', 'revoked') then
    raise exception 'ACTOR_TRANSITION_INVALID' using errcode = '22023';
  end if;
  if target_actor_ref = caller_actor_ref then
    raise exception 'SELF_ADMIN_LOCKOUT_FORBIDDEN' using errcode = '42501';
  end if;
  if operation_digest is null or octet_length(operation_digest) <> 32 then
    raise exception 'IDEMPOTENCY_DIGEST_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_actor_ref::text, 0));
  intent_digest := pg_catalog.sha256(pg_catalog.convert_to(
    caller_actor_ref::text || '|' || target_actor_ref::text || '|' || expected_version::text || '|' || next_state::text,
    'UTF8'
  ));
  select journal.intent_digest, journal.outcome_ref
  into previous_intent, previous_outcome
  from trustleaf_private.idempotency_journal journal
  where journal.operation_digest = admin_set_actor_state.operation_digest;
  if found then
    if previous_intent <> intent_digest then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return previous_outcome;
  end if;

  select * into target_record
  from trustleaf_private.actor_bindings
  where actor_ref = target_actor_ref
  for update;
  if not found or target_record.role = 'admin' or target_record.version <> expected_version then
    raise exception 'ACTOR_CAS_CONFLICT' using errcode = '40001';
  end if;
  if not (
    (target_record.state = 'pending' and next_state in ('active', 'revoked'))
    or (target_record.state = 'active' and next_state in ('suspended', 'revoked'))
    or (target_record.state = 'suspended' and next_state in ('active', 'revoked'))
  ) then
    raise exception 'ACTOR_TRANSITION_FORBIDDEN' using errcode = '42501';
  end if;

  update trustleaf_private.actor_bindings
  set state = next_state, version = version + 1, updated_at = statement_timestamp()
  where actor_ref = target_actor_ref and version = expected_version;
  if not found then
    raise exception 'ACTOR_CAS_CONFLICT' using errcode = '40001';
  end if;

  -- One global transaction advisory lock keeps the append-only digest chain linear.
  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into previous_audit_digest
  from trustleaf_private.audit_events order by audit_seq desc limit 1;
  new_audit_digest := pg_catalog.sha256(
    coalesce(previous_audit_digest, '\x'::bytea)
    || operation_digest
    || pg_catalog.convert_to('actor.state.changed|' || target_actor_ref::text || '|' || next_state::text, 'UTF8')
  );
  insert into trustleaf_private.audit_events (
    actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest
  ) values (
    caller_actor_ref, 'actor.state.changed', target_actor_ref, 'allowed', previous_audit_digest, new_audit_digest
  );
  insert into trustleaf_private.idempotency_journal (
    operation_digest, actor_ref, intent_digest, outcome_ref
  ) values (operation_digest, caller_actor_ref, intent_digest, target_actor_ref);
  return target_actor_ref;
end
$$;

revoke all on function trustleaf_private.request_actor_enrollment(trustleaf_private.actor_role, bytea)
from public, anon, service_role;
revoke all on function trustleaf_private.admin_set_actor_state(uuid, bigint, trustleaf_private.lifecycle_state, bytea)
from public, anon, service_role;
grant execute on function trustleaf_private.request_actor_enrollment(trustleaf_private.actor_role, bytea)
to authenticated;
grant execute on function trustleaf_private.admin_set_actor_state(uuid, bigint, trustleaf_private.lifecycle_state, bytea)
to authenticated;

comment on function trustleaf_private.request_actor_enrollment(trustleaf_private.actor_role, bytea)
is 'Synthetic self-enrollment only; admin cannot be self-assigned. Requires auth.uid and idempotency digest.';
comment on function trustleaf_private.admin_set_actor_state(uuid, bigint, trustleaf_private.lifecycle_state, bytea)
is 'Synthetic operator transition with durable admin binding, CAS, idempotency and append-only audit.';

commit;
