# TrustRegistry + ReceiptLedgerV2 predeploy manifest

Status: **local evidence verified; Testnet deployment not authorized**.

This package binds the locally rebuilt `TrustRegistry` and `ReceiptLedgerV2` WASM artifacts to extracted Soroban interfaces and a sanitized, deterministic deployment plan. It never submits, signs, resolves an alias, reads a key, or calls an RPC endpoint.

## Reproduce

```text
npm run manifest:testnet-v2:check
npm run test:testnet-v2-manifest
npm run contract:test:credentials
```

The manifest command performs the two locked local builds, extracts each interface from WASM with the installed Stellar CLI, and validates the sanitized evidence. `contract:build:testnet-v2` remains available when only the WASM rebuild is needed. No command in this package contains `deploy`, `invoke`, a source alias, a network call, or a signing operation.

The build outputs are intentionally ignored. They must be regenerated from the locked Rust workspace. The reviewable evidence is:

- `artifacts/testnet-v2/predeploy-manifest.json`: WASM SHA-256, byte size, interface fingerprints, initialization order and typed opaque placeholders.
- `artifacts/testnet-v2/trust_registry.spec.json`: interface extracted locally from the rebuilt WASM.
- `artifacts/testnet-v2/receipt_ledger_v2.spec.json`: interface extracted locally from the rebuilt WASM.

`manifest:testnet-v2:check` fails if the rebuilt WASM hash, exported function set, `init` arguments, extracted specs, or checked-in manifest differ. Updating a frozen hash is a security-significant review, not an automatic fix.

The frozen local toolchain for this evidence is Stellar CLI/XDR `26.0.0`, Rust/Cargo `1.95.0`, `soroban-sdk` resolved by `Cargo.lock` to `25.3.1`, and target `wasm32v1-none`. The ceremony script rejects an unreviewed CLI or Rust/Cargo version before building.

## Verified locally

- Testnet is the only named target and mainnet is denied.
- Submission and mutation flags are false.
- Initialization order is `TrustRegistry.init(admin)` then `ReceiptLedgerV2.init(admin, registry)`.
- Values required at ceremony time remain typed placeholders; no account address, contract ID, RPC URL, transaction, XDR, secret or real identifier is stored.
- Placeholder strings such as `<DEPLOYED_TRUST_REGISTRY_CONTRACT_ADDRESS>` are labels, not valid Stellar contract IDs or account addresses.
- Artifact and interface fingerprints are deterministic.
- Negative tests reject missing/tampered artifacts, function drift, argument drift, open flags, deploy authorization and forbidden fields/values.

## Pending human/infrastructure gates

- Select and independently approve the admin quorum, deployer/operator duty split and KMS/HSM provider configuration.
- Approve the exact Testnet passphrase, RPC origin set, rebuilt WASM fingerprints and later deployed contract IDs in a controlled ceremony.
- Run the custody preflight and key ceremony without exporting or displaying private material.
- Grant a separate, time-bounded Testnet deployment authorization; this manifest is deliberately non-executable.
- After deployment, perform the separately authorized synthetic smoke and read-only reconciliation. No clinical/legal validity or real patient use is implied.
