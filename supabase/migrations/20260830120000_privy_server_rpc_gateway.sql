-- The private schema remains outside Supabase's public REST API. These narrow
-- gateways are callable only by the Vercel backend using the service-role key.

create function public.trustleaf_resolve_privy_actor(subject text)
returns table (
  actor_ref uuid,
  role text,
  actor_state text,
  valid_until timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select actor_ref, role::text, actor_state::text, valid_until
  from trustleaf_private.resolve_privy_actor(subject);
$$;

create function public.trustleaf_bootstrap_first_privy_admin(subject text)
returns table (
  actor_ref uuid,
  role text,
  actor_state text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select actor_ref, role::text, actor_state::text
  from trustleaf_private.bootstrap_first_privy_admin(subject);
$$;

revoke all on function public.trustleaf_resolve_privy_actor(text) from public, anon, authenticated;
revoke all on function public.trustleaf_bootstrap_first_privy_admin(text) from public, anon, authenticated;
grant execute on function public.trustleaf_resolve_privy_actor(text) to service_role;
grant execute on function public.trustleaf_bootstrap_first_privy_admin(text) to service_role;

comment on function public.trustleaf_resolve_privy_actor(text) is
  'Server-only Privy role lookup; exposes no clinical data.';
comment on function public.trustleaf_bootstrap_first_privy_admin(text) is
  'Server-only first admin bootstrap; restricted to service_role.';
