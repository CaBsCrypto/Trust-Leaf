begin;

create table trustleaf_private.ficha_shared_enrollments (
  patient_ref uuid primary key references trustleaf_private.actor_bindings(actor_ref),
  partner_patient_ref uuid unique,
  updated_at timestamptz not null default statement_timestamp()
);
alter table trustleaf_private.ficha_shared_enrollments enable row level security;
revoke all on trustleaf_private.ficha_shared_enrollments from public, anon, authenticated, service_role;

alter table trustleaf_private.ficha_pilot_prescriptions
  alter column binding_id drop not null,
  alter column issue_event drop not null,
  add column booking_ref uuid unique references trustleaf_private.appointment_bookings(booking_ref),
  add column consultation_ref uuid,
  add column partner_patient_ref uuid,
  add column workflow_ref uuid unique,
  add column confirmed_transaction text check (confirmed_transaction ~ '^[a-f0-9]{64}$'),
  add column confirmed_rx text check (confirmed_rx ~ '^[1-9][0-9]*$'),
  add constraint ficha_pilot_prescription_source check (
    (binding_id is not null and booking_ref is null and issue_event is not null) or
    (binding_id is null and booking_ref is not null and consultation_ref is not null and partner_patient_ref is not null
      and ((issue_event is null and confirmed_transaction is null and confirmed_rx is null)
        or (issue_event is not null and workflow_ref is not null and confirmed_transaction is not null and confirmed_rx is not null)))
  );

create table trustleaf_private.ficha_shared_rebinds (
  proof_digest bytea primary key check (octet_length(proof_digest) = 32),
  actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref)
);
alter table trustleaf_private.ficha_shared_rebinds enable row level security;
revoke all on trustleaf_private.ficha_shared_rebinds from public, anon, authenticated, service_role;

