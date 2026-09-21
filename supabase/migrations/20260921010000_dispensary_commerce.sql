begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

create table trustleaf_private.commerce_products (
  product_ref uuid primary key default gen_random_uuid(),
  organization_ref uuid not null references trustleaf_private.pilot_organizations,
  code text not null check(length(code) between 1 and 64 and code = upper(btrim(code))),
  name text not null check(length(btrim(name)) between 1 and 160),
  presentation text not null default '' check(length(presentation)<=160),
  reference_price_clp bigint check(reference_price_clp between 0 and 1000000000),
  reorder_mg bigint not null default 0 check(reorder_mg between 0 and 1000000000),
  archived boolean not null default false,
  version integer not null default 1,
  unique(organization_ref,code), unique(organization_ref,product_ref)
);
create table trustleaf_private.commerce_suppliers (
  supplier_ref uuid primary key default gen_random_uuid(),
  organization_ref uuid not null references trustleaf_private.pilot_organizations,
  name text not null check(length(btrim(name)) between 1 and 160),
  internal_reference text not null default '' check(length(internal_reference)<=120),
  contact text check(length(contact)<=300),
  archived boolean not null default false,
  version integer not null default 1,
  unique(organization_ref,supplier_ref)
);
create table trustleaf_private.commerce_batch_links (
  batch_ref uuid primary key references trustleaf_private.pilot_batches,
  organization_ref uuid not null references trustleaf_private.pilot_organizations,
  product_ref uuid not null,
  supplier_ref uuid,
  foreign key(organization_ref,product_ref) references trustleaf_private.commerce_products(organization_ref,product_ref),
  foreign key(organization_ref,supplier_ref) references trustleaf_private.commerce_suppliers(organization_ref,supplier_ref)
);
create table trustleaf_private.commerce_receipts (
  receipt_ref uuid primary key default gen_random_uuid(),
  organization_ref uuid not null references trustleaf_private.pilot_organizations,
  batch_ref uuid not null unique references trustleaf_private.pilot_batches,
  product_ref uuid not null,
  supplier_ref uuid,
  quantity_mg bigint not null check(quantity_mg between 1 and 1000000000),
  cost_clp bigint check(cost_clp between 0 and 1000000000),
  operator_ref uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  foreign key(organization_ref,product_ref) references trustleaf_private.commerce_products(organization_ref,product_ref),
  foreign key(organization_ref,supplier_ref) references trustleaf_private.commerce_suppliers(organization_ref,supplier_ref)
);
create index commerce_receipts_org on trustleaf_private.commerce_receipts(organization_ref,created_at,receipt_ref);
create table trustleaf_private.commerce_operations (
  actor_ref uuid not null, operation_id uuid not null, intent bytea not null,
  result jsonb not null, primary key(actor_ref,operation_id)
);
alter table trustleaf_private.commerce_products enable row level security;
alter table trustleaf_private.commerce_suppliers enable row level security;
alter table trustleaf_private.commerce_batch_links enable row level security;
alter table trustleaf_private.commerce_receipts enable row level security;
alter table trustleaf_private.commerce_operations enable row level security;
revoke all on trustleaf_private.commerce_products,trustleaf_private.commerce_suppliers,
  trustleaf_private.commerce_batch_links,trustleaf_private.commerce_receipts,
  trustleaf_private.commerce_operations from public,anon,authenticated,service_role;

