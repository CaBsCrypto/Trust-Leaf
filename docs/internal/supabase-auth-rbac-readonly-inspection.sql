-- TrustLeaf Auth/RBAC inspection package.
-- READ ONLY: execute only inside a read-only transaction through official MCP.
-- This is not a migration and must never be placed in supabase/migrations/.

begin transaction read only;

select jsonb_build_object(
  'schema_exists', exists (
    select 1 from pg_namespace where nspname = 'trustleaf_private'
  ),
  'table_count', (
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'trustleaf_private' and c.relkind = 'r'
  ),
  'rls_enabled', (
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'trustleaf_private' and c.relkind = 'r' and c.relrowsecurity
  ),
  'rls_forced', (
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'trustleaf_private' and c.relkind = 'r' and c.relforcerowsecurity
  ),
  'policy_count', (
    select count(*) from pg_policies where schemaname = 'trustleaf_private'
  ),
  'migration_count', (
    select count(*) from supabase_migrations.schema_migrations
    where name in ('trustleaf_synthetic_security_baseline', 'trustleaf_auth_rbac_minimum')
  ),
  'roles', (
    select jsonb_agg(jsonb_build_object(
      'name', rolname, 'login', rolcanlogin, 'inherit', rolinherit,
      'bypassrls', rolbypassrls, 'superuser', rolsuper
    ) order by rolname)
    from pg_roles where rolname in ('trustleaf_server', 'trustleaf_auditor')
  ),
  'auth_uid_policy_count', (
    select count(*) from pg_policies
    where schemaname = 'trustleaf_private'
      and (qual like '%auth.uid%' or with_check like '%auth.uid%')
  ),
  'direct_write_grants_to_authenticated', (
    select count(*) from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'trustleaf_private'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  'audit_trigger_count', (
    select count(*) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'trustleaf_private'
      and c.relname = 'audit_events'
      and not t.tgisinternal
      and pg_get_triggerdef(t.oid) ilike '%before%update%or delete%'
  )
) as trustleaf_auth_rbac_readiness;

commit;
