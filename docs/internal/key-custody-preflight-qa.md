# Key custody preflight QA

Status: **verified only with synthetic fixtures**. This gate does not inspect real aliases, balances, credentials, provider accounts, KMS/HSM resources, or Testnet signers.

## Reproducible commands

- `npm run test:key-custody-preflight` exercises the safe-output contract and negative cases.
- `npm run preflight:key-custody` runs an entirely synthetic, non-signing inventory and prints only booleans, counts, approved role labels, and stable blocker codes.

The preflight evaluates the required roles `admin-approval`, `deployer`, `operator`, `doctor-service`, and `dispensary-service`. It fails closed when mutation/submission flags are open, allowlists are missing, duties share an opaque boundary, signing is not disabled, provider/alias presence is false, a boolean balance threshold is false, or version/rotation/revocation/recovery controls are missing.

## Safe-output contract

The report schema has a fixed allowlist. It cannot include provider errors, environment values, URLs, contract/account addresses, digests, aliases, key material, or arbitrary extra properties. A provider exception is reduced to unavailable booleans; its message is discarded.

Negative tests cover:

- simulated provider exceptions containing sensitive-looking content;
- unexpected fields and sensitive values;
- Stellar address/seed-like strings, URLs, and digest-like strings;
- enabled submission/mutations;
- incomplete RPC/contract allowlists;
- separation-of-duties collision;
- absent rotation, revocation, and recovery gates.

## Explicit limits and future gate

`preflight:key-custody` is a harness, not proof that a real custodian is ready. A future provider-specific probe must be separately reviewed before it can query presence or balance. It may return only sanitized booleans and must never list or print aliases, addresses, balances, versions, credentials, signatures, provider errors, or environment values. Real signing and Testnet submission remain out of scope and disabled.
