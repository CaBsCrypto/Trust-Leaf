# Stellar Testnet RPC + indexer pre-deploy runbook

Status: **NO-GO until the bounded deployment/submission ceremony is explicitly approved**. The SDK/RPC path is implemented but no network action is performed by this branch.

## Fixed safety boundary

- Network: Stellar Testnet, passphrase `Test SDF Network ; September 2015`.
- Allowlisted RPC: `https://soroban-testnet.stellar.org`.
- Contract ID and WASM SHA-256 must both be explicitly allowlisted after an approved build/deploy ceremony.
- Testnet submission defaults closed. It opens only when all three fields are present together: `submissionEnabled=true`, an exact opaque `submissionAuthorization.operationId`, and a future `expiresAt`; `maxSubmissions` is fixed to `1`.
- The real `@stellar/stellar-sdk` transport is dependency-injected. It loads the technical source account, builds and simulates the allowlisted contract invocation, returns prepared XDR for the external signer, submits signed XDR, and confirms by transaction hash.
- Function mapping is exact: `issue`, `activate`, `record_partial`, `mark_dispensed`, `revoke`, `expire`. The older simulated aliases `dispense_partial`/`dispense` are rejected by the type boundary.
- Only opaque receipt handles, operation IDs, expected versions and commitments may cross the chain boundary. Never PII/PHI, dose, weight, balance, clinical metadata or clinical documents.
- Receipts are non-transferable; public QR consumers receive minimal state only. Clinical detail remains encrypted off-chain.

## Verified locally

- `prepare -> simulate -> sign -> submit -> confirm` transitions with synthetic XDR and signer fixtures, including exact `record_partial` / `mark_dispensed` names.
- Testnet submission gate fails closed unless a single unexpired operation authorization matches; mismatched operations are rejected.
- Stable operation IDs prevent payload changes and repeated submission.
- Submission timeout becomes `unknown`; subsequent calls reconcile by transaction hash instead of resubmitting.
- The RPC event source calls `getLedgers` and `getEvents` for one bounded ledger, filters the exact contract, ignores unsuccessful calls and non-lifecycle grant events, decodes schema v1, and emits only hashed event IDs plus 32-byte opaque receipt/operation IDs. It persists a hash cursor, detects gaps/reorgs, uses bounded finality and emits low-cardinality redacted metrics.

Run: `npm run test:stellar-rpc-prep`, `npm run test:stellar-event-source`, `npm run test:receipt-indexer`, then `npm run lint`.

## Separate approval gate before any live Testnet activity

Scrum Master must approve one bounded ceremony after reviewing: contract build hash/IDL, deployed contract ID, signer/KMS policy and rotation drill, updated threat model, complete preflight, synthetic smoke identifiers, rollback/kill switch owner, RPC availability and data-retention policy. Then configure the exact allowlists and one-operation authorization in server-only runtime state; never expose signed XDR or signer material in logs. Expiration must be short and the gate must be closed immediately after the operation. No deploy, faucet/funding or submission is performed by this branch.

## Exact preflight order

1. Check clean branch/worktree and record commit; build `receipt-ledger`, record WASM SHA-256 and compare with the approved allowlist.
2. Verify Testnet passphrase, HTTPS RPC exact allowlist, deployed contract ID exact allowlist, source public key and signer key version. Print fingerprints only, never secrets/XDR.
3. Run `npm run test:stellar-rpc-prep`, `npm run test:stellar-event-source`, `npm run test:receipt-indexer`, `npm run lint`, and the contract tests. Any failure is NO-GO.
4. Simulate the exact synthetic operation while submission remains disabled. Review footprint/auth/resource fee and confirm that arguments contain only actor, opaque receipt/operation bytes, version and commitment.
5. Obtain separate human approval naming operation ID, UTC expiry and owner. Enable one submission for that exact operation only; sign through the approved signer, submit once, then poll by hash. Timeout/not-found is `unknown`: reconcile, never resubmit.
6. Confirm inclusion/finality and schema-v1 event from the allowlisted contract, close the submission gate, record redacted evidence and explorer URL. Any schema/contract/hash mismatch is NO-GO and triggers the kill-switch owner.

## Approved smoke evidence template (not yet executed)

Record UTC time, commit, contract ID, WASM hash, opaque operation reference, simulation result, transaction hash, inclusion ledger, confirmation depth, indexed event schema/version, cursor hash and an official Stellar Expert Testnet explorer URL. Screenshot/logs must be checked for secrets and clinical fields. A timeout or missing event remains `unknown`; operators must reconcile and must not retry submission.

## Threats still open

- RPC compromise/equivocation: compare transaction/event evidence against an independent approved source before promotion.
- Reorg/finality: retain orphan evidence as `unknown`; never expose pending state as final.
- Event spoofing/schema drift: contract ID + schema allowlist rejects it; deployed bytecode attestation remains pending.
- Replay/concurrency: operation idempotency and expected contract version are prepared; live concurrent validation awaits deployment approval.
- Signer compromise/rotation: signer is abstracted and key version recorded; real KMS integration and break-glass drill remain pending.
- Metadata leakage: structured errors and metrics are redacted; production telemetry review remains pending.
