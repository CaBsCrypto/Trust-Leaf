-- TrustLeaf synthetic development baseline.
-- NO PII/PHI, real prescriptions, public API or production authorization.
-- This migration intentionally creates no RLS policies: enabled + forced RLS
-- with no policies is the first deny-by-default gate.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'trustleaf_server') then
    execute 'create role trustleaf_server nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'trustleaf_auditor') then
    execute 'create role trustleaf_auditor nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls';
  end if;
end
$$;

create schema trustleaf_private authorization postgres;
revoke all on schema trustleaf_private from public, anon, authenticated, service_role;

create type trustleaf_private.actor_role as enum ('doctor', 'patient', 'dispensary', 'admin');
create type trustleaf_private.lifecycle_state as enum ('pending', 'active', 'suspended', 'revoked', 'expired');
create type trustleaf_private.receipt_state as enum ('draft', 'issued', 'active', 'partial', 'dispensed', 'revoked', 'expired', 'unknown');

create table trustleaf_private.actor_bindings (
  actor_ref uuid primary key,
  auth_subject uuid not null unique,
  role trustleaf_private.actor_role not null,
  state trustleaf_private.lifecycle_state not null default 'pending',
  version bigint not null default 1 check (version > 0),
  valid_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table trustleaf_private.encrypted_objects (
  object_ref uuid primary key,
  owner_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  object_kind text not null check (object_kind in ('identity_evidence', 'consent', 'encounter', 'clinical_note', 'receipt_detail')),
  ciphertext bytea not null check (octet_length(ciphertext) > 16),
  wrapped_dek bytea not null check (octet_length(wrapped_dek) > 16),
  kms_key_version text not null check (char_length(kms_key_version) between 1 and 128),
  aad_digest bytea not null check (octet_length(aad_digest) = 32),
  version bigint not null check (version > 0),
  retention_class text not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (object_ref, version)
);

create table trustleaf_private.relationship_grants (
  grant_ref uuid primary key,
  object_ref uuid not null references trustleaf_private.encrypted_objects(object_ref),
  subject_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  grantee_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  scope text not null check (scope in ('consent:read', 'encounter:read', 'encounter:write', 'receipt:read', 'receipt:operate')),
  state trustleaf_private.lifecycle_state not null,
  version bigint not null check (version > 0),
  valid_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (object_ref, grantee_actor_ref, scope)
);

create table trustleaf_private.patient_entitlements (
  entitlement_ref uuid primary key,
  patient_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  doctor_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  consent_state trustleaf_private.lifecycle_state not null,
  eligibility_state trustleaf_private.lifecycle_state not null,
  directory_enabled boolean not null default false,
  version bigint not null check (version > 0),
  valid_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (not directory_enabled or (consent_state = 'active' and eligibility_state = 'active'))
);

create table trustleaf_private.receipt_bindings (
  receipt_ref uuid primary key,
  patient_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  doctor_actor_ref uuid not null references trustleaf_private.actor_bindings(actor_ref),
  encrypted_detail_ref uuid not null references trustleaf_private.encrypted_objects(object_ref),
  public_lookup_digest bytea not null unique check (octet_length(public_lookup_digest) = 32),
  chain_commitment bytea check (chain_commitment is null or octet_length(chain_commitment) = 32),
  technical_state trustleaf_private.receipt_state not null default 'draft',
  version bigint not null check (version > 0),
  valid_until timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create table trustleaf_private.audit_events (
  audit_seq bigint generated always as identity primary key,
  occurred_at timestamptz not null default statement_timestamp(),
  actor_ref uuid,
  action_code text not null check (char_length(action_code) between 3 and 96),
  resource_ref uuid,
  outcome text not null check (outcome in ('allowed', 'denied', 'error')),
  previous_digest bytea check (previous_digest is null or octet_length(previous_digest) = 32),
  event_digest bytea not null unique check (octet_length(event_digest) = 32)
);

create table trustleaf_private.idempotency_journal (
  operation_digest bytea primary key check (octet_length(operation_digest) = 32),
  actor_ref uuid not null,
  intent_digest bytea not null check (octet_length(intent_digest) = 32),
  outcome_ref uuid,
  created_at timestamptz not null default statement_timestamp()
);

alter table trustleaf_private.actor_bindings enable row level security;
alter table trustleaf_private.actor_bindings force row level security;
alter table trustleaf_private.encrypted_objects enable row level security;
alter table trustleaf_private.encrypted_objects force row level security;
alter table trustleaf_private.relationship_grants enable row level security;
alter table trustleaf_private.relationship_grants force row level security;
alter table trustleaf_private.patient_entitlements enable row level security;
alter table trustleaf_private.patient_entitlements force row level security;
alter table trustleaf_private.receipt_bindings enable row level security;
alter table trustleaf_private.receipt_bindings force row level security;
alter table trustleaf_private.audit_events enable row level security;
alter table trustleaf_private.audit_events force row level security;
alter table trustleaf_private.idempotency_journal enable row level security;
alter table trustleaf_private.idempotency_journal force row level security;

revoke all on all tables in schema trustleaf_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema trustleaf_private from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema trustleaf_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema trustleaf_private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema trustleaf_private revoke all on functions from public, anon, authenticated, service_role;

create function trustleaf_private.reject_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'AUDIT_LOG_APPEND_ONLY' using errcode = '42501';
end
$$;

revoke all on function trustleaf_private.reject_audit_mutation() from public, anon, authenticated, service_role;

create trigger audit_events_append_only
before update or delete on trustleaf_private.audit_events
for each row execute function trustleaf_private.reject_audit_mutation();

comment on schema trustleaf_private is 'Synthetic TrustLeaf development schema; no PII/PHI and no public API exposure.';
comment on table trustleaf_private.encrypted_objects is 'Application-encrypted payload envelopes; external KMS remains a separate future gate.';
comment on table trustleaf_private.receipt_bindings is 'Opaque off-chain to receipt mapping; never clinical payload or public identifier.';

commit;
