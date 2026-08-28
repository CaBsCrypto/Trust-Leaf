# Phase 2: opaque receipt access mapping

Status: implemented and verified for local synthetic fixtures only (2026-08-24).

This component prepares the durable `subject -> actor -> receipt -> QR` access
mapping without connecting a database, IdP, KMS/HSM or Stellar submission path.
It is technical security evidence, not evidence of clinical or legal validity.

## Implemented and verified

- `api/_lib/durable-receipt-mapping.ts` exposes `DurableReceiptMappingPort`.
- The port accepts the authenticated `AuthorizedPrincipal` produced by the
  server-side JWT/RBAC layer. Actor role and scope must agree with that
  principal; email, wallet address, XDR or a client-provided identity cannot be
  used as an actor binding.
- JWT subjects, trusted synthetic actor identifiers, synthetic receipt
  identifiers and QR handles are converted to keyed HMAC references before
  lookup. Raw values are not stored as repository keys or audit identifiers.
- Mapping payloads are written through the existing per-row AES-256-GCM
  envelope store. AAD binds the opaque key and revision; CAS and the hash-chain
  audit controls continue to apply.
- The receipt record contains only opaque owner, issuer, assigned operator and
  public-lookup references. It contains no identity, clinical content, amount,
  prescription body, wallet address or Stellar transaction envelope.
- A QR handle is a random 256-bit lookup capability. It contains no embedded
  fields and resolves internally only to an opaque receipt reference. Public UI
  response minimization remains the responsibility of the existing public
  verifier; this port never returns receipt detail from public lookup.
- Access is object-specific: the bound owner can read, the bound issuer can
  read, an assigned dispensary can read/operate, and a bound admin can perform
  administrative reads. Cross-patient, unassigned-dispensary, role-swapped and
  insufficient-scope requests fail closed.
- Idempotency intent and outcome are encrypted. An exact retry returns the same
  QR handle and opaque receipt reference; reusing the operation key with a
  changed owner, receipt or operator set returns
  `IDEMPOTENCY_REPLAY_MISMATCH`.
- Only identifiers bearing the explicit `fixture-*` form are accepted by this
  local adapter. Both Testnet mutation flags remain `false`.

Evidence command:

```text
npm run test:durable-receipt-mapping
```

The suite covers adapter fail-closed behavior, key-length gates, binding and
replay, manipulated client values, authorized access for all four roles,
cross-role and cross-object denial, QR tamper/not-found behavior, absence of
submission calls and the two disabled mutation flags. Encryption, AAD, CAS,
tamper, key rotation and audit-chain evidence remains in:

```text
npm run test:durable-data-controls
```

## Adapter boundary

`memory-fixture` is the only executable mapping adapter. Its serialization lock
is process-local and exists solely to make synthetic concurrency deterministic.
Selecting `postgres` returns `DURABLE_MAPPING_ADAPTER_UNAVAILABLE`; having a URL
or KMS key name does not bypass that denial.

Before a real durable adapter can be enabled, the database must atomically
commit all of the following in one transaction:

1. subject/actor forward and reverse binding;
2. receipt access record;
3. QR lookup record;
4. idempotency journal and append-only audit entry.

## Remaining gates

1. Choose and provision a non-production IdP, database and KMS/HSM under
   separate explicit authorization. No resource has been configured here.
2. Define trusted server-side workflows that select patient and dispensary
   subjects. The HTTP client must never choose an arbitrary subject directly.
3. Implement the Postgres transaction adapter, unique constraints, RLS/tenant
   policy, distributed concurrency tests and audited migrations.
4. Implement a real KMS/HSM custody provider, key policy and rotation/recovery
   drills. Fixture KEKs are not deployable.
5. Connect operational legacy handlers only after each handler derives its
   receipt identifier from the durable binding and discards identity, address
   and XDR fields supplied by the client.
6. Add revocation/expiry of actor bindings and QR handles, retention/deletion
   policy, backup/restore evidence and incident handling.
7. Run HTTP E2E tests using signed synthetic JWTs and an isolated durable test
   database. No real patient, clinician or dispensary record is permitted.
8. Keep `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` and
   `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`; this phase authorizes no new
   transaction, deployment or production merge.
