# IDL congelada — TrustRegistry v1 + ReceiptLedgerV2

Estado: contrato Rust/IDL local. Cualquier cambio incompatible exige nueva versión, revisión de eventos y nuevo hash WASM.

## TrustRegistry

```text
init(admin: Address) -> void

issue_actor(
  admin: Address,
  credential_id: BytesN<32>,
  controller: Address,
  kind: CredentialKind,              # Doctor | Dispensary
  expires_at: u64,
  operation_id: BytesN<32>
) -> Credential

issue_eligibility(
  doctor: Address,
  doctor_credential_id: BytesN<32>,
  credential_id: BytesN<32>,
  expires_at: u64,
  operation_id: BytesN<32>
) -> Credential

set_state(
  actor: Address,
  credential_id: BytesN<32>,
  expected_version: u32,
  target_state: CredentialState,     # Active | Suspended | Revoked
  operation_id: BytesN<32>
) -> Credential

renew(
  actor: Address,
  credential_id: BytesN<32>,
  expected_version: u32,
  new_expires_at: u64,
  operation_id: BytesN<32>
) -> Credential

expire(
  actor: Address,
  credential_id: BytesN<32>,
  expected_version: u32,
  operation_id: BytesN<32>
) -> Credential

get_credential(credential_id: BytesN<32>) -> Credential
is_active(credential_id: BytesN<32>, controller: Address, kind: u32) -> bool
get_admin() -> Address
```

Eventos:

- `CredentialIssued(schema_version, credential_id, kind, state, version, expires_at, operation_id, actor)`
- `CredentialChanged(schema_version, credential_id, kind, state, version, expires_at, operation_id, actor)`

Errores: `AlreadyInitialized(1)`, `NotInitialized(2)`, `Unauthorized(3)`, `CredentialMissing(4)`, `CredentialAlreadyExists(5)`, `VersionConflict(6)`, `InvalidState(7)`, `OperationConflict(8)`, `InvalidExpiry(9)`, `InvalidKind(10)`, `CredentialInactive(11)`.

## ReceiptLedgerV2

```text
init(admin: Address, registry: Address) -> void

issue(doctor, doctor_credential_id, eligibility_credential_id,
      receipt_id, commitment, operation_id) -> Receipt

activate(doctor, doctor_credential_id, receipt_id,
         expected_version, commitment, operation_id) -> Receipt

record_partial(dispensary, dispensary_credential_id, receipt_id,
               expected_version, commitment, operation_id) -> Receipt

mark_dispensed(dispensary, dispensary_credential_id, receipt_id,
               expected_version, commitment, operation_id) -> Receipt

revoke(doctor, doctor_credential_id, receipt_id,
       expected_version, commitment, operation_id) -> Receipt

expire(admin, receipt_id, expected_version, commitment, operation_id) -> Receipt

set_grant(doctor, doctor_credential_id, receipt_id, expected_version,
          dispensary, dispensary_credential_id, enabled, operation_id) -> Receipt

get_receipt(receipt_id) -> Receipt
authorization_chain(receipt_id, dispensary?: Address) -> AuthorizationChain
get_registry() -> Address
```

Eventos:

- `ReceiptChanged(schema_version=2, receipt_id, state, version, commitment, doctor_credential_id, eligibility_credential_id, operation_id, actor)`
- `GrantChanged(schema_version=2, receipt_id, dispensary_credential_id, enabled, operation_id, actor)`

No hay funciones `set_doctor` o `set_dispensary`; toda habilitación proviene de `TrustRegistry.is_active`.

## Compatibilidad de versión

- `TrustRegistry` schema de eventos: `1`.
- `ReceiptLedgerV2` schema de eventos: `2` para distinguirlo del receipt v1.
- El receipt Testnet existente no implementa esta IDL.
- Esta IDL no está autorizada para deploy. Antes de Testnet deben archivarse el WASM reproducible, hash SHA-256, spec extraída por CLI y revisión independiente.
