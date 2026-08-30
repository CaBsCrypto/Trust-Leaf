-- The Vercel backend uses the server-only Supabase service key to call this
-- narrow resolver. Browser and authenticated roles remain unable to read the
-- underlying identity binding table.

begin;

grant usage on schema trustleaf_private to service_role;
grant execute on function trustleaf_private.resolve_privy_actor(text) to service_role;

commit;
