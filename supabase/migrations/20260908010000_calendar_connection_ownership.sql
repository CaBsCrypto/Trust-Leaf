begin;
alter table public.trustleaf_central_calendar add column connection_ref uuid not null default gen_random_uuid();
create table trustleaf_private.calendar_connections (
  connection_ref uuid primary key,
  connected_by text not null,
  refresh_ciphertext text not null,
  calendar_id text not null
);
create table trustleaf_private.calendar_candidate (
  singleton boolean primary key default true check(singleton),
  connection_ref uuid not null default gen_random_uuid(),
  connected_by text not null,
  refresh_ciphertext text not null,
  setup_started boolean not null default false
);
alter table trustleaf_private.calendar_connections enable row level security;
alter table trustleaf_private.calendar_candidate enable row level security;
revoke all on trustleaf_private.calendar_connections,trustleaf_private.calendar_candidate from public,anon,authenticated;
insert into trustleaf_private.calendar_connections
  select connection_ref,connected_by,refresh_ciphertext,calendar_id from public.trustleaf_central_calendar where calendar_id is not null;
alter table trustleaf_private.calendar_booking_jobs add column connection_ref uuid references trustleaf_private.calendar_connections;
update trustleaf_private.calendar_booking_jobs set connection_ref=(select connection_ref from public.trustleaf_central_calendar where calendar_id is not null);
create function trustleaf_private.bind_calendar_connection() returns trigger language plpgsql security definer set search_path='' as $$
begin
  select connection_ref into new.connection_ref from public.trustleaf_central_calendar where calendar_id is not null;
  return new;
end $$;
revoke all on function trustleaf_private.bind_calendar_connection() from public,anon,authenticated;
create trigger calendar_connection_owner before insert on trustleaf_private.calendar_booking_jobs
  for each row execute function trustleaf_private.bind_calendar_connection();

alter function public.trustleaf_central_calendar_connection(text,text,text,text) rename to trustleaf_central_calendar_connection_legacy;
revoke all on function public.trustleaf_central_calendar_connection_legacy(text,text,text,text) from public,anon,authenticated,service_role;
create function public.trustleaf_central_calendar_connection(p_action text,p_subject text,p_key text,p_value text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_action='save' then
    if not exists(select 1 from public.trustleaf_resolve_privy_actor(p_subject) a where a.role='admin' and a.actor_state='active'
      and (a.valid_until is null or a.valid_until>now())) then raise exception 'Admin required' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(709080100);
    if exists(select 1 from trustleaf_private.calendar_candidate where setup_started) then raise exception 'CALENDAR_SETUP_REVIEW_REQUIRED'; end if;
    insert into trustleaf_private.calendar_candidate(singleton,connected_by,refresh_ciphertext) values(true,p_subject,p_value)
      on conflict(singleton) do update set connection_ref=gen_random_uuid(),connected_by=excluded.connected_by,refresh_ciphertext=excluded.refresh_ciphertext;
    return '{}'::jsonb;
  elsif p_action='status' then
    perform public.trustleaf_central_calendar_connection_legacy(p_action,p_subject,p_key,p_value);
    return jsonb_build_object('connected',exists(select 1 from public.trustleaf_central_calendar where calendar_id is not null),
      'candidatePending',exists(select 1 from trustleaf_private.calendar_candidate));
  end if;
  return public.trustleaf_central_calendar_connection_legacy(p_action,p_subject,p_key,p_value);
end $$;
revoke all on function public.trustleaf_central_calendar_connection(text,text,text,text) from public,anon,authenticated;
grant execute on function public.trustleaf_central_calendar_connection(text,text,text,text) to service_role;

alter function public.trustleaf_calendar_job(text,jsonb) rename to trustleaf_calendar_job_legacy;
revoke all on function public.trustleaf_calendar_job_legacy(text,jsonb) from public,anon,authenticated,service_role;
create function public.trustleaf_calendar_job(p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; candidate trustleaf_private.calendar_candidate%rowtype; job trustleaf_private.calendar_booking_jobs%rowtype;
begin
  if p_action='setup-credentials' then
    select to_jsonb(c) into result from trustleaf_private.calendar_candidate c;
    if result is null then select to_jsonb(c) into result from public.trustleaf_central_calendar c; end if;
    return result;
  elsif p_action='setup-claim' then
    perform pg_advisory_xact_lock(709080100);
    update trustleaf_private.calendar_candidate set setup_started=true
      where connection_ref=(p_input->>'connectionRef')::uuid and not setup_started
      returning jsonb_build_object('claimed',true) into result;
    return result;
  elsif p_action='setup-save' then
    perform pg_advisory_xact_lock(709080100);
    select * into candidate from trustleaf_private.calendar_candidate where connection_ref=(p_input->>'connectionRef')::uuid and setup_started for update;
    if not found or coalesce(p_input->>'calendarId','')='' then raise exception 'CALENDAR_SETUP_CONFLICT'; end if;
    insert into trustleaf_private.calendar_connections values(candidate.connection_ref,candidate.connected_by,candidate.refresh_ciphertext,p_input->>'calendarId');
    insert into public.trustleaf_central_calendar(singleton,connected_by,refresh_ciphertext,calendar_id,setup_started,connection_ref)
      values(true,candidate.connected_by,candidate.refresh_ciphertext,p_input->>'calendarId',true,candidate.connection_ref)
      on conflict(singleton) do update set connected_by=excluded.connected_by,refresh_ciphertext=excluded.refresh_ciphertext,
        calendar_id=excluded.calendar_id,setup_started=true,connection_ref=excluded.connection_ref,updated_at=now();
    delete from trustleaf_private.calendar_candidate where connection_ref=candidate.connection_ref;
    return jsonb_build_object('saved',true);
  elsif p_action='job-credentials' then
    select * into job from trustleaf_private.calendar_booking_jobs where booking_ref=(p_input->>'bookingRef')::uuid
      and lease_id=(p_input->>'leaseId')::uuid and lease_until>now() for update;
    if not found then raise exception 'CALENDAR_LEASE_INVALID' using errcode='42501'; end if;
    if job.connection_ref is null then
      select connection_ref into job.connection_ref from public.trustleaf_central_calendar where calendar_id is not null;
      update trustleaf_private.calendar_booking_jobs set connection_ref=job.connection_ref where booking_ref=job.booking_ref;
    end if;
    select to_jsonb(c) into result from trustleaf_private.calendar_connections c where c.connection_ref=job.connection_ref;
    return result;
  end if;
  return public.trustleaf_calendar_job_legacy(p_action,p_input);
end $$;
revoke all on function public.trustleaf_calendar_job(text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_calendar_job(text,jsonb) to service_role;
commit;
