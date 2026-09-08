begin;

alter table public.trustleaf_central_calendar add column calendar_id text;
alter table public.trustleaf_central_calendar add column setup_started boolean not null default false;

create table trustleaf_private.calendar_booking_jobs (
  booking_ref uuid primary key references trustleaf_private.appointment_bookings(booking_ref),
  revision bigint not null default 1,
  desired_state text not null check (desired_state in ('confirmed','cancelled')),
  state text not null default 'pending' check (state in ('pending','working','ready','cancelled','error')),
  lease_id uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  meet_url text,
  error_code text,
  updated_at timestamptz not null default now()
);
alter table trustleaf_private.calendar_booking_jobs enable row level security;
revoke all on trustleaf_private.calendar_booking_jobs from public, anon, authenticated;

create function trustleaf_private.queue_calendar_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.state = old.state then return new; end if;
  insert into trustleaf_private.calendar_booking_jobs(booking_ref, desired_state)
    values(new.booking_ref, new.state::text)
  on conflict (booking_ref) do update set
    revision = trustleaf_private.calendar_booking_jobs.revision + 1,
    desired_state = excluded.desired_state,
    state = 'pending', meet_url = null, error_code = null,
    next_attempt_at = now(), updated_at = now();
  -- Preserve an in-flight lease so cancellation cannot race an event insertion.
  return new;
end $$;
revoke all on function trustleaf_private.queue_calendar_booking() from public, anon, authenticated;
create trigger calendar_booking_outbox after insert or update of state
  on trustleaf_private.appointment_bookings for each row
  execute function trustleaf_private.queue_calendar_booking();

