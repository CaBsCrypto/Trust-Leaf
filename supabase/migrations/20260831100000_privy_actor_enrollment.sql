-- Privy authenticates the person. This private binding assigns only the
-- minimum Trust Leaf role and lifecycle state; it contains no clinical data.

create or replace function trustleaf_private.enroll_privy_actor(subject text, requested_role trustleaf_private.actor_role)
returns table (actor_ref uuid, role trustleaf_private.actor_role, actor_state trustleaf_private.lifecycle_state, valid_until timestamptz)
language plpgsql security definer set search_path = trustleaf_private, pg_temp
as $$
declare
  new_actor_ref uuid;
  prior_audit_digest bytea;
  new_audit_digest bytea;
  requested_state trustleaf_private.lifecycle_state;
begin
  if subject is null or char_length(subject) < 16 or char_length(subject) > 500
    or subject !~ '^did:privy:[A-Za-z0-9._:-]+$' then
    raise exception 'PRIVY_SUBJECT_INVALID' using errcode = '22023';
  end if;
  if requested_role not in ('patient', 'doctor', 'dispensary') then
    raise exception 'PRIVY_ROLE_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(42826004);
  return query select a.actor_ref, a.role, a.state, a.valid_until
  from external_identity_bindings i join actor_bindings a on a.actor_ref = i.actor_ref
  where i.provider = 'privy' and i.external_subject = subject and i.state = 'active';
  if found then return; end if;

  requested_state := case when requested_role = 'patient' then 'active'::lifecycle_state else 'pending'::lifecycle_state end;
  new_actor_ref := pg_catalog.gen_random_uuid();
  insert into actor_bindings (actor_ref, auth_subject, role, state)
  values (new_actor_ref, pg_catalog.gen_random_uuid(), requested_role, requested_state);
  insert into external_identity_bindings (provider, external_subject, actor_ref, state)
  values ('privy', subject, new_actor_ref, 'active');

  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into prior_audit_digest from audit_events order by audit_seq desc limit 1;
  new_audit_digest := pg_catalog.sha256(coalesce(prior_audit_digest, '\x'::bytea)
    || pg_catalog.convert_to('privy.actor.enroll|' || requested_role::text || '|' || new_actor_ref::text, 'UTF8'));
  insert into audit_events (actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest)
  values (new_actor_ref, 'actor.enrolled', new_actor_ref, case when requested_state = 'active' then 'allowed' else 'pending' end, prior_audit_digest, new_audit_digest);

  return query select new_actor_ref, requested_role, requested_state, null::timestamptz;
end
$$;

create or replace function public.trustleaf_enroll_privy_actor(subject text, requested_role text)
returns table (actor_ref uuid, role text, actor_state text, valid_until timestamptz)
language sql security definer set search_path = pg_catalog, public
as $$
  select actor_ref, role::text, actor_state::text, valid_until
  from trustleaf_private.enroll_privy_actor(subject, requested_role::trustleaf_private.actor_role);
$$;

revoke all on function trustleaf_private.enroll_privy_actor(text, trustleaf_private.actor_role) from public, anon, authenticated, service_role, trustleaf_auditor;
grant execute on function trustleaf_private.enroll_privy_actor(text, trustleaf_private.actor_role) to service_role;
revoke all on function public.trustleaf_enroll_privy_actor(text, text) from public, anon, authenticated;
grant execute on function public.trustleaf_enroll_privy_actor(text, text) to service_role;
comment on function public.trustleaf_enroll_privy_actor(text, text) is 'Server-only Privy actor enrollment; patients activate immediately, regulated actors require approval.';
