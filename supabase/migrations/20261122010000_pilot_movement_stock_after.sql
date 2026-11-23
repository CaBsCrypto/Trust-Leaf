begin;

-- Older movements lack a recorded balance. Keep that distinction in the snapshot.
alter table trustleaf_private.pilot_movements
  add column stock_after_mg bigint check (stock_after_mg >= 0);

create function trustleaf_private.pilot_record_movement_stock_after()
returns trigger language plpgsql set search_path='' as $$
begin
  -- The existing dispense and adjustment writers already lock this batch.
  -- Use the same lock before taking a balance for any movement insert.
  perform 1 from trustleaf_private.pilot_batches b where b.batch_ref=new.batch_ref for update;
  select coalesce(sum(m.quantity_mg),0) + new.quantity_mg into new.stock_after_mg
    from trustleaf_private.pilot_movements m where m.batch_ref=new.batch_ref;
  return new;
end $$;
revoke all on function trustleaf_private.pilot_record_movement_stock_after() from public,anon,authenticated,service_role;

create trigger pilot_record_movement_stock_after before insert on trustleaf_private.pilot_movements
  for each row execute function trustleaf_private.pilot_record_movement_stock_after();

alter function public.trustleaf_operations_pilot(text,text,jsonb) rename to pilot_before_movement_links;
alter function public.pilot_before_movement_links(text,text,jsonb) set schema trustleaf_private;
revoke all on function trustleaf_private.pilot_before_movement_links(text,text,jsonb) from public,anon,authenticated,service_role;

create function public.trustleaf_operations_pilot(p_subject text,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r jsonb;
  own_org uuid;
  enriched_deliveries jsonb;
begin
  r := trustleaf_private.pilot_before_movement_links(p_subject,p_action,p_input);
  if p_action <> 'snapshot' or r->>'role' is distinct from 'dispensary' or r->>'joined' is distinct from 'true' then
    return r;
  end if;
  own_org := (r->'membership'->>'organization_ref')::uuid;
  if own_org is null or not exists (
    select 1 from trustleaf_private.pilot_memberships m
    where m.organization_ref=own_org and m.actor_ref=(r->>'actorRef')::uuid
  ) then return r; end if;

  -- The general list is bounded, while own receipts retain their exact movement links.
  with listed as (
    select item.value->>'movement_ref' as movement_ref from jsonb_array_elements(r->'movements') item(value)
  )
  select coalesce(jsonb_agg(case when linked.movement_ref is null then item.value
    else item.value || jsonb_build_object('stock_movement',to_jsonb(linked)) end order by item.ordinality),'[]'::jsonb)
  into enriched_deliveries
  from jsonb_array_elements(r->'deliveries') with ordinality item(value,ordinality)
  left join lateral (
    select m.* from trustleaf_private.pilot_movements m
    join trustleaf_private.pilot_batches b on b.batch_ref=m.batch_ref
    where (item.value->>'organization_ref')::uuid=own_org and b.organization_ref=own_org
      and m.delivery_ref=(item.value->>'delivery_ref')::uuid and m.batch_ref=(item.value->>'batch_ref')::uuid
      and not exists (select 1 from listed where listed.movement_ref=m.movement_ref::text)
  ) linked on true;
  return r || jsonb_build_object('deliveries',enriched_deliveries);
end $$;
revoke all on function public.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_operations_pilot(text,text,jsonb) to service_role;

commit;
