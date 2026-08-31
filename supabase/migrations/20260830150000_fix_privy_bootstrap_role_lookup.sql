-- Output-column names are variables in PL/pgSQL. Qualify the table column to
-- keep the single-admin check unambiguous.

create or replace function trustleaf_private.bootstrap_first_privy_admin(subject text)
returns table (
  actor_ref uuid,
  role trustleaf_private.actor_role,
  actor_state trustleaf_private.lifecycle_state,
  valid_until timestamptz
)
language plpgsql
security definer
set search_path = trustleaf_private, pg_temp
as $$
declare
  new_actor_ref uuid;
  prior_audit_digest bytea;
  new_audit_digest bytea;
begin
  if subject is null
    or char_length(subject) < 16
    or char_length(subject) > 500
    or subject !~ '^did:privy:[A-Za-z0-9._:-]+$' then
    raise exception 'PRIVY_SUBJECT_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(42826003);
  return query
  select a.actor_ref, a.role, a.state, a.valid_until
  from external_identity_bindings i
  join actor_bindings a on a.actor_ref = i.actor_ref
  where i.provider = 'privy' and i.external_subject = subject and i.state = 'active';
  if found then return; end if;

  if exists (select 1 from actor_bindings as existing_actor where existing_actor.role = 'admin') then
    raise exception 'ADMIN_BOOTSTRAP_ALREADY_COMPLETED' using errcode = '23505';
  end if;

  new_actor_ref := pg_catalog.gen_random_uuid();
  insert into actor_bindings (actor_ref, auth_subject, role, state)
  values (new_actor_ref, pg_catalog.gen_random_uuid(), 'admin', 'active');
  insert into external_identity_bindings (provider, external_subject, actor_ref, state)
  values ('privy', subject, new_actor_ref, 'active');

  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into prior_audit_digest from audit_events order by audit_seq desc limit 1;
  new_audit_digest := pg_catalog.sha256(
    coalesce(prior_audit_digest, '\x'::bytea)
    || pg_catalog.convert_to('privy.admin.bootstrap|' || new_actor_ref::text, 'UTF8')
  );
  insert into audit_events (actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest)
  values (new_actor_ref, 'actor.admin.bootstrap', new_actor_ref, 'allowed', prior_audit_digest, new_audit_digest);

  return query select new_actor_ref, 'admin'::actor_role, 'active'::lifecycle_state, null::timestamptz;
end
$$;

revoke all on function trustleaf_private.bootstrap_first_privy_admin(text)
from public, anon, authenticated, service_role, trustleaf_auditor;
grant usage on schema trustleaf_private to service_role;
grant execute on function trustleaf_private.bootstrap_first_privy_admin(text) to service_role;
