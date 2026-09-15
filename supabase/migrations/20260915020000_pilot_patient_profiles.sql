begin;

create table trustleaf_private.pilot_patient_profiles (
  patient_ref uuid primary key references trustleaf_private.pilot_participants(actor_ref),
  name text not null check (length(trim(name)) between 2 and 100),
  email text not null check (length(email) <= 160 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text not null check (length(trim(phone)) between 3 and 40),
  version integer not null default 1,
  updated_at timestamptz not null default statement_timestamp()
);
alter table trustleaf_private.pilot_patient_profiles enable row level security;
revoke all on trustleaf_private.pilot_patient_profiles from public,anon,authenticated,service_role;

alter function public.trustleaf_operations_pilot(text,text,jsonb) rename to pilot_before_profiles;
alter function public.pilot_before_profiles(text,text,jsonb) set schema trustleaf_private;
revoke all on function trustleaf_private.pilot_before_profiles(text,text,jsonb) from public,anon,authenticated,service_role;

create function public.trustleaf_operations_pilot(p_subject text,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; actor uuid; op uuid; prior record; intent_hash bytea; result jsonb; current_version integer;
begin
  if p_action='save-profile' then
    r := trustleaf_private.pilot_before_profiles(p_subject,'snapshot','{}');
    if r->>'role'<>'patient' or r->>'joined'<>'true' then raise exception 'PROFILE_FORBIDDEN' using errcode='42501'; end if;
    if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>12000
      or p_input->>'syntheticOnly' is distinct from 'true'
      or jsonb_typeof(p_input->'name') is distinct from 'string'
      or jsonb_typeof(p_input->'email') is distinct from 'string'
      or jsonb_typeof(p_input->'phone') is distinct from 'string' then raise exception 'PROFILE_INVALID' using errcode='22023'; end if;
    actor := (r->>'actorRef')::uuid;
    op := (p_input->>'operationId')::uuid;
    if op is null then raise exception 'OPERATION_REQUIRED' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('pilot-op|'||actor::text||op::text,0));
    intent_hash := sha256(convert_to(p_action||'|'||p_input::text,'UTF8'));
    select * into prior from trustleaf_private.pilot_operations where actor_ref=actor and operation_id=op;
    if found then
      if prior.intent is distinct from intent_hash then raise exception 'REPLAY_CONFLICT' using errcode='40001'; end if;
      return prior.result || jsonb_build_object('replayed',true);
    end if;
    perform pg_advisory_xact_lock(hashtextextended('pilot-profile|'||actor::text,0));
    select version into current_version from trustleaf_private.pilot_patient_profiles where patient_ref=actor;
    if coalesce(current_version,0) is distinct from (p_input->>'version')::integer then raise exception 'PROFILE_CONFLICT' using errcode='40001'; end if;
    insert into trustleaf_private.pilot_patient_profiles(patient_ref,name,email,phone)
      values(actor,trim(p_input->>'name'),lower(trim(p_input->>'email')),trim(p_input->>'phone'))
      on conflict(patient_ref) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,
        version=pilot_patient_profiles.version+1,updated_at=statement_timestamp();
    result := jsonb_build_object('saved',true);
    insert into trustleaf_private.pilot_operations values(actor,op,intent_hash,result);
    insert into trustleaf_private.pilot_audit(actor_ref,action,resource_ref) values(actor,'save-profile',actor);
    return result;
  end if;
  r := trustleaf_private.pilot_before_profiles(p_subject,p_action,p_input);
  if p_action='snapshot' and r->>'joined'='true' then
    actor := (r->>'actorRef')::uuid;
    if r->>'role'='patient' then
      r := r || jsonb_build_object('profile',(select to_jsonb(p) from trustleaf_private.pilot_patient_profiles p where patient_ref=actor));
    elsif r->>'role'='dispensary' then
      -- Only profiles attached to the already-authorized treatment projection.
      r := r || jsonb_build_object('patientProfiles',coalesce((select jsonb_agg(to_jsonb(p))
        from trustleaf_private.pilot_patient_profiles p where exists(select 1 from jsonb_array_elements(r->'treatments') t where t->>'patient_ref'=p.patient_ref::text)
          and exists(select 1 from trustleaf_private.actor_bindings a where a.actor_ref=p.patient_ref and a.state='active' and (a.valid_until is null or a.valid_until>statement_timestamp()))),'[]'::jsonb),
        'grants',coalesce((select jsonb_agg(to_jsonb(g)) from trustleaf_private.pilot_grants g
          where g.organization_ref=(r->'membership'->>'organization_ref')::uuid and g.expires_at>statement_timestamp()
          and exists(select 1 from jsonb_array_elements(r->'treatments') t where t->>'treatment_ref'=g.treatment_ref::text)),'[]'::jsonb));
    end if;
  end if;
  return r;
end $$;
revoke all on function public.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_operations_pilot(text,text,jsonb) to service_role;
commit;
