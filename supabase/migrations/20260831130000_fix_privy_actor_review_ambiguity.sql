-- Resolve the PL/pgSQL output-column name collision in the review RPC.

create or replace function trustleaf_private.review_pending_privy_actor(
  admin_subject text, target_actor_ref uuid, expected_version bigint, decision text, operation_digest bytea
)
returns table (actor_ref uuid, role trustleaf_private.actor_role, actor_state trustleaf_private.lifecycle_state, version bigint)
language plpgsql security definer set search_path = trustleaf_private, pg_temp
as $$
declare admin_actor_ref uuid; target actor_bindings%rowtype; next_state lifecycle_state; prior_digest bytea; new_digest bytea;
begin
  select a.actor_ref into admin_actor_ref from external_identity_bindings i join actor_bindings a on a.actor_ref = i.actor_ref
  where i.provider = 'privy' and i.external_subject = admin_subject and i.state = 'active' and a.role = 'admin' and a.state = 'active';
  if admin_actor_ref is null then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if decision not in ('approve', 'reject') or expected_version < 1 or operation_digest is null or octet_length(operation_digest) <> 32 then raise exception 'REVIEW_INPUT_INVALID' using errcode = '22023'; end if;
  next_state := case when decision = 'approve' then 'active'::lifecycle_state else 'revoked'::lifecycle_state end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_actor_ref::text, 0));
  select a.* into target from actor_bindings a where a.actor_ref = target_actor_ref for update;
  if not found or target.role not in ('doctor', 'dispensary') or target.state <> 'pending' or target.version <> expected_version then raise exception 'ACTOR_CAS_CONFLICT' using errcode = '40001'; end if;
  update actor_bindings a set state = next_state, version = a.version + 1, updated_at = statement_timestamp() where a.actor_ref = target_actor_ref and a.version = expected_version;
  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into prior_digest from audit_events order by audit_seq desc limit 1;
  new_digest := pg_catalog.sha256(coalesce(prior_digest, '\x'::bytea) || operation_digest || pg_catalog.convert_to('privy.actor.review|' || target_actor_ref::text || '|' || next_state::text, 'UTF8'));
  insert into audit_events (actor_ref, action_code, resource_ref, outcome, previous_digest, event_digest) values (admin_actor_ref, 'actor.reviewed', target_actor_ref, 'allowed', prior_digest, new_digest);
  return query select target_actor_ref, target.role, next_state, target.version + 1;
end
$$;
