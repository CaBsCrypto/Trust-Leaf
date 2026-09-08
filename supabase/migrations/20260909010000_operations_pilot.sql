begin;

-- Opt-in, synthetic clinical records. Never infer enablement from an active role.
create table trustleaf_private.pilot_participants (
  actor_ref uuid primary key references trustleaf_private.actor_bindings(actor_ref),
  joined_at timestamptz not null default statement_timestamp()
);
create table trustleaf_private.pilot_organizations (
  organization_ref uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  created_at timestamptz not null default statement_timestamp()
);
create table trustleaf_private.pilot_memberships (
  actor_ref uuid primary key references trustleaf_private.pilot_participants(actor_ref),
  organization_ref uuid not null references trustleaf_private.pilot_organizations(organization_ref),
  role text not null check (role in ('manager','operator')),
  created_at timestamptz not null default statement_timestamp()
);
create table trustleaf_private.pilot_encounters (
  booking_ref uuid primary key references trustleaf_private.appointment_bookings(booking_ref),
  doctor_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  patient_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  state text not null default 'active' check (state in ('active','completed')),
  version integer not null default 1,
  updated_at timestamptz not null default statement_timestamp()
);
create table trustleaf_private.pilot_notes (
  booking_ref uuid not null references trustleaf_private.pilot_encounters(booking_ref),
  version integer not null,
  author_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default statement_timestamp(),
  primary key (booking_ref,version)
);
create table trustleaf_private.pilot_treatments (
  treatment_ref uuid primary key default gen_random_uuid(),
  booking_ref uuid not null unique references trustleaf_private.pilot_encounters(booking_ref),
  doctor_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  patient_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  state text not null default 'active' check (state in ('active','revoked')),
  version integer not null default 1,
  allowance_mg bigint not null check (allowance_mg between 1 and 1000000),
  period_count integer not null check (period_count between 1 and 12),
  issued_at timestamptz not null,
  prescription_valid_until timestamptz not null,
  treatment_ends_at timestamptz not null,
  check (prescription_valid_until > issued_at and treatment_ends_at > issued_at)
);
create table trustleaf_private.pilot_periods (
  treatment_ref uuid not null references trustleaf_private.pilot_treatments(treatment_ref),
  period_index integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  allowance_mg bigint not null check (allowance_mg > 0),
  primary key (treatment_ref,period_index),
  check (ends_at > starts_at)
);
create table trustleaf_private.pilot_grants (
  treatment_ref uuid not null references trustleaf_private.pilot_treatments(treatment_ref),
  organization_ref uuid not null references trustleaf_private.pilot_organizations(organization_ref),
  expires_at timestamptz not null,
  primary key (treatment_ref,organization_ref)
);
create table trustleaf_private.pilot_batches (
  batch_ref uuid primary key default gen_random_uuid(),
  organization_ref uuid not null references trustleaf_private.pilot_organizations(organization_ref),
  lot_code text not null check (length(trim(lot_code)) between 1 and 80),
  product text not null check (length(trim(product)) between 1 and 100),
  source_reference text not null check (length(trim(source_reference)) between 1 and 160),
  expires_at timestamptz not null check (isfinite(expires_at)),
  state text not null default 'active' check (state in ('active','quarantined')),
  version integer not null default 1,
  unique (organization_ref,lot_code)
);
create table trustleaf_private.pilot_deliveries (
  delivery_ref uuid primary key default gen_random_uuid(),
  treatment_ref uuid not null,
  period_index integer not null,
  organization_ref uuid not null references trustleaf_private.pilot_organizations(organization_ref),
  operator_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  batch_ref uuid not null references trustleaf_private.pilot_batches(batch_ref),
  quantity_mg bigint not null check (quantity_mg > 0),
  created_at timestamptz not null default statement_timestamp(),
  foreign key (treatment_ref,period_index) references trustleaf_private.pilot_periods(treatment_ref,period_index)
);
create table trustleaf_private.pilot_movements (
  movement_ref uuid primary key default gen_random_uuid(),
  batch_ref uuid not null references trustleaf_private.pilot_batches(batch_ref),
  operator_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  quantity_mg bigint not null check (quantity_mg <> 0),
  reason text not null check (length(trim(reason)) between 3 and 160),
  delivery_ref uuid unique references trustleaf_private.pilot_deliveries(delivery_ref),
  created_at timestamptz not null default statement_timestamp()
);
create table trustleaf_private.pilot_operations (
  actor_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  operation_id uuid not null,
  intent bytea not null,
  result jsonb not null,
  primary key (actor_ref,operation_id)
);
create table trustleaf_private.pilot_audit (
  audit_ref bigint generated always as identity primary key,
  actor_ref uuid not null references trustleaf_private.pilot_participants(actor_ref),
  action text not null,
  resource_ref uuid not null,
  created_at timestamptz not null default statement_timestamp()
);
create index pilot_delivery_period on trustleaf_private.pilot_deliveries(treatment_ref,period_index);
create index pilot_movements_batch on trustleaf_private.pilot_movements(batch_ref);
create index pilot_treatments_patient on trustleaf_private.pilot_treatments(patient_ref);

