begin;

alter function public.trustleaf_operations_pilot(text,text,jsonb) rename to pilot_before_delivery_descriptions;
alter function public.pilot_before_delivery_descriptions(text,text,jsonb) set schema trustleaf_private;
revoke all on function trustleaf_private.pilot_before_delivery_descriptions(text,text,jsonb) from public,anon,authenticated,service_role;

create function public.trustleaf_operations_pilot(p_subject text,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
  r := trustleaf_private.pilot_before_delivery_descriptions(p_subject,p_action,p_input);
  if p_action='snapshot' and r->>'joined'='true' and jsonb_typeof(r->'deliveries')='array' then
    -- Enrich only receipts already authorized by the existing projection, never expose inventory.
    r := r || jsonb_build_object('deliveries',coalesce((
      select jsonb_agg(d.value || jsonb_build_object(
        'organization_name',o.name,'product',b.product,'lot_code',b.lot_code) order by d.ordinality)
      from jsonb_array_elements(r->'deliveries') with ordinality d(value,ordinality)
      left join trustleaf_private.pilot_organizations o on o.organization_ref=(d.value->>'organization_ref')::uuid
      left join trustleaf_private.pilot_batches b on b.batch_ref=(d.value->>'batch_ref')::uuid
        and b.organization_ref=(d.value->>'organization_ref')::uuid
    ),'[]'::jsonb));
  end if;
  return r;
end $$;
revoke all on function public.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_operations_pilot(text,text,jsonb) to service_role;
commit;
