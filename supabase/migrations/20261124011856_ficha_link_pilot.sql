begin;

create table trustleaf_private.ficha_pilot_bindings (
  patient_ref uuid primary key references trustleaf_private.actor_bindings(actor_ref),
  binding_id uuid unique not null
);

create table trustleaf_private.ficha_pilot_prescriptions (
  resource_ref uuid primary key,
  patient_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  doctor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  binding_id uuid unique not null,
  pdf_base64 text not null check (octet_length(pdf_base64) between 32 and 16000),
  nonce text not null check (nonce ~ '^[a-f0-9]{64}$'),
  commitment text not null check (commitment ~ '^[a-f0-9]{64}$'),
  issue_event jsonb not null check (jsonb_typeof(issue_event) = 'object'),
  revoke_event jsonb check (jsonb_typeof(revoke_event) = 'object'),
  link_ref text check (link_ref ~ '^[A-Za-z0-9_-]{16,64}$'),
  revoke_delivered boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  check (not revoke_delivered or (revoke_event is not null and link_ref is not null))
);

create index ficha_pilot_prescriptions_doctor_idx
  on trustleaf_private.ficha_pilot_prescriptions(doctor_ref, patient_ref, created_at desc);

alter table trustleaf_private.ficha_pilot_bindings enable row level security;
alter table trustleaf_private.ficha_pilot_prescriptions enable row level security;
revoke all on trustleaf_private.ficha_pilot_bindings from public, anon, authenticated, service_role;
revoke all on trustleaf_private.ficha_pilot_prescriptions from public, anon, authenticated, service_role;

-- Only the service verifies the application identity. Recheck actor state and ownership here.
create function public.trustleaf_ficha_link_pilot(p_subject text, p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  actor_role trustleaf_private.actor_role;
  patient uuid;
  linkage uuid;
  receipt trustleaf_private.ficha_pilot_prescriptions%rowtype;
  result jsonb;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 20000 then
    raise exception 'PILOT_INPUT_INVALID' using errcode = '22023';
  end if;

  select r.actor_ref,r.role into actor,actor_role
  from trustleaf_private.resolve_privy_actor(p_subject) r
  where r.actor_state = 'active' and (r.valid_until is null or r.valid_until > statement_timestamp());
  if actor is null or actor_role not in ('patient','doctor') then
    raise exception 'PILOT_FORBIDDEN' using errcode = '42501';
  end if;

  if actor_role = 'patient' then
    case p_action
      when 'save-binding' then
        insert into trustleaf_private.ficha_pilot_bindings(patient_ref,binding_id)
          values (actor,(p_data->>'bindingId')::uuid)
          on conflict (patient_ref) do update set binding_id = excluded.binding_id;
        return '{}'::jsonb;
      when 'patient-binding' then
        select binding_id into linkage from trustleaf_private.ficha_pilot_bindings where patient_ref = actor;
        return case when found then jsonb_build_object('bindingId',linkage) else 'null'::jsonb end;
      when 'patient-document' then
        select * into receipt from trustleaf_private.ficha_pilot_prescriptions
          where resource_ref = (p_data->>'resourceRef')::uuid and patient_ref = actor;
      else raise exception 'PILOT_FORBIDDEN' using errcode = '42501';
    end case;
  else
    if p_action in ('doctor-binding','doctor-receipt','issue') then
      select a.actor_ref into patient from trustleaf_private.actor_bindings a
       where a.actor_ref = (p_data->>'patientRef')::uuid and a.role = 'patient' and a.state = 'active'
         and (a.valid_until is null or a.valid_until > statement_timestamp());
      if patient is null then raise exception 'PILOT_NOT_FOUND' using errcode = 'PT404'; end if;
    end if;
    case p_action
      when 'doctor-binding' then
        select binding_id into linkage from trustleaf_private.ficha_pilot_bindings where patient_ref = patient;
        return case when found then jsonb_build_object('bindingId',linkage) else 'null'::jsonb end;
      when 'doctor-receipt' then
        select * into receipt from trustleaf_private.ficha_pilot_prescriptions
          where patient_ref = patient and doctor_ref = actor order by created_at desc, resource_ref desc limit 1;
        if not found then return 'null'::jsonb; end if;
      when 'issue' then
        select binding_id into linkage from trustleaf_private.ficha_pilot_bindings where patient_ref = patient for update;
        if linkage is null or linkage is distinct from (p_data->>'bindingId')::uuid then
          raise exception 'PILOT_BINDING_CHANGED' using errcode = 'PT409';
        end if;
        insert into trustleaf_private.ficha_pilot_prescriptions(
          resource_ref,patient_ref,doctor_ref,binding_id,pdf_base64,nonce,commitment,issue_event
        ) values (
          (p_data->'issueEvent'->>'resourceRef')::uuid,patient,actor,linkage,p_data->>'pdfBase64',
          p_data->>'nonce',p_data->>'commitment',p_data->'issueEvent'
        ) on conflict (binding_id) do nothing;
        select * into receipt from trustleaf_private.ficha_pilot_prescriptions
          where binding_id = linkage and doctor_ref = actor;
      when 'issued-resource' then
        select * into receipt from trustleaf_private.ficha_pilot_prescriptions
          where resource_ref = (p_data->>'resourceRef')::uuid and doctor_ref = actor;
      when 'revoke' then
        if jsonb_typeof(p_data->'revokeEvent') is distinct from 'object' then
          raise exception 'PILOT_INPUT_INVALID' using errcode = '22023';
        end if;
        update trustleaf_private.ficha_pilot_prescriptions
          set revoke_event = coalesce(revoke_event,p_data->'revokeEvent')
          where resource_ref = (p_data->>'resourceRef')::uuid and doctor_ref = actor returning * into receipt;
      when 'ack' then
        update trustleaf_private.ficha_pilot_prescriptions set
          link_ref = p_data->>'linkRef',
          revoke_delivered = revoke_delivered or (p_data->>'eventId' = coalesce(revoke_event->>'eventId',''))
          where resource_ref = (p_data->>'resourceRef')::uuid and doctor_ref = actor
            and (link_ref is null or link_ref = p_data->>'linkRef')
            and (p_data->>'eventId' = issue_event->>'eventId' or p_data->>'eventId' = revoke_event->>'eventId')
          returning * into receipt;
      else raise exception 'PILOT_FORBIDDEN' using errcode = '42501';
    end case;
  end if;

  if receipt.resource_ref is null then raise exception 'PILOT_NOT_FOUND' using errcode = 'PT404'; end if;
  result := jsonb_build_object('resourceRef',receipt.resource_ref,'linkRef',receipt.link_ref,
    'commitment',receipt.commitment,'issueEvent',receipt.issue_event,'revokeEvent',receipt.revoke_event,
    'revokeDelivered',receipt.revoke_delivered);
  return case when p_action = 'patient-document' then result || jsonb_build_object('pdfBase64',receipt.pdf_base64,'nonce',receipt.nonce)
    else result end;
end;
$$;

revoke all on function public.trustleaf_ficha_link_pilot(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.trustleaf_ficha_link_pilot(text,text,jsonb) to service_role;

commit;
