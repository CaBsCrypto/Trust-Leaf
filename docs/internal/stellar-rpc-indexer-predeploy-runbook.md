# Stellar Testnet RPC + indexer pre-deploy runbook

Status: **NO-GO for deploy and submission**. This branch prepares interfaces and deterministic fixtures only.

## Fixed safety boundary

- Network: Stellar Testnet, passphrase `Test SDF Network ; September 2015`.
- Allowlisted RPC: `https://soroban-testnet.stellar.org`.
- Contract ID and WASM SHA-256 must both be explicitly allowlisted after an approved build/deploy ceremony.
- Testnet configuration rejects `submissionEnabled=true`. The real transport is dependency-injected and no network implementation is wired here.
- Only opaque receipt handles, operation IDs, expected versions and commitments may cross the chain boundary. Never PII/PHI, dose, weight, balance, clinical metadata or clinical documents.
- Receipts are non-transferable; public QR consumers receive minimal state only. Clinical detail remains encrypted off-chain.

## Verified locally

- `prepare -> simulate -> sign -> submit -> confirm` transitions with synthetic XDR and signer fixtures.
- Testnet submission gate fails closed; fixture mode is the only mode allowed to exercise submission.
- Stable operation IDs prevent payload changes and repeated submission.
- Submission timeout becomes `unknown`; subsequent calls reconcile by transaction hash instead of resubmitting.
- Index source requires the allowlisted contract and event schema v1, persists a hash cursor, detects gaps/reorgs, uses bounded finality and emits low-cardinality redacted metrics.

Run: `npm run test:stellar-rpc-prep`, `npm run test:stellar-event-source`, `npm run test:receipt-indexer`, then `npm run lint`.

## Separate approval gate before any live Testnet activity

Scrum Master must approve one bounded ceremony after reviewing: contract build hash/IDL, deployed contract ID, signer/KMS policy and rotation drill, updated threat model, complete preflight, synthetic smoke identifiers, rollback/kill switch owner, RPC availability and data-retention policy. Only then may a separate change wire an SDK transport and temporarily authorize a single synthetic submission. No deploy, faucet/funding or submission is performed by this branch.

## Approved smoke evidence template (not yet executed)

Record UTC time, commit, contract ID, WASM hash, opaque operation reference, simulation result, transaction hash, inclusion ledger, confirmation depth, indexed event schema/version, cursor hash and an official Stellar Expert Testnet explorer URL. Screenshot/logs must be checked for secrets and clinical fields. A timeout or missing event remains `unknown`; operators must reconcile and must not retry submission.

## Threats still open

- RPC compromise/equivocation: compare transaction/event evidence against an independent approved source before promotion.
- Reorg/finality: retain orphan evidence as `unknown`; never expose pending state as final.
- Event spoofing/schema drift: contract ID + schema allowlist rejects it; deployed bytecode attestation remains pending.
- Replay/concurrency: operation idempotency and expected contract version are prepared; live concurrent validation awaits deployment approval.
- Signer compromise/rotation: signer is abstracted and key version recorded; real KMS integration and break-glass drill remain pending.
- Metadata leakage: structured errors and metrics are redacted; production telemetry review remains pending.