create function public.trustleaf_dispensary_commerce(p_subject text,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  a record; m trustleaf_private.pilot_memberships%rowtype;
  product trustleaf_private.commerce_products%rowtype;
  prior trustleaf_private.commerce_operations%rowtype;
  op uuid; ref uuid; supplier uuid; batch uuid; resource uuid;
  result jsonb; items jsonb; page_size integer; page_offset integer; fingerprint bytea;
begin
  select * into a from trustleaf_private.resolve_privy_actor(p_subject);
  if not found or a.role<>'dispensary' or a.actor_state<>'active'
    or (a.valid_until is not null and a.valid_until<=statement_timestamp()) then
    raise exception 'COMMERCE_FORBIDDEN' using errcode='42501';
  end if;
  -- Coordinate with membership removal before inspecting or mutating organization data.
  perform pg_advisory_xact_lock(hashtextextended('pilot-member|'||a.actor_ref::text,0));
  select * into m from trustleaf_private.pilot_memberships where actor_ref=a.actor_ref for share;
  if not found or not exists(select 1 from trustleaf_private.pilot_participants where actor_ref=a.actor_ref) then
    raise exception 'COMMERCE_FORBIDDEN' using errcode='42501';
  end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>12000
    or p_action is null or p_action not in ('products','suppliers','receipts','save-product','save-supplier','receive','link-batch') then
    raise exception 'COMMERCE_INPUT_INVALID' using errcode='22023';
  end if;
  if p_action in ('products','suppliers','receipts') then
    page_size:=coalesce((p_input->>'limit')::integer,25);
    page_offset:=coalesce((p_input->>'offset')::integer,0);
    if page_size not between 1 and 100 or page_offset not between 0 and 100000 then
      raise exception 'COMMERCE_PAGE_INVALID' using errcode='22023';
    end if;
    if p_action='products' then
      select coalesce(jsonb_agg(to_jsonb(t)),'[]') into items from (
        select product_ref,code,name,presentation,reference_price_clp,reorder_mg,archived,version
        from trustleaf_private.commerce_products where organization_ref=m.organization_ref
        order by code,product_ref limit page_size+1 offset page_offset) t;
    elsif p_action='suppliers' then
      if m.role<>'manager' then raise exception 'COMMERCE_FORBIDDEN' using errcode='42501'; end if;
      select coalesce(jsonb_agg(to_jsonb(t)),'[]') into items from (
        select supplier_ref,name,internal_reference,contact,archived,version
        from trustleaf_private.commerce_suppliers where organization_ref=m.organization_ref
        order by name,supplier_ref limit page_size+1 offset page_offset) t;
    else
      select coalesce(jsonb_agg(case when m.role='manager' then to_jsonb(t) else to_jsonb(t)-'cost_clp' end),'[]') into items from (
        select receipt_ref,batch_ref,product_ref,supplier_ref,quantity_mg,cost_clp,created_at
        from trustleaf_private.commerce_receipts where organization_ref=m.organization_ref
        order by created_at desc,receipt_ref limit page_size+1 offset page_offset) t;
    end if;
    return jsonb_build_object('synthetic',true,'items',case when jsonb_array_length(items)>page_size then items-page_size else items end,
      'nextOffset',case when jsonb_array_length(items)>page_size then page_offset+page_size else null end);
  end if;
  if m.role<>'manager' then raise exception 'COMMERCE_FORBIDDEN' using errcode='42501'; end if;
  op:=(p_input->>'operationId')::uuid;
  if op is null then raise exception 'COMMERCE_OPERATION_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('commerce-op|'||a.actor_ref::text||op::text,0));
  fingerprint:=sha256(convert_to(p_action||'|'||p_input::text,'UTF8'));
  select * into prior from trustleaf_private.commerce_operations where actor_ref=a.actor_ref and operation_id=op;
  if found then
    if prior.intent<>fingerprint then raise exception 'COMMERCE_REPLAY_CONFLICT' using errcode='PT409'; end if;
    return prior.result||jsonb_build_object('replayed',true);
  end if;
  ref:=(p_input->>'resourceRef')::uuid;
  if p_action='save-product' then
    if ref is null then
      insert into trustleaf_private.commerce_products(organization_ref,code,name,presentation,reference_price_clp,reorder_mg,archived)
      values(m.organization_ref,upper(btrim(p_input->>'code')),btrim(p_input->>'name'),p_input->>'presentation',
        (p_input->>'referencePriceClp')::bigint,(p_input->>'reorderMg')::bigint,(p_input->>'archived')::boolean) returning product_ref into resource;
    else
      update trustleaf_private.commerce_products set code=upper(btrim(p_input->>'code')),name=btrim(p_input->>'name'),
        presentation=p_input->>'presentation',reference_price_clp=(p_input->>'referencePriceClp')::bigint,
        reorder_mg=(p_input->>'reorderMg')::bigint,archived=(p_input->>'archived')::boolean,version=version+1
      where organization_ref=m.organization_ref and product_ref=ref and version=(p_input->>'version')::integer returning product_ref into resource;
    end if;
  elsif p_action='save-supplier' then
    if ref is null then
      insert into trustleaf_private.commerce_suppliers(organization_ref,name,internal_reference,contact,archived)
      values(m.organization_ref,btrim(p_input->>'name'),p_input->>'internalReference',p_input->>'contact',(p_input->>'archived')::boolean)
      returning supplier_ref into resource;
    else
      update trustleaf_private.commerce_suppliers set name=btrim(p_input->>'name'),internal_reference=p_input->>'internalReference',
        contact=p_input->>'contact',archived=(p_input->>'archived')::boolean,version=version+1
      where organization_ref=m.organization_ref and supplier_ref=ref and version=(p_input->>'version')::integer returning supplier_ref into resource;
    end if;
  else
    select * into product from trustleaf_private.commerce_products where product_ref=(p_input->>'productRef')::uuid
      and organization_ref=m.organization_ref and not archived for share;
    if not found then raise exception 'COMMERCE_PRODUCT_UNAVAILABLE' using errcode='PT409'; end if;
    supplier:=(p_input->>'supplierRef')::uuid;
    if supplier is not null then
      perform 1 from trustleaf_private.commerce_suppliers where supplier_ref=supplier and organization_ref=m.organization_ref and not archived for share;
      if not found then raise exception 'COMMERCE_SUPPLIER_UNAVAILABLE' using errcode='PT409'; end if;
    end if;
    if p_action='receive' then
      perform pg_advisory_xact_lock(hashtextextended('pilot-op|'||a.actor_ref::text||op::text,0));
      if exists(select 1 from trustleaf_private.pilot_operations where actor_ref=a.actor_ref and operation_id=op) then
        raise exception 'COMMERCE_OPERATION_CONFLICT' using errcode='PT409';
      end if;
      result:=public.trustleaf_operations_pilot(p_subject,'receive-batch',jsonb_build_object(
        'operationId',op,'lotCode',p_input->>'lotCode','product',product.name,'sourceReference',p_input->>'sourceReference',
        'expiresAt',p_input->>'expiresAt','quantityMg',p_input->'quantityMg'));
      batch:=(result->>'resourceRef')::uuid;
      insert into trustleaf_private.commerce_receipts(organization_ref,batch_ref,product_ref,supplier_ref,quantity_mg,cost_clp,operator_ref)
      values(m.organization_ref,batch,product.product_ref,supplier,(p_input->>'quantityMg')::bigint,(p_input->>'costClp')::bigint,a.actor_ref)
      returning receipt_ref into resource;
    else
      update trustleaf_private.pilot_batches set version=version+1
      where batch_ref=ref and organization_ref=m.organization_ref and version=(p_input->>'version')::integer returning batch_ref into batch;
      if batch is null then raise exception 'COMMERCE_BATCH_CONFLICT' using errcode='PT409'; end if;
      resource:=batch;
    end if;
    insert into trustleaf_private.commerce_batch_links values(batch,m.organization_ref,product.product_ref,supplier)
    on conflict(batch_ref) do update set product_ref=excluded.product_ref,supplier_ref=excluded.supplier_ref;
  end if;
  if resource is null then raise exception 'COMMERCE_VERSION_CONFLICT' using errcode='PT409'; end if;
  result:=jsonb_build_object('resourceRef',resource,'synthetic',true,'replayed',false);
  if batch is not null then result:=result||jsonb_build_object('batchRef',batch); end if;
  insert into trustleaf_private.commerce_operations values(a.actor_ref,op,fingerprint,result);
  insert into trustleaf_private.pilot_audit(actor_ref,action,resource_ref) values(a.actor_ref,'commerce-'||p_action,resource);
  return result;
end $$;
revoke all on function public.trustleaf_dispensary_commerce(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_dispensary_commerce(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
