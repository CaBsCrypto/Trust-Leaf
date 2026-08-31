-- Qualify the RPC result columns. PostgreSQL otherwise sees the output-column
-- names and source-column names as ambiguous inside this SQL-language function.

create or replace function public.trustleaf_bootstrap_first_privy_admin(subject text)
returns table (
  actor_ref uuid,
  role text,
  actor_state text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select result.actor_ref, result.role::text, result.actor_state::text
  from trustleaf_private.bootstrap_first_privy_admin(subject) as result;
$$;

revoke all on function public.trustleaf_bootstrap_first_privy_admin(text) from public, anon, authenticated;
grant execute on function public.trustleaf_bootstrap_first_privy_admin(text) to service_role;
