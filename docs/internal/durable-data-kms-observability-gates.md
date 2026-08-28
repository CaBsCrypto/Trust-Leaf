# Durable data, custody and observability gates

Status: local preparation only (2026-08-22). No cloud adapter is connected and no Testnet submission is permitted.

## Implemented and locally verified

- `EncryptedRepositoryPort` keeps the future Postgres/Supabase adapter replaceable. The only implementation is in-memory and synthetic.
- `KeyCustodyPort` models KMS/HSM wrapping without exporting a master key. Local tests use a fixture KEK only.
- A random data-encryption key per row uses AES-256-GCM. AAD binds schema, opaque identifier and revision; moving or modifying an envelope fails authentication.
- Key versions are recorded. Rotation re-wraps only the data key, preserving ciphertext and prior key versions for controlled migration.
- HMAC-based opaque mappings do not expose the source identifier. Payload keys commonly associated with PII/PHI or clinical content fail closed.
- Optimistic compare-and-swap prevents lost updates. Audit entries are append-only, sequenced and hash-chained without plaintext identifiers.
- Recursive structured-log redaction, bounded traversal, secret-pattern filtering and fail-closed fixed-window rate limiting are test-covered.
- Durable mode requires explicit mode/retention. Postgres mode additionally requires a Postgres URL, KMS key identifier and recent backup-verification marker.

## Human gates before connecting a durable adapter

1. Privacy/security approve the exact minimal off-chain schema, data classification, retention and deletion/legal-hold policy.
2. Platform creates separate non-production database and KMS/HSM identities with least privilege, network isolation and audited break-glass access.
3. Database adapter receives migrations, row-level tenant/role isolation, transaction-level atomic CAS plus audit append, and append-only audit permissions; rollback is rehearsed.
4. KMS policy separates encrypt/decrypt, rotate and disable/destroy duties. Rotation and unavailable/disabled-key recovery drills must pass.
5. Backup restore is executed into an isolated environment; record RPO/RTO evidence and refresh `TRUSTLEAF_BACKUP_VERIFIED_AT` through controlled configuration.
6. Security validates log sinks, sampling, retention and alerts contain no PII/PHI, secrets, QR tokens, ciphertext or raw opaque IDs.
7. Rate-limit subject derivation must use authenticated server-side actor/tenant scopes and a distributed atomic backend; proxy/IP trust rules require review.
8. Concurrency/load, tamper, disaster recovery and access-revocation tests pass with synthetic fixtures. Threat model and incident runbook are signed off.
9. Separate explicit authorization is required for any cloud connection, real credentials, Testnet submission, production deploy or non-synthetic data.

## Explicitly pending / not claimed

- No Postgres/Supabase client, migration, cloud KMS/HSM, distributed limiter, backup, restore, retention deletion or SIEM integration exists yet.
- The in-memory adapter is test evidence, not durable storage. The fixture custody provider is not suitable for deployment.
- No clinical/legal validity, real patient validation, production readiness or regulatory compliance is claimed.
- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` remains mandatory; this sprint creates no transaction.

The synthetic object-authorization mapping built on this port is documented in
[`durable-receipt-mapping-phase2.md`](./durable-receipt-mapping-phase2.md).
