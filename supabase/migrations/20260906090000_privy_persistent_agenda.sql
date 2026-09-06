begin;

-- Prevent the old Auth-based writers from bypassing the shared overlap locks.
revoke execute on function trustleaf_private.publish_availability(uuid,timestamptz,timestamptz,bytea),
  trustleaf_private.reserve_availability(uuid,uuid,bigint,bytea) from authenticated;

-- Preserve cancelled bookings while allowing a released slot to be booked again.
alter table trustleaf_private.appointment_bookings drop constraint appointment_bookings_slot_ref_key;
create unique index appointment_one_confirmed_per_slot on trustleaf_private.appointment_bookings(slot_ref) where state = 'confirmed';
create index availability_doctor_window on trustleaf_private.availability_slots(doctor_actor_ref, starts_at);

create function public.trustleaf_privy_agenda(p_subject text, p_action text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record; v_slot trustleaf_private.availability_slots%rowtype;
  v_booking trustleaf_private.appointment_bookings%rowtype;
  v_ref uuid; v_booking_ref uuid; v_start timestamptz; v_end timestamptz;
  v_version bigint; v_operation bytea; v_intent bytea; v_prior record;
  v_previous bytea; v_digest bytea; v_result jsonb; v_rows jsonb;
begin
  select * into v_actor from trustleaf_private.resolve_privy_actor(p_subject);
  if not found or v_actor.actor_state <> 'active' or v_actor.role not in ('doctor','patient')
    or (v_actor.valid_until is not null and v_actor.valid_until <= statement_timestamp()) then
    raise exception 'AGENDA_FORBIDDEN' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('list','publish','reserve','cancel-slot','cancel-booking')
    or p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'AGENDA_INPUT_INVALID' using errcode = '22023';
  end if;

  if p_action = 'list' then
    v_start := (p_input->>'from')::timestamptz; v_end := (p_input->>'to')::timestamptz;
    if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end)
      or v_end <= v_start or v_end - v_start > interval '31 days' then
      raise exception 'AGENDA_RANGE_INVALID' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(q.row order by q.starts_at, q.slot_ref), '[]'::jsonb) into v_rows from (
      select s.starts_at, s.slot_ref, jsonb_build_object(
        'slotRef',s.slot_ref,'doctorRef',s.doctor_actor_ref,'startsAt',s.starts_at,'endsAt',s.ends_at,
        'state',s.state,'version',s.version,
        'bookingRef',b.booking_ref,'bookingVersion',b.version,'bookingState',b.state
      ) as row
      from trustleaf_private.availability_slots s
      join trustleaf_private.actor_bindings d on d.actor_ref=s.doctor_actor_ref
      left join lateral (
        select ab.* from trustleaf_private.appointment_bookings ab where ab.slot_ref=s.slot_ref
          and (v_actor.role='doctor' or ab.patient_actor_ref=v_actor.actor_ref)
        order by (ab.state='confirmed') desc,ab.created_at desc,ab.booking_ref limit 1
      ) b on true
      where s.starts_at >= v_start and s.starts_at < v_end and (
        (v_actor.role='doctor' and s.doctor_actor_ref=v_actor.actor_ref) or
        (v_actor.role='patient' and (
          (s.state='published' and s.starts_at > statement_timestamp() and d.state='active'
            and (d.valid_until is null or d.valid_until > statement_timestamp())) or b.patient_actor_ref=v_actor.actor_ref
        ))
      ) order by s.starts_at,s.slot_ref limit 201
    ) q;
    -- Refuse oversized windows rather than silently hide reservations.
    if jsonb_array_length(v_rows)>200 then raise exception 'AGENDA_RANGE_TOO_LARGE' using errcode='22023'; end if;
    return jsonb_build_object('role',v_actor.role,'slots',v_rows);
  end if;

  if coalesce(p_input->>'operationId','') !~ '^[a-zA-Z0-9_-]{16,128}$' then
    raise exception 'AGENDA_OPERATION_INVALID' using errcode='22023';
  end if;
  v_operation := pg_catalog.sha256(pg_catalog.convert_to('agenda|'||v_actor.actor_ref::text||'|'||(p_input->>'operationId'),'UTF8'));
  v_intent := pg_catalog.sha256(pg_catalog.convert_to(p_action||'|'||p_input::text,'UTF8'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(encode(v_operation,'hex'),0));
  select j.intent_digest,j.outcome_ref into v_prior from trustleaf_private.idempotency_journal j where j.operation_digest=v_operation;
  if found then
    if v_prior.intent_digest<>v_intent then raise exception 'AGENDA_REPLAY_CONFLICT' using errcode='40001'; end if;
    return jsonb_build_object('resourceRef',v_prior.outcome_ref,'replayed',true);
  end if;

  if p_action='publish' then
    if v_actor.role<>'doctor' then raise exception 'DOCTOR_REQUIRED' using errcode='42501'; end if;
    v_ref := (p_input->>'slotRef')::uuid;
    v_start := (p_input->>'startsAt')::timestamptz; v_end := (p_input->>'endsAt')::timestamptz;
    if v_ref is null or v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end)
      or v_start <= statement_timestamp() or v_start > statement_timestamp()+interval '1 year'
      or v_end <= v_start or v_end-v_start > interval '8 hours' then
      raise exception 'AGENDA_WINDOW_INVALID' using errcode='22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor.actor_ref::text,1));
    if exists(select 1 from trustleaf_private.availability_slots s where s.doctor_actor_ref=v_actor.actor_ref
      and s.state<>'cancelled' and s.starts_at<v_end and s.ends_at>v_start) then
      raise exception 'AGENDA_OVERLAP' using errcode='40001';
    end if;
    insert into trustleaf_private.availability_slots(slot_ref,doctor_actor_ref,starts_at,ends_at) values(v_ref,v_actor.actor_ref,v_start,v_end);
  else
    v_ref := (p_input->>'slotRef')::uuid; v_version := (p_input->>'version')::bigint;
    if v_ref is null or v_version is null or v_version<1 then raise exception 'AGENDA_INPUT_INVALID' using errcode='22023'; end if;
    select * into v_slot from trustleaf_private.availability_slots s where s.slot_ref=v_ref;
    if not found then raise exception 'AGENDA_CONFLICT' using errcode='40001'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_slot.doctor_actor_ref::text,1));
    select * into v_slot from trustleaf_private.availability_slots s where s.slot_ref=v_ref for update;
    if v_slot.version<>v_version or v_slot.starts_at<=statement_timestamp() then raise exception 'AGENDA_CONFLICT' using errcode='40001'; end if;
    if p_action='reserve' then
      if v_actor.role<>'patient' then raise exception 'PATIENT_REQUIRED' using errcode='42501'; end if;
      if v_slot.state<>'published' or not exists(select 1 from trustleaf_private.actor_bindings a
        where a.actor_ref=v_slot.doctor_actor_ref and a.state='active' and a.role='doctor'
        and (a.valid_until is null or a.valid_until>statement_timestamp())) then
        raise exception 'AGENDA_CONFLICT' using errcode='40001';
      end if;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor.actor_ref::text,2));
      if exists(select 1 from trustleaf_private.appointment_bookings b join trustleaf_private.availability_slots s using(slot_ref)
        where b.patient_actor_ref=v_actor.actor_ref and b.state='confirmed' and s.starts_at<v_slot.ends_at and s.ends_at>v_slot.starts_at) then
        raise exception 'AGENDA_OVERLAP' using errcode='40001';
      end if;
      v_booking_ref := (p_input->>'bookingRef')::uuid;
      if v_booking_ref is null then raise exception 'AGENDA_INPUT_INVALID' using errcode='22023'; end if;
      insert into trustleaf_private.appointment_bookings(booking_ref,slot_ref,patient_actor_ref) values(v_booking_ref,v_ref,v_actor.actor_ref);
      update trustleaf_private.availability_slots set state='booked',version=version+1 where slot_ref=v_ref;
    elsif p_action='cancel-slot' then
      if v_actor.role<>'doctor' or v_slot.doctor_actor_ref<>v_actor.actor_ref then raise exception 'AGENDA_FORBIDDEN' using errcode='42501'; end if;
      if v_slot.state<>'published' then raise exception 'AGENDA_CONFLICT' using errcode='40001'; end if;
      update trustleaf_private.availability_slots set state='cancelled',version=version+1 where slot_ref=v_ref;
    else
      select * into v_booking from trustleaf_private.appointment_bookings b where b.slot_ref=v_ref and b.state='confirmed' for update;
      if not found or v_booking.booking_ref is distinct from (p_input->>'bookingRef')::uuid then raise exception 'AGENDA_CONFLICT' using errcode='40001'; end if;
      if not ((v_actor.role='doctor' and v_slot.doctor_actor_ref=v_actor.actor_ref)
        or (v_actor.role='patient' and v_booking.patient_actor_ref=v_actor.actor_ref)) then raise exception 'AGENDA_FORBIDDEN' using errcode='42501'; end if;
      update trustleaf_private.appointment_bookings set state='cancelled',version=version+1 where booking_ref=v_booking.booking_ref;
      update trustleaf_private.availability_slots set state=case when v_actor.role='doctor' then 'cancelled'::trustleaf_private.availability_state else 'published'::trustleaf_private.availability_state end,version=version+1 where slot_ref=v_ref;
      v_booking_ref:=v_booking.booking_ref;
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select a.event_digest into v_previous from trustleaf_private.audit_events a order by a.audit_seq desc limit 1;
  v_digest:=pg_catalog.sha256(coalesce(v_previous,'\x'::bytea)||v_operation||v_intent);
  insert into trustleaf_private.audit_events(actor_ref,action_code,resource_ref,outcome,previous_digest,event_digest)
    values(v_actor.actor_ref,'agenda.'||p_action,coalesce(v_booking_ref,v_ref),'allowed',v_previous,v_digest);
  insert into trustleaf_private.idempotency_journal(operation_digest,actor_ref,intent_digest,outcome_ref)
    values(v_operation,v_actor.actor_ref,v_intent,coalesce(v_booking_ref,v_ref));
  return jsonb_build_object('resourceRef',coalesce(v_booking_ref,v_ref),'replayed',false);
end $$;
revoke all on function public.trustleaf_privy_agenda(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_privy_agenda(text,text,jsonb) to service_role;
commit;