create function trustleaf_private.pilot_booking_cancel_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='cancelled' and old.state='confirmed' and exists(
    select 1 from trustleaf_private.pilot_encounters e where e.booking_ref=old.booking_ref
  ) then raise exception 'PILOT_ENCOUNTER_ALREADY_STARTED' using errcode='40001'; end if;
  return new;
end $$;
revoke all on function trustleaf_private.pilot_booking_cancel_guard() from public,anon,authenticated,service_role;
create trigger pilot_prevent_cancel_after_care before update of state on trustleaf_private.appointment_bookings
  for each row execute function trustleaf_private.pilot_booking_cancel_guard();

do $$ declare t text; begin
  foreach t in array array['pilot_participants','pilot_organizations','pilot_memberships','pilot_encounters',
    'pilot_notes','pilot_treatments','pilot_periods','pilot_grants','pilot_batches','pilot_deliveries',
    'pilot_movements','pilot_operations','pilot_audit'] loop
    execute format('alter table trustleaf_private.%I enable row level security',t);
    execute format('alter table trustleaf_private.%I force row level security',t);
    execute format('revoke all on trustleaf_private.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

create function public.trustleaf_operations_pilot(p_subject text,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a record; m trustleaf_private.pilot_memberships%rowtype; e trustleaf_private.pilot_encounters%rowtype;
  t trustleaf_private.pilot_treatments%rowtype; b trustleaf_private.pilot_batches%rowtype;
  p trustleaf_private.pilot_periods%rowtype; booking record; target record;
  ref uuid; org uuid; op uuid; resource uuid; prior record; result jsonb;
  qty bigint; count_periods integer; stock bigint; used bigint; i integer;
  now_at timestamptz := statement_timestamp(); version_in integer; joined boolean;
begin
  select * into a from trustleaf_private.resolve_privy_actor(p_subject);
  if not found or a.actor_state <> 'active' or (a.valid_until is not null and a.valid_until <= now_at) then
    raise exception 'PILOT_FORBIDDEN' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('snapshot','join','create-organization','add-operator','remove-operator',
    'start-encounter','save-note','complete-encounter','revoke-treatment','grant','revoke-grant',
    'receive-batch','adjust-stock','set-batch-state','dispense') or p_input is null
    or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>12000 then
    raise exception 'PILOT_INVALID_INPUT' using errcode='22023';
  end if;
  select exists(select 1 from trustleaf_private.pilot_participants x where x.actor_ref=a.actor_ref) into joined;
  if p_action='join' then
    if p_input->>'acceptSyntheticOnly' is distinct from 'true' then raise exception 'PILOT_CONSENT_REQUIRED' using errcode='22023'; end if;
    insert into trustleaf_private.pilot_participants(actor_ref) values(a.actor_ref) on conflict do nothing;
    return jsonb_build_object('joined',true);
  end if;
  if not joined then
    if p_action='snapshot' then return jsonb_build_object('joined',false,'role',a.role,'actorRef',a.actor_ref,'synthetic',true); end if;
    raise exception 'PILOT_CONSENT_REQUIRED' using errcode='42501';
  end if;
  select * into m from trustleaf_private.pilot_memberships x where x.actor_ref=a.actor_ref;

  if p_action='snapshot' then
    result := jsonb_build_object('joined',true,'synthetic',true,'role',a.role,'actorRef',a.actor_ref,'membership',to_jsonb(m),'asOf',now_at);
    if a.role='admin' then
      return result || jsonb_build_object(
        'organizations',coalesce((select jsonb_agg(to_jsonb(x)) from trustleaf_private.pilot_organizations x),'[]'::jsonb),
        'members',coalesce((select jsonb_agg(to_jsonb(x)) from trustleaf_private.pilot_memberships x),'[]'::jsonb),
        'audit',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from trustleaf_private.pilot_audit order by audit_ref desc limit 100) x),'[]'::jsonb),
        'counts',jsonb_build_object('participants',(select count(*) from trustleaf_private.pilot_participants),
          'encounters',(select count(*) from trustleaf_private.pilot_encounters),
          'completed',(select count(*) from trustleaf_private.pilot_encounters where state='completed'),
          'deliveries',(select count(*) from trustleaf_private.pilot_deliveries)));
    end if;
    result := result || jsonb_build_object(
      'bookings',coalesce((select jsonb_agg(to_jsonb(x)) from (
        select ab.booking_ref,ab.patient_actor_ref as patient_ref,s.doctor_actor_ref as doctor_ref,s.starts_at,s.ends_at,ab.state
        from trustleaf_private.appointment_bookings ab join trustleaf_private.availability_slots s using(slot_ref)
        where (a.role='doctor' and s.doctor_actor_ref=a.actor_ref) or (a.role='patient' and ab.patient_actor_ref=a.actor_ref)
        order by s.starts_at desc limit 200) x),'[]'::jsonb),
      'encounters',coalesce((select jsonb_agg(to_jsonb(x)) from trustleaf_private.pilot_encounters x
        where x.doctor_ref=a.actor_ref or x.patient_ref=a.actor_ref),'[]'::jsonb),
      'notes',coalesce((select jsonb_agg(to_jsonb(n)) from trustleaf_private.pilot_notes n
        join trustleaf_private.pilot_encounters x using(booking_ref)
        where x.doctor_ref=a.actor_ref or (x.patient_ref=a.actor_ref and x.state='completed')),'[]'::jsonb),
      'members',coalesce((select jsonb_agg(to_jsonb(x)) from trustleaf_private.pilot_memberships x where x.organization_ref=m.organization_ref),'[]'::jsonb),
      'batches',coalesce((select jsonb_agg(to_jsonb(x)) from (select z.*,coalesce((select sum(y.quantity_mg) from trustleaf_private.pilot_movements y where y.batch_ref=z.batch_ref),0) as stock_mg
        from trustleaf_private.pilot_batches z where z.organization_ref=m.organization_ref) x),'[]'::jsonb),
      'movements',coalesce((select jsonb_agg(to_jsonb(x)) from (select y.* from trustleaf_private.pilot_movements y
        join trustleaf_private.pilot_batches z using(batch_ref) where z.organization_ref=m.organization_ref order by y.created_at desc limit 200) x),'[]'::jsonb));
    -- Only consenting dispensaries get a minimal dispensing projection, never clinical notes or booking references.
    result := result || jsonb_build_object('treatments',coalesce((select jsonb_agg(
      jsonb_build_object('treatment_ref',x.treatment_ref,'patient_ref',x.patient_ref,'state',x.state,'version',x.version,
        'issued_at',x.issued_at,'prescription_valid_until',x.prescription_valid_until,'treatment_ends_at',x.treatment_ends_at,
        'allowance_mg',x.allowance_mg,'period_count',x.period_count,
        'periods',(select jsonb_agg(to_jsonb(period) || jsonb_build_object('used_mg',coalesce((select sum(d.quantity_mg) from trustleaf_private.pilot_deliveries d where d.treatment_ref=period.treatment_ref and d.period_index=period.period_index),0)) order by period.period_index)
          from trustleaf_private.pilot_periods period where period.treatment_ref=x.treatment_ref)))
      from trustleaf_private.pilot_treatments x where x.patient_ref=a.actor_ref or x.doctor_ref=a.actor_ref or exists(
        select 1 from trustleaf_private.pilot_grants g where g.treatment_ref=x.treatment_ref and g.organization_ref=m.organization_ref and g.expires_at>now_at
          and x.state='active' and x.prescription_valid_until>now_at and x.treatment_ends_at>now_at)),'[]'::jsonb));
    result := result || jsonb_build_object(
      'grants',coalesce((select jsonb_agg(to_jsonb(g)) from trustleaf_private.pilot_grants g join trustleaf_private.pilot_treatments x using(treatment_ref) where x.patient_ref=a.actor_ref),'[]'::jsonb),
      'deliveries',coalesce((select jsonb_agg(to_jsonb(d)) from trustleaf_private.pilot_deliveries d join trustleaf_private.pilot_treatments x using(treatment_ref)
        where x.patient_ref=a.actor_ref or x.doctor_ref=a.actor_ref or d.organization_ref=m.organization_ref or exists(
          select 1 from trustleaf_private.pilot_grants g where g.treatment_ref=x.treatment_ref and g.organization_ref=m.organization_ref and g.expires_at>now_at
            and x.state='active' and x.prescription_valid_until>now_at and x.treatment_ends_at>now_at)),'[]'::jsonb),
      'organizations',coalesce((select jsonb_agg(to_jsonb(o)) from trustleaf_private.pilot_organizations o where o.organization_ref=m.organization_ref or
        (a.role='patient' and exists(select 1 from trustleaf_private.pilot_treatments x join trustleaf_private.pilot_periods period using(treatment_ref)
          where x.patient_ref=a.actor_ref and x.state='active' and x.prescription_valid_until>now_at and period.starts_at<=now_at and period.ends_at>now_at
          and period.allowance_mg>coalesce((select sum(d.quantity_mg) from trustleaf_private.pilot_deliveries d where d.treatment_ref=period.treatment_ref and d.period_index=period.period_index),0)))),'[]'::jsonb));
    return result;
  end if;

  op := (p_input->>'operationId')::uuid;
  if op is null then raise exception 'PILOT_OPERATION_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pilot-op|'||a.actor_ref::text||op::text,0));
  select * into prior from trustleaf_private.pilot_operations x where x.actor_ref=a.actor_ref and x.operation_id=op;
  if found then
    if prior.intent is distinct from sha256(convert_to(p_action||'|'||p_input::text,'UTF8')) then raise exception 'PILOT_REPLAY_CONFLICT' using errcode='40001'; end if;
    return prior.result || jsonb_build_object('replayed',true);
  end if;
  ref := (p_input->>'resourceRef')::uuid; version_in := (p_input->>'version')::integer;

  if p_action='create-organization' then
    if a.role<>'dispensary' then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('pilot-member|'||a.actor_ref::text,0));
    if exists(select 1 from trustleaf_private.pilot_memberships x where x.actor_ref=a.actor_ref) then raise exception 'PILOT_ALREADY_MEMBER' using errcode='40001'; end if;
    insert into trustleaf_private.pilot_organizations(name) values(p_input->>'name') returning organization_ref into resource;
    insert into trustleaf_private.pilot_memberships values(a.actor_ref,resource,'manager',now_at);
  elsif p_action in ('add-operator','remove-operator') then
    if a.role<>'dispensary' or m.role is distinct from 'manager' or ref is null or ref=a.actor_ref then raise exception 'PILOT_MANAGER_REQUIRED' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('pilot-member|'||ref::text,0));
    if p_action='add-operator' then
      select * into target from trustleaf_private.actor_bindings x join trustleaf_private.pilot_participants pp using(actor_ref)
        where x.actor_ref=ref and x.role='dispensary' and x.state='active' and (x.valid_until is null or x.valid_until>now_at);
      if not found then raise exception 'PILOT_OPERATOR_NOT_ELIGIBLE' using errcode='42501'; end if;
      insert into trustleaf_private.pilot_memberships values(ref,m.organization_ref,'operator',now_at);
    else
      delete from trustleaf_private.pilot_memberships x where x.actor_ref=ref and x.organization_ref=m.organization_ref and x.role='operator';
      if not found then raise exception 'PILOT_OPERATOR_NOT_FOUND' using errcode='40001'; end if;
    end if;
    resource:=ref;
  elsif p_action in ('start-encounter','save-note','complete-encounter') then
    if a.role<>'doctor' then raise exception 'PILOT_DOCTOR_REQUIRED' using errcode='42501'; end if;
    select ab.*,s.doctor_actor_ref into booking from trustleaf_private.appointment_bookings ab
      join trustleaf_private.availability_slots s using(slot_ref) where ab.booking_ref=ref for update of ab;
    if not found or booking.doctor_actor_ref<>a.actor_ref or booking.state<>'confirmed' then raise exception 'PILOT_BOOKING_FORBIDDEN' using errcode='42501'; end if;
    if not exists(select 1 from trustleaf_private.pilot_participants pp join trustleaf_private.actor_bindings x using(actor_ref)
      where pp.actor_ref=booking.patient_actor_ref and x.state='active' and (x.valid_until is null or x.valid_until>now_at)) then raise exception 'PILOT_PATIENT_NOT_READY' using errcode='42501'; end if;
    if p_action='start-encounter' then
      insert into trustleaf_private.pilot_encounters(booking_ref,doctor_ref,patient_ref) values(ref,a.actor_ref,booking.patient_actor_ref);
    else
      select * into e from trustleaf_private.pilot_encounters x where x.booking_ref=ref for update;
      if not found or e.state<>'active' or e.version is distinct from version_in then raise exception 'PILOT_VERSION_CONFLICT' using errcode='40001'; end if;
      if p_action='save-note' then
        insert into trustleaf_private.pilot_notes values(ref,e.version+1,a.actor_ref,p_input->>'note',now_at);
      else
        if p_input->>'issueTreatment' not in ('true','false') or p_input->>'issueTreatment' is null then raise exception 'PILOT_INVALID_COMPLETION' using errcode='22023'; end if;
        if (p_input->>'issueTreatment')::boolean then
          perform pg_advisory_xact_lock(hashtextextended('pilot-patient|'||e.patient_ref::text,0));
          if exists(select 1 from trustleaf_private.pilot_treatments x where x.patient_ref=e.patient_ref and x.state='active' and x.treatment_ends_at>now_at and x.prescription_valid_until>now_at) then raise exception 'PILOT_OVERLAPPING_TREATMENT' using errcode='40001'; end if;
          qty:=(p_input->>'allowanceMg')::bigint; count_periods:=(p_input->>'periodCount')::integer;
          insert into trustleaf_private.pilot_treatments(booking_ref,doctor_ref,patient_ref,allowance_mg,period_count,issued_at,prescription_valid_until,treatment_ends_at)
            values(ref,a.actor_ref,e.patient_ref,qty,count_periods,now_at,now_at+count_periods*interval '720 hours',now_at+count_periods*interval '720 hours') returning * into t;
          for i in 0..count_periods-1 loop
            insert into trustleaf_private.pilot_periods values(t.treatment_ref,i+1,now_at+i*interval '720 hours',now_at+(i+1)*interval '720 hours',qty);
          end loop;
        end if;
      end if;
      update trustleaf_private.pilot_encounters set version=version+1,updated_at=now_at,state=case when p_action='complete-encounter' then 'completed' else state end where booking_ref=ref;
    end if;
    resource:=ref;
  elsif p_action in ('grant','revoke-grant','revoke-treatment','dispense') then
    select * into t from trustleaf_private.pilot_treatments x where x.treatment_ref=ref;
    if not found then raise exception 'PILOT_TREATMENT_FORBIDDEN' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('pilot-patient|'||t.patient_ref::text,0));
    select * into t from trustleaf_private.pilot_treatments x where x.treatment_ref=ref for update;
    if p_action='revoke-treatment' then
      if a.role<>'doctor' or t.doctor_ref<>a.actor_ref then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;
      if t.version is distinct from version_in or t.state<>'active' then raise exception 'PILOT_VERSION_CONFLICT' using errcode='40001'; end if;
      update trustleaf_private.pilot_treatments set state='revoked',version=version+1 where treatment_ref=ref;
    elsif p_action in ('grant','revoke-grant') then
      if a.role<>'patient' or t.patient_ref<>a.actor_ref then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;
      org:=(p_input->>'organizationRef')::uuid;
      if p_action='grant' then
        if t.state<>'active' or t.prescription_valid_until<=now_at or t.treatment_ends_at<=now_at then raise exception 'PILOT_TREATMENT_EXPIRED' using errcode='40001'; end if;
        insert into trustleaf_private.pilot_grants values(ref,org,now_at+interval '24 hours')
          on conflict(treatment_ref,organization_ref) do update set expires_at=excluded.expires_at;
      else
        delete from trustleaf_private.pilot_grants x where x.treatment_ref=ref and x.organization_ref=org;
      end if;
    else
      if a.role<>'dispensary' or m.organization_ref is null then raise exception 'PILOT_DISPENSARY_REQUIRED' using errcode='42501'; end if;
      -- Serialize membership removal with every dispense by that operator.
      perform pg_advisory_xact_lock(hashtextextended('pilot-member|'||a.actor_ref::text,0));
      if not exists(select 1 from trustleaf_private.pilot_memberships x where x.actor_ref=a.actor_ref and x.organization_ref=m.organization_ref) then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;
      if not exists(select 1 from trustleaf_private.pilot_grants g where g.treatment_ref=ref and g.organization_ref=m.organization_ref and g.expires_at>now_at) then raise exception 'PILOT_GRANT_REQUIRED' using errcode='42501'; end if;
      if t.state<>'active' or t.prescription_valid_until<=now_at or t.treatment_ends_at<=now_at or not exists(select 1 from trustleaf_private.actor_bindings x where x.actor_ref=t.doctor_ref and x.state='active' and (x.valid_until is null or x.valid_until>now_at)) then raise exception 'PILOT_TREATMENT_EXPIRED' using errcode='40001'; end if;
      select * into p from trustleaf_private.pilot_periods x where x.treatment_ref=ref and x.starts_at<=now_at and x.ends_at>now_at;
      if not found then raise exception 'PILOT_NO_CURRENT_PERIOD' using errcode='40001'; end if;
      select * into b from trustleaf_private.pilot_batches x where x.batch_ref=(p_input->>'batchRef')::uuid for update;
      if not found or b.organization_ref<>m.organization_ref then raise exception 'PILOT_BATCH_FORBIDDEN' using errcode='42501'; end if;
      -- A queued transaction may cross an expiry or period boundary while waiting for locks.
      now_at := clock_timestamp();
      if t.state<>'active' or t.prescription_valid_until<=now_at or t.treatment_ends_at<=now_at then raise exception 'PILOT_TREATMENT_EXPIRED' using errcode='40001'; end if;
      if not exists(select 1 from trustleaf_private.actor_bindings x where x.actor_ref=a.actor_ref and x.role='dispensary' and x.state='active' and (x.valid_until is null or x.valid_until>now_at))
        or not exists(select 1 from trustleaf_private.actor_bindings x where x.actor_ref=t.doctor_ref and x.role='doctor' and x.state='active' and (x.valid_until is null or x.valid_until>now_at)) then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;
      if not exists(select 1 from trustleaf_private.pilot_grants g where g.treatment_ref=ref and g.organization_ref=m.organization_ref and g.expires_at>now_at)
        or not exists(select 1 from trustleaf_private.actor_bindings x where x.actor_ref=t.patient_ref and x.state='active' and (x.valid_until is null or x.valid_until>now_at)) then raise exception 'PILOT_GRANT_REQUIRED' using errcode='42501'; end if;
      select * into p from trustleaf_private.pilot_periods x where x.treatment_ref=ref and x.starts_at<=now_at and x.ends_at>now_at;
      if not found then raise exception 'PILOT_NO_CURRENT_PERIOD' using errcode='40001'; end if;
      qty:=(p_input->>'quantityMg')::bigint;
      if qty is null or qty<=0 or qty>1000000 then raise exception 'PILOT_QUANTITY_INVALID' using errcode='22023'; end if;
      select coalesce(sum(x.quantity_mg),0) into used from trustleaf_private.pilot_deliveries x where x.treatment_ref=ref and x.period_index=p.period_index;
      select coalesce(sum(x.quantity_mg),0) into stock from trustleaf_private.pilot_movements x where x.batch_ref=b.batch_ref;
      if b.state<>'active' or b.expires_at<=now_at or stock<qty or p.allowance_mg-used<qty then raise exception 'PILOT_STOCK_OR_QUOTA_CONFLICT' using errcode='40001'; end if;
      insert into trustleaf_private.pilot_deliveries(treatment_ref,period_index,organization_ref,operator_ref,batch_ref,quantity_mg,created_at)
        values(ref,p.period_index,m.organization_ref,a.actor_ref,b.batch_ref,qty,now_at) returning delivery_ref into resource;
      insert into trustleaf_private.pilot_movements(batch_ref,operator_ref,quantity_mg,reason,delivery_ref,created_at) values(b.batch_ref,a.actor_ref,-qty,'Entrega simulada',resource,now_at);
      update trustleaf_private.pilot_batches set version=version+1 where batch_ref=b.batch_ref;
    end if;
    resource:=coalesce(resource,ref);
  elsif p_action in ('receive-batch','adjust-stock','set-batch-state') then
    if a.role<>'dispensary' or m.role is distinct from 'manager' then raise exception 'PILOT_MANAGER_REQUIRED' using errcode='42501'; end if;
    qty:=(p_input->>'quantityMg')::bigint;
    if p_action='receive-batch' then
      if qty is null or qty<=0 or qty>1000000000 or (p_input->>'expiresAt')::timestamptz<=now_at then raise exception 'PILOT_BATCH_INVALID' using errcode='22023'; end if;
      insert into trustleaf_private.pilot_batches(organization_ref,lot_code,product,source_reference,expires_at)
        values(m.organization_ref,p_input->>'lotCode',p_input->>'product',p_input->>'sourceReference',(p_input->>'expiresAt')::timestamptz) returning * into b;
      insert into trustleaf_private.pilot_movements(batch_ref,operator_ref,quantity_mg,reason) values(b.batch_ref,a.actor_ref,qty,'Recepcion simulada');
    else
      select * into b from trustleaf_private.pilot_batches x where x.batch_ref=ref for update;
      if not found or b.organization_ref<>m.organization_ref then raise exception 'PILOT_BATCH_FORBIDDEN' using errcode='42501'; end if;
      if b.version is distinct from version_in then raise exception 'PILOT_VERSION_CONFLICT' using errcode='40001'; end if;
      if p_action='set-batch-state' then
        update trustleaf_private.pilot_batches set state=p_input->>'state',version=version+1 where batch_ref=ref;
      else
        if qty is null or qty=0 or abs(qty)>1000000000 then raise exception 'PILOT_QUANTITY_INVALID' using errcode='22023'; end if;
        select coalesce(sum(x.quantity_mg),0) into stock from trustleaf_private.pilot_movements x where x.batch_ref=ref;
        if stock+qty<0 then raise exception 'PILOT_STOCK_CONFLICT' using errcode='40001'; end if;
        insert into trustleaf_private.pilot_movements(batch_ref,operator_ref,quantity_mg,reason) values(ref,a.actor_ref,qty,p_input->>'reason');
        update trustleaf_private.pilot_batches set version=version+1 where batch_ref=ref;
      end if;
    end if;
    resource:=b.batch_ref;
  else
    raise exception 'PILOT_FORBIDDEN' using errcode='42501';
  end if;
  result:=jsonb_build_object('resourceRef',resource,'replayed',false,'synthetic',true);
  -- Store only a digest, not clinical note bodies, in the operation journal.
  insert into trustleaf_private.pilot_operations values(a.actor_ref,op,sha256(convert_to(p_action||'|'||p_input::text,'UTF8')),result);
  insert into trustleaf_private.pilot_audit(actor_ref,action,resource_ref) values(a.actor_ref,p_action,resource);
  return result;
end $$;
revoke all on function public.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_operations_pilot(text,text,jsonb) to service_role;

commit;
