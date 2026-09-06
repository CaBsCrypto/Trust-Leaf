begin;

create function trustleaf_private.list_privy_actor_directory(admin_subject text, page_offset integer default 0)
returns table (actor_ref uuid, external_subject text, role text, actor_state text, created_at timestamptz)
language plpgsql security definer
set search_path = trustleaf_private, pg_temp
as $$
begin
  if page_offset is null or page_offset < 0 or page_offset > 100000 then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if not exists (
    select 1 from external_identity_bindings i join actor_bindings a on a.actor_ref = i.actor_ref
    where i.provider = 'privy' and i.external_subject = admin_subject and i.state = 'active'
      and a.role = 'admin' and a.state = 'active'
      and (a.valid_until is null or a.valid_until > statement_timestamp())
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  return query
    select a.actor_ref, i.external_subject, a.role::text, a.state::text, a.created_at
    from actor_bindings a join external_identity_bindings i on i.actor_ref = a.actor_ref
    where i.provider = 'privy' and i.state = 'active'
    order by a.created_at, a.actor_ref, i.external_subject
    limit 26 offset page_offset;
end;
$$;

create function public.trustleaf_privy_actor_directory(admin_subject text, page_offset integer default 0)
returns table (actor_ref uuid, external_subject text, role text, actor_state text, created_at timestamptz)
language sql security definer set search_path = pg_catalog, pg_temp
as $$ select * from trustleaf_private.list_privy_actor_directory(admin_subject, page_offset); $$;

revoke all on function trustleaf_private.list_privy_actor_directory(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.trustleaf_privy_actor_directory(text, integer) from public, anon, authenticated;
grant execute on function public.trustleaf_privy_actor_directory(text, integer) to service_role;
commit;
