-- Privy identity bridge. A Privy DID proves session identity, while actor role
-- and lifecycle stay in Trust Leaf's private authorization schema.
--
-- This table is intentionally inaccessible from anon/authenticated clients.
-- A verified server operation is the only path to create or revoke a binding.

begin;

create type trustleaf_private.identity_provider as enum ('privy');

create table trustleaf_private.external_identity_bindings (
  provider trustleaf_private.identity_provider not null,
  external_subject text not null check (char_length(external_subject) between 8 and 512),
  actor_ref uuid not null unique references trustleaf_private.actor_bindings(actor_ref),
  state trustleaf_private.lifecycle_state not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  primary key (provider, external_subject),
  check ((state = 'revoked') = (revoked_at is not null))
);

alter table trustleaf_private.external_identity_bindings enable row level security;
alter table trustleaf_private.external_identity_bindings force row level security;
revoke all on trustleaf_private.external_identity_bindings from public, anon, authenticated, service_role;

-- This RPC exposes only authorization state to the verified application server.
-- Browser roles receive no execute grant and cannot discover identity bindings.
create function trustleaf_private.resolve_privy_actor(subject text)
returns table (
  actor_ref uuid,
  role trustleaf_private.actor_role,
  actor_state trustleaf_private.lifecycle_state,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path = trustleaf_private, pg_temp
as $$
  select actor.actor_ref, actor.role, actor.state, actor.valid_until
  from external_identity_bindings identity
  join actor_bindings actor on actor.actor_ref = identity.actor_ref
  where identity.provider = 'privy'
    and identity.external_subject = subject
    and identity.state = 'active';
$$;

revoke all on function trustleaf_private.resolve_privy_actor(text) from public, anon, authenticated, service_role;

commit;
