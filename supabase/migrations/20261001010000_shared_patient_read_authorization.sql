begin;

alter function public.trustleaf_operations_pilot(text,text,jsonb) rename to pilot_before_shared_patient_authorization;
alter function public.pilot_before_shared_patient_authorization(text,text,jsonb) set schema trustleaf_private;
revoke all on function trustleaf_private.pilot_before_shared_patient_authorization(text,text,jsonb) from public,anon,authenticated,service_role;

create function public.trustleaf_operations_pilot(p_subject text,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r jsonb; org uuid; allowed_treatments jsonb; now_at timestamptz := statement_timestamp();
begin
  r := trustleaf_private.pilot_before_shared_patient_authorization(p_subject,p_action,p_input);
  if p_action='snapshot' and r->>'joined'='true' and r->>'role'='dispensary' then
    -- Derive the recipient from the verified actor, never from browser input.
    select m.organization_ref into org
      from trustleaf_private.pilot_memberships m
      join trustleaf_private.actor_bindings a on a.actor_ref=m.actor_ref
      where m.actor_ref=(r->>'actorRef')::uuid and a.role='dispensary' and a.state='active'
        and (a.valid_until is null or a.valid_until>now_at);

    -- Intersect the existing projection with current patient, grant and treatment authorization.
    select coalesce(jsonb_agg(item.value order by item.ordinality),'[]'::jsonb) into allowed_treatments
      from jsonb_array_elements(r->'treatments') with ordinality item(value,ordinality)
      join trustleaf_private.pilot_treatments t on t.treatment_ref=(item.value->>'treatment_ref')::uuid
      join trustleaf_private.actor_bindings patient on patient.actor_ref=t.patient_ref
      join trustleaf_private.pilot_grants g on g.treatment_ref=t.treatment_ref and g.organization_ref=org
      where patient.role='patient' and patient.state='active'
        and (patient.valid_until is null or patient.valid_until>now_at)
        and g.expires_at>now_at and t.state='active'
        and t.prescription_valid_until>now_at and t.treatment_ends_at>now_at;

    r := r || jsonb_build_object(
      'treatments',allowed_treatments,
      'grants',coalesce((select jsonb_agg(item.value order by item.ordinality)
        from jsonb_array_elements(r->'grants') with ordinality item(value,ordinality)
        where (item.value->>'organization_ref')::uuid=org and (item.value->>'expires_at')::timestamptz>now_at
          and exists(select 1 from jsonb_array_elements(allowed_treatments) t
            where t->>'treatment_ref'=item.value->>'treatment_ref')),'[]'::jsonb),
      'patientProfiles',coalesce((select jsonb_agg(item.value order by item.ordinality)
        from jsonb_array_elements(r->'patientProfiles') with ordinality item(value,ordinality)
        where exists(select 1 from jsonb_array_elements(allowed_treatments) t
          where t->>'patient_ref'=item.value->>'patient_ref')),'[]'::jsonb),
      'deliveries',coalesce((select jsonb_agg(item.value order by item.ordinality)
        from jsonb_array_elements(r->'deliveries') with ordinality item(value,ordinality)
        where (item.value->>'organization_ref')::uuid=org
          or exists(select 1 from jsonb_array_elements(allowed_treatments) t
            where t->>'treatment_ref'=item.value->>'treatment_ref')),'[]'::jsonb));
  end if;
  return r;
end $$;
revoke all on function public.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_operations_pilot(text,text,jsonb) to service_role;

commit;