create function public.trustleaf_ficha_rebind_privy_actor(p_previous_subject text,p_new_subject text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_ref uuid; prior_ref uuid; proof bytea; prior_digest bytea;
begin
  if p_previous_subject is null or p_new_subject is null or p_previous_subject = p_new_subject
    or length(p_previous_subject) not between 16 and 512 or length(p_new_subject) not between 16 and 512
    or p_previous_subject !~ '^did:privy:[A-Za-z0-9._:-]+$' or p_new_subject !~ '^did:privy:[A-Za-z0-9._:-]+$' then
    raise exception 'PILOT_INPUT_INVALID' using errcode='22023';
  end if;
  -- This is the same identity enrollment lock used by the existing role RPC.
  perform pg_advisory_xact_lock(42826003);
  proof := sha256(convert_to(jsonb_build_array(p_previous_subject,p_new_subject)::text,'UTF8'));
  select r.actor_ref into prior_ref from trustleaf_private.ficha_shared_rebinds r where r.proof_digest=proof;
  if prior_ref is not null and exists(select 1 from trustleaf_private.resolve_privy_actor(p_new_subject) a
    where a.actor_ref=prior_ref and a.actor_state='active' and (a.valid_until is null or a.valid_until>statement_timestamp())) then
    return prior_ref;
  end if;
  select a.actor_ref into owner_ref from trustleaf_private.resolve_privy_actor(p_previous_subject) a
    where a.actor_state='active' and (a.valid_until is null or a.valid_until>statement_timestamp());
  if owner_ref is null then raise exception 'PILOT_NOT_FOUND' using errcode='PT404'; end if;
  if exists(select 1 from trustleaf_private.external_identity_bindings where provider='privy' and external_subject=p_new_subject) then
    raise exception 'PILOT_IDENTITY_CONFLICT' using errcode='PT409';
  end if;
  update trustleaf_private.external_identity_bindings set external_subject=p_new_subject
    where provider='privy' and external_subject=p_previous_subject and state='active' and actor_ref=owner_ref;
  if not found then raise exception 'PILOT_NOT_FOUND' using errcode='PT404'; end if;
  insert into trustleaf_private.ficha_shared_rebinds values(proof,owner_ref);
  perform pg_advisory_xact_lock(42826001);
  select event_digest into prior_digest from trustleaf_private.audit_events order by audit_seq desc limit 1;
  insert into trustleaf_private.audit_events(actor_ref,action_code,resource_ref,outcome,previous_digest,event_digest)
    values(owner_ref,'actor.identity.rebound',owner_ref,'allowed',prior_digest,
      sha256(coalesce(prior_digest,'\x'::bytea)||convert_to('privy.actor.rebound|'||owner_ref::text,'UTF8')));
  return owner_ref;
end;
$$;
revoke all on function public.trustleaf_ficha_rebind_privy_actor(text,text) from public,anon,authenticated;
grant execute on function public.trustleaf_ficha_rebind_privy_actor(text,text) to service_role;

create function public.trustleaf_ficha_shared_pilot(p_subject text,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; actor_role trustleaf_private.actor_role; target uuid; patient uuid; partner_ref uuid;
  receipt trustleaf_private.ficha_pilot_prescriptions%rowtype;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text)>20000 then
    raise exception 'PILOT_INPUT_INVALID' using errcode='22023';
  end if;
  select a.actor_ref,a.role into actor,actor_role from trustleaf_private.resolve_privy_actor(p_subject) a
    where a.actor_state='active' and (a.valid_until is null or a.valid_until>statement_timestamp());
  if actor is null then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;
  if p_action='save-enrollment' and actor_role='patient' then
    insert into trustleaf_private.ficha_shared_enrollments(patient_ref,partner_patient_ref)
      values(actor,(p_data->>'partnerPatientRef')::uuid)
      on conflict(patient_ref) do update set partner_patient_ref=excluded.partner_patient_ref,updated_at=statement_timestamp();
    return '{}'::jsonb;
  end if;
  if actor_role<>'doctor' then raise exception 'PILOT_FORBIDDEN' using errcode='42501'; end if;

  if p_action='doctor-consultations' then
    return coalesce((select jsonb_agg(ref) from (
      select b.booking_ref as ref from trustleaf_private.appointment_bookings b
      join trustleaf_private.availability_slots s using(slot_ref)
      join trustleaf_private.pilot_encounters e on e.booking_ref=b.booking_ref
      join trustleaf_private.ficha_shared_enrollments g on g.patient_ref=b.patient_actor_ref
      left join trustleaf_private.ficha_pilot_prescriptions r on r.booking_ref=b.booking_ref
      where b.state='confirmed' and e.state='active' and e.doctor_ref=actor and s.doctor_actor_ref=actor
        and e.patient_ref=b.patient_actor_ref and g.partner_patient_ref is not null and r.resource_ref is null
      order by s.starts_at desc,b.booking_ref limit 30
    ) allowed),'[]'::jsonb);
  end if;

  if p_action in ('prepare','authorize-workflow') then
    target := (p_data->>'bookingRef')::uuid;
    select b.patient_actor_ref,g.partner_patient_ref into patient,partner_ref from trustleaf_private.appointment_bookings b
      join trustleaf_private.availability_slots s using(slot_ref)
      join trustleaf_private.pilot_encounters e on e.booking_ref=b.booking_ref
      join trustleaf_private.ficha_shared_enrollments g on g.patient_ref=b.patient_actor_ref
      join trustleaf_private.actor_bindings a on a.actor_ref=b.patient_actor_ref
      where b.booking_ref=target and b.state='confirmed' and e.state='active' and e.doctor_ref=actor and s.doctor_actor_ref=actor
        and e.patient_ref=b.patient_actor_ref and g.partner_patient_ref is not null
        and a.role='patient' and a.state='active' and (a.valid_until is null or a.valid_until>statement_timestamp())
      for update of b,e,g;
    if patient is null then raise exception 'PILOT_NOT_FOUND' using errcode='PT404'; end if;
    if p_action='prepare' then
      insert into trustleaf_private.ficha_pilot_prescriptions(resource_ref,patient_ref,doctor_ref,booking_ref,consultation_ref,partner_patient_ref,pdf_base64,nonce,commitment)
        values((p_data->>'resourceRef')::uuid,patient,actor,target,(p_data->>'consultationRef')::uuid,partner_ref,
          p_data->>'pdfBase64',p_data->>'nonce',p_data->>'commitment') on conflict(booking_ref) do nothing;
    end if;
    select * into receipt from trustleaf_private.ficha_pilot_prescriptions
      where booking_ref=target and doctor_ref=actor and consultation_ref=(p_data->>'consultationRef')::uuid and partner_patient_ref=partner_ref
        and (p_action='prepare' or resource_ref=(p_data->>'resourceRef')::uuid);
  elsif p_action='doctor-prescriptions' then
    return coalesce((select jsonb_agg(jsonb_build_object('resourceRef',q.resource_ref,'clinicalStatus',
      case when q.revoke_event is not null then 'revoked' when q.issue_event is not null then 'active' else 'pending' end,
      'deliveryStatus',case when (q.revoke_event is null and q.link_ref is not null) or q.revoke_delivered then 'accepted' else 'pending' end)
      order by q.created_at desc,q.resource_ref desc) from (
      select r.resource_ref,r.issue_event,r.revoke_event,r.link_ref,r.revoke_delivered,r.created_at
      from trustleaf_private.ficha_pilot_prescriptions r where r.doctor_ref=actor and r.booking_ref is not null
      order by r.created_at desc,r.resource_ref desc limit 30
    ) q),'[]'::jsonb);
  elsif p_action='read-resource' then
    select * into receipt from trustleaf_private.ficha_pilot_prescriptions
      where resource_ref=(p_data->>'resourceRef')::uuid and doctor_ref=actor and booking_ref is not null;
  elsif p_action='assign-workflow' then
    update trustleaf_private.ficha_pilot_prescriptions set workflow_ref=(p_data->>'workflowRef')::uuid
      where resource_ref=(p_data->>'resourceRef')::uuid and doctor_ref=actor and booking_ref is not null
        and (workflow_ref is null or workflow_ref=(p_data->>'workflowRef')::uuid) returning * into receipt;
  elsif p_action='confirm-workflow' then
    update trustleaf_private.ficha_pilot_prescriptions set
      confirmed_transaction=coalesce(confirmed_transaction,p_data->>'transactionHash'),
      confirmed_rx=coalesce(confirmed_rx,p_data->>'rxId'),issue_event=coalesce(issue_event,p_data->'issueEvent')
      where resource_ref=(p_data->>'resourceRef')::uuid and doctor_ref=actor and booking_ref is not null
        and workflow_ref=(p_data->>'workflowRef')::uuid and commitment=p_data->'issueEvent'->>'commitment'
        and (confirmed_transaction is null or confirmed_transaction=p_data->>'transactionHash')
        and (confirmed_rx is null or confirmed_rx=p_data->>'rxId') returning * into receipt;
  else raise exception 'PILOT_INPUT_INVALID' using errcode='22023';
  end if;
  if receipt.resource_ref is null then raise exception 'PILOT_NOT_FOUND' using errcode='PT404'; end if;
  return jsonb_build_object('resourceRef',receipt.resource_ref,'linkRef',receipt.link_ref,'commitment',receipt.commitment,
    'issueEvent',receipt.issue_event,'revokeEvent',receipt.revoke_event,'revokeDelivered',receipt.revoke_delivered,
    'bookingRef',receipt.booking_ref,'consultationRef',receipt.consultation_ref,'partnerPatientRef',receipt.partner_patient_ref,
    'workflowRef',receipt.workflow_ref,'transactionHash',receipt.confirmed_transaction,'rxId',receipt.confirmed_rx);
end;
$$;
revoke all on function public.trustleaf_ficha_shared_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_ficha_shared_pilot(text,text,jsonb) to service_role;

commit;
