# ReceiptLedgerV2 read-only RPC/indexer runbook

Status: **implemented and verified locally; NO-GO for live V2 evidence until ReceiptLedgerV2 is deployed and its exact configuration is approved**.

This service is a server-side, read-only evidence reader. It cannot submit, simulate or sign transactions. It indexes only opaque `ReceiptChanged` V2 events; it is not a clinical record, a legal validation service or a source of patient identity.

## Verified controls

- Exact allowlists cover Stellar Testnet, its network passphrase, HTTPS RPC URL, ReceiptLedgerV2 contract ID and deployed WASM SHA-256. Both mutation flags must be literal `false`.
- The RPC transport is lazy and dependency-injected. Constructing it makes no network request; the fixture path is the default test path.
- Startup attests the RPC network passphrase and hashes the bytecode returned for the exact contract before any event poll. A mismatch remains fail-closed.
- Event decoding accepts only successful `ReceiptChanged` events from the exact contract, schema version `2`, known receipt states, 32-byte opaque receipt/operation IDs and monotonic positive versions. `GrantChanged` and unrelated events are ignored.
- Ledgers are read in order with hash/parent linkage. Same-ledger replay is idempotent; a changed tip is replaced; parent mismatch triggers a conservative durable rewind and bounded refetch. Gaps, bad parents, schema drift and page-limit exhaustion stop advancement.
- Event pagination, RPC timeout, retry count, finality depth and local journal retention are bounded. Exhausted reads become `unknown`; no optimistic state is emitted.
- The local journal adapter uses an atomic lock, compare-and-swap revision and atomic rename. It stores only canonical ledger envelopes and opaque events. It is suitable for local/synthetic review, not a production high-availability database.
- Status output is deliberately low-cardinality: booleans, mode, retry count and safe codes. It excludes URLs, contract/account IDs, hashes, XDR, secrets, identities and clinical data. `submissionAttempts` is always zero.

Reproduce locally, without network:

```text
npm run test:stellar-v2-readonly-indexer
npm run test:receipt-indexer
npm run test:readonly-indexer-role-e2e
npm run lint
```

The focal suite injects a synthetic RPC server and proves passphrase/WASM attestation, V2 decoding, durable restart, tip reorg, retry exhaustion, strict redaction and closed allowlists. It does not contact Stellar.

## Server-only live-read configuration gate

Do not enable a live poll until an operator supplies and a reviewer independently compares this complete packet:

1. Exact ReceiptLedgerV2 Testnet contract ID and deployment ledger.
2. SHA-256 of the approved V2 WASM, matching the deployment manifest and RPC bytecode attestation.
3. Exact HTTPS RPC endpoint and Testnet passphrase allowlist.
4. Durable database adapter and retention/backup/restore owner. The local file adapter is not the production choice.
5. Start ledger, finality depth, timeout/retry budget, telemetry destination and alert owners.
6. Both `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` and `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`, verified server-side.

After configuration, run a read-only catch-up first. A PASS requires: attestation matched, cursor persisted and recovered after restart, no gap/reorg unresolved, no unsafe report field, no submission attempt and independent comparison of a small opaque sample against an approved second Testnet source. A timeout, retention gap, unexpected event schema or bytecode mismatch is `unknown`/NO-GO, never a reason to skip forward.

## Operational response

- `ATTESTATION_ALLOWLIST_REJECTED`: stop polling; compare manifest, deployment and RPC endpoint. Do not edit an allowlist to fit an unexplained value.
- `LEDGER_GAP` or `LEDGER_PARENT_UNAVAILABLE`: retain the current cursor, investigate RPC retention/availability and restore from a reviewed checkpoint.
- `PARENT_HASH_MISMATCH`: the service rewinds conservatively within its bounded retry. Repeated mismatch is NO-GO and requires comparison with an independent source.
- `EVENT_SCHEMA_REJECTED`, `EVENT_SOURCE_REJECTED` or `EVENT_PAGE_LIMIT`: stop; do not expose partial state.
- `SOURCE_UNKNOWN` or `RPC_TIMEOUT`: retry is bounded. Exhaustion remains unknown and never triggers a transaction or cursor skip.
- `INDEXER_CONCURRENT_UPDATE`, `INDEXER_STORAGE_BUSY` or `INDEXER_STORAGE_UNAVAILABLE`: keep the last committed cursor and repair the durable store before resuming.

## Still pending

- ReceiptLedgerV2 is not deployed in this branch, so no real V2 contract ID, deployment ledger or live RPC evidence exists to configure.
- A production durable database implementation, multi-instance lease/leader policy and restore drill remain external infrastructure gates.
- Independent RPC/source comparison, operational monitoring and alert routing remain unconfigured.
- UI consumption must use a server-side minimized projection; browser code must never receive raw RPC events, contract IDs, commitments or operational identifiers unless a separately reviewed technical evidence view requires them.

No deploy, Testnet submission, secret creation, KMS provisioning, IdP provisioning, push or production change is performed by this runbook.
