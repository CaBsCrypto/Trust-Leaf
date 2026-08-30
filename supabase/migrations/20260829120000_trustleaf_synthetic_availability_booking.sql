-- PREPARED LOCALLY ONLY. Synthetic availability/reservation increment; no PII/PHI.
-- Requires the baseline and Auth/RBAC migration. Direct table access remains denied.
begin;

create type trustleaf_private.availability_state as enum ('published', 'booked', 'cancelled');
create type trustleaf_private.booking_state as enum ('confirmed', 'cancelled');

create table trustleaf_private.availability_slots (
  slot_ref uuid primary key,
  doctor_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state trustleaf_private.availability_state not null default 'published',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  check (starts_at < ends_at and ends_at - starts_at <= interval '8 hours')
);

create table trustleaf_private.appointment_bookings (
  booking_ref uuid primary key,
  slot_ref uuid not null unique references trustleaf_private.availability_slots(slot_ref),
  patient_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  state trustleaf_private.booking_state not null default 'confirmed',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp()
);

alter table trustleaf_private.availability_slots enable row level security;
alter table trustleaf_private.availability_slots force row level security;
alter table trustleaf_private.appointment_bookings enable row level security;
alter table trustleaf_private.appointment_bookings force row level security;
revoke all on trustleaf_private.availability_slots, trustleaf_private.appointment_bookings from public, anon, authenticated, service_role;

create policy availability_slots_select_participant_or_admin on trustleaf_private.availability_slots for select to authenticated using (
  doctor_actor_ref = trustleaf_private.current_actor_ref() or trustleaf_private.current_actor_has_role('admin')
  or (state = 'published' and trustleaf_private.current_actor_has_role('patient'))
);
create policy appointment_bookings_select_participant_or_admin on trustleaf_private.appointment_bookings for select to authenticated using (
  patient_actor_ref = trustleaf_private.current_actor_ref() or exists (select 1 from trustleaf_private.availability_slots s where s.slot_ref = appointment_bookings.slot_ref and s.doctor_actor_ref = trustleaf_private.current_actor_ref()) or trustleaf_private.current_actor_has_role('admin')
);
grant select on trustleaf_private.availability_slots, trustleaf_private.appointment_bookings to authenticated;

create function trustleaf_private.publish_availability(slot_ref uuid, starts_at timestamptz, ends_at timestamptz, operation_digest bytea)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := trustleaf_private.current_actor_ref(); intent bytea; previous_intent bytea; prior uuid; previous_audit bytea; event_digest bytea;
begin
  if actor is null or not trustleaf_private.current_actor_has_role('doctor') then raise exception 'DOCTOR_REQUIRED' using errcode = '42501'; end if;
  if slot_ref is null or starts_at >= ends_at or ends_at - starts_at > interval '8 hours' or operation_digest is null or octet_length(operation_digest) <> 32 then raise exception 'AVAILABILITY_INPUT_INVALID' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(slot_ref::text, 0));
  intent := pg_catalog.sha256(pg_catalog.convert_to(actor::text || '|' || slot_ref::text || '|' || starts_at::text || '|' || ends_at::text, 'UTF8'));
  select intent_digest, outcome_ref into previous_intent, prior from trustleaf_private.idempotency_journal where idempotency_journal.operation_digest = publish_availability.operation_digest;
  if found then if previous_intent <> intent then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505'; end if; return prior; end if;
  insert into trustleaf_private.availability_slots(slot_ref, doctor_actor_ref, starts_at, ends_at) values(slot_ref, actor, starts_at, ends_at);
  perform pg_catalog.pg_advisory_xact_lock(42826001); select event_digest into previous_audit from trustleaf_private.audit_events order by audit_seq desc limit 1;
  event_digest := pg_catalog.sha256(coalesce(previous_audit, '\x'::bytea) || operation_digest || pg_catalog.convert_to('availability.published|' || slot_ref::text, 'UTF8'));
  insert into trustleaf_private.audit_events(actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest) values(actor, 'availability.published', slot_ref, 'allowed', previous_audit, event_digest);
  insert into trustleaf_private.idempotency_journal(operation_digest, actor_ref, intent_digest, outcome_ref) values(operation_digest, actor, intent, slot_ref); return slot_ref;
end $$;

create function trustleaf_private.reserve_availability(slot_ref uuid, booking_ref uuid, expected_slot_version bigint, operation_digest bytea)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := trustleaf_private.current_actor_ref(); slot_record trustleaf_private.availability_slots%rowtype; intent bytea; previous_intent bytea; prior uuid; previous_audit bytea; event_digest bytea;
begin
  if actor is null or not trustleaf_private.current_actor_has_role('patient') then raise exception 'PATIENT_REQUIRED' using errcode = '42501'; end if;
  if slot_ref is null or booking_ref is null or expected_slot_version < 1 or operation_digest is null or octet_length(operation_digest) <> 32 then raise exception 'BOOKING_INPUT_INVALID' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(slot_ref::text, 0)); intent := pg_catalog.sha256(pg_catalog.convert_to(actor::text || '|' || slot_ref::text || '|' || booking_ref::text || '|' || expected_slot_version::text, 'UTF8'));
  select intent_digest, outcome_ref into previous_intent, prior from trustleaf_private.idempotency_journal where idempotency_journal.operation_digest = reserve_availability.operation_digest;
  if found then if previous_intent <> intent then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505'; end if; return prior; end if;
  select * into slot_record from trustleaf_private.availability_slots where availability_slots.slot_ref = reserve_availability.slot_ref for update;
  if not found or slot_record.state <> 'published' or slot_record.version <> expected_slot_version then raise exception 'AVAILABILITY_CAS_CONFLICT' using errcode = '40001'; end if;
  insert into trustleaf_private.appointment_bookings(booking_ref, slot_ref, patient_actor_ref) values(booking_ref, slot_ref, actor); update trustleaf_private.availability_slots set state = 'booked', version = version + 1 where availability_slots.slot_ref = reserve_availability.slot_ref and version = expected_slot_version;
  perform pg_catalog.pg_advisory_xact_lock(42826001); select event_digest into previous_audit from trustleaf_private.audit_events order by audit_seq desc limit 1;
  event_digest := pg_catalog.sha256(coalesce(previous_audit, '\x'::bytea) || operation_digest || pg_catalog.convert_to('appointment.booked|' || booking_ref::text, 'UTF8'));
  insert into trustleaf_private.audit_events(actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest) values(actor, 'appointment.booked', booking_ref, 'allowed', previous_audit, event_digest);
  insert into trustleaf_private.idempotency_journal(operation_digest, actor_ref, intent_digest, outcome_ref) values(operation_digest, actor, intent, booking_ref); return booking_ref;
end $$;

revoke all on function trustleaf_private.publish_availability(uuid, timestamptz, timestamptz, bytea), trustleaf_private.reserve_availability(uuid, uuid, bigint, bytea) from public, anon, service_role;
grant execute on function trustleaf_private.publish_availability(uuid, timestamptz, timestamptz, bytea), trustleaf_private.reserve_availability(uuid, uuid, bigint, bytea) to authenticated;
comment on table trustleaf_private.availability_slots is 'Synthetic technical time windows only; no contact or clinical data.';
comment on table trustleaf_private.appointment_bookings is 'Synthetic opaque reservation linkage only; no clinical encounter.';
commit;