create function public.trustleaf_calendar_job(p_action text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job trustleaf_private.calendar_booking_jobs%rowtype; v_result jsonb;
begin
  if p_action = 'list' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
      select j.booking_ref,j.state,j.desired_state,j.attempts,j.error_code,j.updated_at,s.starts_at,s.ends_at
      from trustleaf_private.calendar_booking_jobs j
      join trustleaf_private.appointment_bookings b using(booking_ref)
      join trustleaf_private.availability_slots s using(slot_ref)
      order by j.updated_at desc limit 100
    ) q;
    return v_result;
  elsif p_action = 'setup-claim' then
    update public.trustleaf_central_calendar set setup_started=true
      where singleton and calendar_id is null and not setup_started
      returning jsonb_build_object('claimed',true,'refresh_ciphertext',refresh_ciphertext) into v_result;
    return v_result;
  elsif p_action = 'setup-save' then
    if coalesce(p_input->>'calendarId','')='' then raise exception 'CALENDAR_ID_REQUIRED'; end if;
    update public.trustleaf_central_calendar set calendar_id=p_input->>'calendarId'
      where singleton and setup_started and calendar_id is null;
    if not found then raise exception 'CALENDAR_SETUP_CONFLICT'; end if;
    return jsonb_build_object('saved',true);
  elsif p_action = 'credentials' then
    select jsonb_build_object('refresh_ciphertext',c.refresh_ciphertext,'calendar_id',c.calendar_id)
      into v_result from public.trustleaf_central_calendar c where c.singleton;
    return v_result;
  elsif p_action = 'booking' then
    select jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at,
      'doctor_subject',di.external_subject,'patient_subject',pi.external_subject) into v_result
      from trustleaf_private.calendar_booking_jobs j
      join trustleaf_private.appointment_bookings b using(booking_ref)
      join trustleaf_private.availability_slots s using(slot_ref)
      join trustleaf_private.external_identity_bindings di on di.actor_ref=s.doctor_actor_ref
        and di.provider='privy' and di.state='active'
      join trustleaf_private.external_identity_bindings pi on pi.actor_ref=b.patient_actor_ref
        and pi.provider='privy' and pi.state='active'
      join trustleaf_private.actor_bindings d on d.actor_ref=s.doctor_actor_ref
      join trustleaf_private.actor_bindings p on p.actor_ref=b.patient_actor_ref
      where j.booking_ref=(p_input->>'bookingRef')::uuid and j.lease_id=(p_input->>'leaseId')::uuid
        and j.revision=(p_input->>'revision')::bigint and j.lease_until>now()
        and b.state='confirmed' and d.state='active' and p.state='active'
        and (d.valid_until is null or d.valid_until>now()) and (p.valid_until is null or p.valid_until>now());
    if v_result is null then raise exception 'CALENDAR_BOOKING_UNAVAILABLE' using errcode='42501'; end if;
    return v_result;
  elsif p_action = 'claim' then
    select * into v_job from trustleaf_private.calendar_booking_jobs j
      where j.state in ('pending','working','error') and j.next_attempt_at <= now()
      and (j.lease_until is null or j.lease_until <= now())
      order by j.next_attempt_at, j.booking_ref for update skip locked limit 1;
    if not found then return null; end if;
    update trustleaf_private.calendar_booking_jobs set state='working',
      lease_id=gen_random_uuid(), lease_until=now()+interval '2 minutes', attempts=attempts+1
      where booking_ref=v_job.booking_ref returning * into v_job;
    return to_jsonb(v_job);
  elsif p_action = 'finish' then
    select * into v_job from trustleaf_private.calendar_booking_jobs j
      where j.booking_ref=(p_input->>'bookingRef')::uuid
      and j.lease_id=(p_input->>'leaseId')::uuid and j.lease_until>now() for update;
    if not found then raise exception 'CALENDAR_LEASE_INVALID' using errcode='40001'; end if;
    if p_input->>'state' not in ('pending','ready','cancelled','error') or p_input->>'state' is null then
      raise exception 'CALENDAR_RESULT_INVALID' using errcode='22023';
    end if;
    if p_input->>'meetUrl' is not null and p_input->>'meetUrl' !~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$' then
      raise exception 'CALENDAR_URL_INVALID' using errcode='22023';
    end if;
    update trustleaf_private.calendar_booking_jobs set
      state=case when revision=(p_input->>'revision')::bigint then p_input->>'state' else 'pending' end,
      meet_url=case when revision=(p_input->>'revision')::bigint and desired_state='confirmed'
        and p_input->>'state'='ready' then p_input->>'meetUrl' else null end,
      error_code=case when p_input->>'state'='error' then 'CALENDAR_SYNC_FAILED' else null end,
      lease_id=null, lease_until=null,
      next_attempt_at=now()+case when revision<>(p_input->>'revision')::bigint then interval '0 seconds'
        when p_input->>'state'='error' then interval '30 seconds' * least(120, greatest(1, attempts))
        else interval '30 seconds' end, updated_at=now()
      where booking_ref=v_job.booking_ref;
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'CALENDAR_ACTION_INVALID' using errcode='22023';
end $$;
revoke all on function public.trustleaf_calendar_job(text,jsonb) from public, anon, authenticated;
grant execute on function public.trustleaf_calendar_job(text,jsonb) to service_role;

create function public.trustleaf_calendar_participant(p_subject text, p_booking_refs uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor record; v_result jsonb;
begin
  select * into v_actor from trustleaf_private.resolve_privy_actor(p_subject);
  if not found or v_actor.actor_state<>'active' or v_actor.role not in ('doctor','patient')
    or (v_actor.valid_until is not null and v_actor.valid_until<=now()) then
    raise exception 'CALENDAR_FORBIDDEN' using errcode='42501';
  end if;
  if cardinality(p_booking_refs)>200 then raise exception 'CALENDAR_RANGE_INVALID' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('bookingRef',b.booking_ref,'state',j.state,
    'meetUrl',case when b.state='confirmed' and j.state='ready' then j.meet_url else null end)),'[]'::jsonb)
    into v_result from trustleaf_private.appointment_bookings b
    join trustleaf_private.availability_slots s using(slot_ref)
    left join trustleaf_private.calendar_booking_jobs j using(booking_ref)
    where b.booking_ref=any(p_booking_refs) and
      ((v_actor.role='doctor' and s.doctor_actor_ref=v_actor.actor_ref) or
       (v_actor.role='patient' and b.patient_actor_ref=v_actor.actor_ref));
  return v_result;
end $$;
revoke all on function public.trustleaf_calendar_participant(text,uuid[]) from public,anon,authenticated;
grant execute on function public.trustleaf_calendar_participant(text,uuid[]) to service_role;
commit;
