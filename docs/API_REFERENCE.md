# Referencia de APIs — Trust Leaf (Backend → Frontend)

> Documento de entrega para el equipo de FRONTEND. Cubre **los 35 endpoints REST** expuestos por `server.ts` (modo desarrollo, `http://localhost:3000`) y replicados como funciones serverless en `api/` para Vercel.
>
- **Base URL (dev):** `http://localhost:3000`
- **Base URL (prod):** la del deploy de Vercel (mismas rutas).
- **Content-Type:** `application/json` en todos los `POST`.
- **Formato de error estándar:** `{ "message": string }` (HTTP 4xx/5xx). Algunos endpoints añaden `code` o `valid: false`.
- **Red:** Stellar **Testnet** salvo nota contraria.
- **Rate limits:**
  - `faucet` → 5 req / 15 min por IP.
  - `write` (issue/dispense/custodial-deposit/custodial-withdraw) → 10 req / 60 s por IP. Al excederse: `429 { message }`.

---

## Índice

1. [Stellar — Config de Red](#1-stellar--config-de-red)
2. [Stellar — Wallets](#2-stellar--wallets)
3. [Stellar — Paciente](#3-stellar--paciente)
4. [Stellar — Médico (Recetas)](#4-stellar--médico-recetas)
5. [Stellar — Dispensario (Dispensación)](#5-stellar--dispensario-dispensación)
6. [Stellar — Dispensario (Retención / Liberación)](#6-stellar--dispensario-retención--liberación)
7. [Stellar — Dispensario (Validación)](#7-stellar--dispensario-validación)
8. [Stellar — Envío de TX firmada (Web3)](#8-stellar--envío-de-tx-firmada-web3)
9. [Stellar — Verificación pública de Receta](#9-stellar--verificación-pública-de-receta)
10. [Stellar — Admin (SIS / Registros)](#10-stellar--admin-sis--registros)
11. [Passkeys](#11-passkeys)
12. [Defindex (ReFi Vaults)](#12-defindex-refi-vaults)
13. [Modelos de dato compartidos](#13-modelos-de-dato-compartidos)
14. [Flujos recomendados](#14-flujos-recomendados)

---

## 1. Stellar — Config de Red

### 1.1 `GET /api/stellar/health`
Salud de la conexión a Horizon Testnet.

- **200**
  ```json
  { "status": "connected", "network": "Stellar Testnet", "latestLedger": 123456 }
  ```
- **500** `{ "status": "error", "message": "Could not connect to Stellar" }`

### 1.2 `GET /api/stellar/contracts`
IDs de contratos Soroban activos y último ledger.

- **200**
  ```json
  {
    "network": "Stellar Testnet",
    "rpcUrl": "https://soroban-testnet.stellar.org",
    "latestLedger": 123456,
    "registryContractId": "CDNV4B…",
    "dispensaryRegistryContractId": "CCFW6W…",
    "prescriptionContractId": "CDPIIG…",
    "dispenseRecordContractId": "CBG6Z7…"
  }
  ```
- **500** `{ "message": "No fue posible obtener el estado de los contratos en testnet." }`

### 1.3 `GET /api/stellar/readiness`
Estado de runtime del backend (libs, contratos, env).

- **200** `getRuntimeReadiness()` → objeto con flags de readiness.

### 1.4 `POST /api/stellar/faucet`  ·  `rate-limit: faucet`
Fondea una cuenta en Testnet (XLM).

- **Body**
  ```json
  { "role": "doctor" | "dispensary" | "patient" | "admin", "address": "G…" }
  ```
  Ambos opcionales (si se omiten, el backend decide según `role`).
- **200** Resultado de `fundTestnetAccount`.
- **500** `{ "message": "…" }`

---

## 2. Stellar — Wallets

### 2.1 `POST /api/stellar/derive-wallet`
Deriva la clave pública Stellar determinística a partir del email (modo custodial). Útil para mostrar la wallet del paciente/médico sin pedir firma.

- **Body** `{ "email": "string" }`
- **200** `{ "publicKey": "G…" }`
- **400** `{ "message": "Falta email." }`
- **500** `{ "message": "…" }`

> Nota: el email `paciente@trustleaf.test` devuelve una publicKey fija de demo (`GDKCAFBR…`).

---

## 3. Stellar — Paciente

### 3.1 `GET /api/stellar/patient/:address/dashboard`
Dashboard completo de recetas del paciente (vía eventos Soroban `PrescriptionIssued` + `get_prescription`).

- **Path** `address` = publicKey Stellar del paciente.
- **200**
  ```json
  {
    "patientAddress": "G…",
    "network": "Stellar Testnet",
    "rpcUrl": "https://soroban-testnet.stellar.org",
    "latestLedger": 123456,
    "latestLedgerClosedAt": "2026-06-30T12:00:00.000Z",
    "registryContractId": "CDNV4B…",
    "prescriptionContractId": "CDPIIG…",
    "summary": { "total": 5, "active": 2, "used": 2, "expired": 1 },
    "prescriptions": [
      {
        "id": 12,
        "patient": "G…",
        "doctor": "G…",
        "medicationHash": "0xabc…",
        "expiresAt": 1750000000,
        "isUsed": false,
        "status": "active",
        "issuedAt": "2026-06-29T10:00:00Z",
        "issuedLedger": 123400,
        "txHash": "abc123…"
      }
    ]
  }
  ```
- **500** `{ "message": "…" }`

### 3.2 `GET /api/stellar/verify-passport/:accountId`
Verifica el "Pasaporte Médico" del paciente: data `MedicalTrustID` + NFTs de receta `RX*` (balances y claimable balances).

- **Path** `accountId` = publicKey Stellar.
- **200**
  ```json
  {
    "verified": true,
    "accountId": "G…",
    "trustID": "TX-001" | null,
    "activePrescriptionNFTs": [
      { "assetCode": "RX12", "issuer": "G…", "balance": "1" }
    ],
    "activeClaimableNFTs": [
      { "balanceId": "…", "assetCode": "RX12", "issuer": "G…", "amount": "1", "claimants": [] }
    ],
    "timestamp": "2026-06-30T12:00:00.000Z"
  }
  ```
- **404** `{ "verified": false, "message": "La cuenta del paciente no existe en Stellar Testnet o no se pudo cargar.", "accountId": "G…" }`

---

## 4. Stellar — Médico (Recetas)

### 4.1 `POST /api/stellar/doctor/issue-prescription`  ·  `rate-limit: write`  ·  **Custodial**
Emite una receta on-chain firmando el backend con la keypair derivada del `doctorEmail`.

- **Body**
  ```json
  {
    "patientAddress": "G…",
    "treatment": "Cannabis 10%",
    "dosage": "0.5ml",
    "notes": "string (opcional)",
    "durationDays": 30,
    "doctorEmail": "doctor@trustleaf.test"
  }
  ```
- **Validaciones:** `patientAddress`, `treatment`, `dosage`, `durationDays` obligatorios; `durationDays >= 1`.
- **200** Resultado de `issuePrescriptionForPatient` (incluye `prescriptionId`, `txHash`, etc.).
- **400** `{ "message": "Faltan datos para emitir la receta: …" }`
- **500** `{ "message": "…" }`

### 4.2 `POST /api/stellar/doctor/build-issue-prescription`  ·  **Web3**
Construye el XDR **sin firmar** para que el médico lo firme con Freighter/Albedo y luego lo envíe por [`/api/stellar/submit`](#8-stellar--envío-de-tx-firmada-web3).

- **Body**
  ```json
  {
    "doctorAddress": "G…",
    "patientAddress": "G…",
    "treatment": "Cannabis 10%",
    "dosage": "0.5ml",
    "notes": "string (opcional)",
    "durationDays": 30,
    "totalQuantity": 100
  }
  ```
- **200** `{ "xdr": "AAAA…", … }` (resultado de `buildIssuePrescriptionTx`).
- **400** `{ "message": "Faltan datos para construir la receta: …" }`
- **500** `{ "message": "…" }`

---

## 5. Stellar — Dispensario (Dispensación)

### 5.1 `POST /api/stellar/dispensary/dispense-prescription`  ·  `rate-limit: write`  ·  **Custodial**
Registra la entrega (dispensación) de una receta on-chain.

- **Body**
  ```json
  {
    "prescriptionId": 12,
    "productLabel": "Aceite 30ml",
    "batchLabel": "L-2026-001",
    "quantity": 1,
    "dispensaryEmail": "disp@trustleaf.test",
    "doctorEmail": "doctor@trustleaf.test"
  }
  ```
- **Validaciones:** `prescriptionId`, `productLabel`, `batchLabel`, `quantity` numéricos válidos.
- **200** Resultado de `dispensePrescriptionForPatient`.
- **400** `{ "message": "Faltan datos para dispensar: …" }`
- **500** `{ "message": "…" }`

### 5.2 `POST /api/stellar/dispensary/build-dispense-prescription`  ·  **Web3**
Construye XDR sin firmar para dispensación (firma local con Freighter/Albedo).

- **Body**
  ```json
  {
    "dispensaryAddress": "G…",
    "prescriptionId": 12,
    "productLabel": "Aceite 30ml",
    "batchLabel": "L-2026-001",
    "quantity": 1
  }
  ```
- **200** `{ "xdr": "AAAA…", … }`
- **400** `{ "message": "Faltan datos para construir la dispensación: …" }`
- **500** `{ "message": "…" }`

---

## 6. Stellar — Dispensario (Retención / Liberación)

> Custodia on-chain en Soroban vía `retained_by: Option<Address>`. El dispensario puede **retener** la receta y luego **liberarla** al paciente.

### 6.1 `POST /api/stellar/dispensary/build-retain-prescription`  ·  **Web3**
- **Body** `{ "dispensaryAddress": "G…", "prescriptionId": 12 }`
- **200** `{ "xdr": "AAAA…", … }`
- **400** `{ "message": "Faltan datos para construir la retención: …" }`

### 6.2 `POST /api/stellar/dispensary/build-release-prescription`  ·  **Web3**
- **Body** `{ "callerAddress": "G…", "prescriptionId": 12 }`
- **200** `{ "xdr": "AAAA…", … }`
- **400** `{ "message": "Faltan datos para construir la liberación: …" }`

### 6.3 `POST /api/stellar/dispensary/retain-prescription`  ·  **Custodial**
Retención firmada por el backend (keypair derivada de `doctorEmail`).

- **Body**
  ```json
  {
    "prescriptionId": 12,
    "dispensaryAddress": "G…",
    "lockPeriodDays": 7,
    "doctorEmail": "doctor@trustleaf.test"
  }
  ```
- **200** Resultado de `retainPrescriptionForDispensary`.
- **400** `{ "message": "Faltan datos para retener la receta: …" }`

### 6.4 `POST /api/stellar/dispensary/release-prescription`  ·  **Custodial**
Liberación firmada por el backend.

- **Body**
  ```json
  {
    "prescriptionId": 12,
    "doctorEmail": "doctor@trustleaf.test",
    "dispensaryEmail": "disp@trustleaf.test",
    "dispensaryAddress": "G…"
  }
  ```
  Solo `prescriptionId` es obligatorio; el resto opcional.
- **200** Resultado de `releasePrescriptionToPatient`.
- **400** `{ "message": "Falta prescriptionId para liberar la receta." }`

---

## 7. Stellar — Dispensario (Validación)

### 7.1 `POST /api/stellar/dispensary/validate-prescription`
Valida una receta contra el contrato `Prescription` antes de dispensar.

- **Body** `{ "prescriptionId": 12 }`
- **200** Resultado de `validatePrescriptionForDispensary` (estado, cantidades, etc.).
- **400** `{ "message": "Falta prescriptionId para validar la receta." }`
- **404** (receta inexistente en contrato)
  ```json
  { "code": "PRESCRIPTION_NOT_FOUND", "message": "No encontramos esa receta en el contrato Prescription de Testnet." }
  ```
- **500** `{ "message": "…" }`

---

## 8. Stellar — Envío de TX firmada (Web3)

### 8.1 `POST /api/stellar/submit`
Transmite al ledger una TX firmada localmente (Freighter/Albedo). Centraliza la lógica post-firma para `issue`, `dispense`, `retain`, `release`.

- **Body**
  ```json
  {
    "xdr": "AAAA…",
    "operationType": "issue" | "dispense" | "retain" | "release",
    "patientAddress": "G… (opcional)",
    "medicationHash": "0x… (opcional)",
    "totalQuantity": 100,
    "prescriptionId": 12,
    "durationDays": 30
  }
  ```
- **Validaciones:** `xdr` y `operationType` obligatorios.
- **200** Resultado de `submitSignedTransaction` (típicamente `{ txHash, prescriptionId?, … }`).
- **400** `{ "message": "Faltan parámetros obligatorios: xdr y operationType." }`
- **500** `{ "message": "…" }`

---

## 9. Stellar — Verificación pública de Receta

### 9.1 `GET /api/stellar/prescription/:id/verify`
Endpoint **público** (sin auth) pensado para los QR impresos en los PDF de recetas. Expone solo datos no sensibles (direcciones truncadas).

- **Path** `id` = `prescriptionId` (entero ≥ 1).
- **200**
  ```json
  {
    "found": true,
    "prescriptionId": 12,
    "status": "active" | "used" | "expired",
    "expiresAt": 1750000000,
    "expiresAtHuman": "30/06/2026",
    "issuedBy": "GABCD12345…",
    "patientAddress": "GEFGH67890…",
    "totalQuantity": 100,
    "dispensedQuantity": 20,
    "remainingQuantity": 80,
    "network": "testnet",
    "contractId": "CDPIIG…",
    "verifiedAt": "2026-06-30T12:00:00.000Z"
  }
  ```
- **400** `{ "message": "ID de receta inválido." }`
- **404** `{ "found": false, "message": "Receta no encontrada en el ledger de Testnet." }`
- **500** `{ "found": false, "message": "…" }`

---

## 10. Stellar — Admin (SIS / Registros)

### 10.1 `POST /api/stellar/admin/verify-sis`
Verifica un RUT contra el Registro Nacional de Prestadores Individuales de Salud (mock chileno).

- **Body** `{ "rut": "12345678-9" }` (se normaliza: sin puntos, sin guion, minúsculas).
- **200** (RUT válido)
  ```json
  {
    "valid": true,
    "rut": "12345678-9",
    "name": "Dr. Carlos Valenzuela",
    "licenseId": "SIS-87421",
    "specialty": "Medicina General / Cannabis Medicinal",
    "verifiedAt": "2026-06-30T12:00:00.000Z",
    "registry": "Superintendencia de Salud de Chile (SIS)"
  }
  ```
- **400** `{ "valid": false, "message": "Falta el parámetro 'rut'." }`
- **404** `{ "valid": false, "message": "El RUN ingresado no figura en el Registro…" }`

> RUTs de prueba: `123456789`, `222222222`, `999999999`.

### 10.2 `POST /api/stellar/admin/register-doctor`
- **Body** `{ "doctorAddress": "G…" }`
- **200** Resultado de `registerDoctorOnTestnet`.
- **400** `{ "message": "Falta doctorAddress." }`

### 10.3 `POST /api/stellar/admin/register-dispensary`
- **Body** `{ "dispensaryAddress": "G…" }`
- **200** Resultado de `registerDispensaryOnTestnet`.
- **400** `{ "message": "Falta dispensaryAddress." }`

### 10.4 `POST /api/stellar/admin/revoke-doctor`
- **Body** `{ "doctorAddress": "G…" }`
- **200** Resultado de `revokeDoctorOnTestnet`.
- **400** `{ "message": "Falta doctorAddress." }`

### 10.5 `POST /api/stellar/admin/revoke-dispensary`
- **Body** `{ "dispensaryAddress": "G…" }`
- **200** Resultado de `revokeDispensaryOnTestnet`.
- **400** `{ "message": "Falta dispensaryAddress." }`

---

## 11. Passkeys

> Requiere variables de entorno: `STELLAR_RELAYER_URL`, `STELLAR_RELAYER_API_KEY` (y Mercury para resolución de contractId). Si no están configuradas, los endpoints devuelven `503`.

### 11.1 `GET /api/passkeys/health`
- **200**
  ```json
  { "configured": true, "network": "Stellar Testnet", "rpcUrl": "https://soroban-testnet.stellar.org" }
  ```

### 11.2 `POST /api/passkeys/send`
Envía un XDR firmado por passkey al relayer.

- **Body** `{ "xdr": "AAAA…" }`
- **200** Resultado de `passkeyServer.send(xdr)`.
- **400** `"Debe enviarse un XDR base64 válido."` (texto plano).
- **503** `"Passkey relayer no configurado…"` (texto plano).

### 11.3 `GET /api/passkeys/contract/:keyId`
Resuelve el contractId de la smart wallet vinculada a una passkey.

- **Path** `keyId` = identificador de la passkey.
- **200** String con el `contractId` (texto plano).
- **404** Mensaje de error (texto plano).
- **503** `"Mercury no configurado…"` (texto plano).

---

## 12. Defindex (ReFi Vaults)

> Integración con la API REST de Defindex. Todas las operaciones soportan **firma custodial** (keypair derivada del email + fee sponsorship) y **firma Web3** (devuelven XDR sin firmar para Freighter/Albedo).

### 12.1 `GET /api/defindex/vaults`
Lista de vaults disponibles + config.

- **200**
  ```json
  {
    "vaults": [ /* DEFINDEX_VAULTS */ ],
    "defaultVault": "C…",
    "network": "testnet",
    "apiKeyConfigured": true,
    "socialFundAddress": "G…"
  }
  ```

### 12.2 `GET /api/defindex/balance/:vault/:address`
Balance de shares de un usuario en un vault.

- **Path** `vault` = dirección del vault; `address` = publicKey del usuario.
- **200**
  ```json
  {
    "shares": "10000000",
    "sharesDisplay": "1.0",
    "vaultAddress": "C…",
    "address": "G…",
    "network": "testnet"
  }
  ```
- **500** `{ "message": "…" }`

### 12.3 `POST /api/defindex/build-deposit`  ·  **Web3**
Construye XDR sin firmar para depositar en un vault.

- **Body**
  ```json
  {
    "vaultAddress": "C…",
    "caller": "G…",
    "amount": "1.0",
    "slippageBps": 50,
    "invest": true
  }
  ```
- **200** `{ "xdr": "AAAA…", "vaultAddress": "C…", "caller": "G…", "amountStroops": "10000000" }`
- **400** `{ "message": "Faltan parámetros: vaultAddress, caller, amount." }`

### 12.4 `POST /api/defindex/build-withdraw`  ·  **Web3**
Retiro por **monto** (display → stroops).

- **Body** `{ "vaultAddress": "C…", "caller": "G…", "amount": "1.0", "slippageBps": 50 }`
- **200** `{ "xdr": "AAAA…", "vaultAddress": "C…", "caller": "G…", "amountStroops": "10000000" }`
- **400** `{ "message": "Faltan parámetros: vaultAddress, caller, amount." }`

### 12.5 `POST /api/defindex/build-withdraw-shares`  ·  **Web3**
Retiro por **shares** (bigint).

- **Body** `{ "vaultAddress": "C…", "caller": "G…", "shares": "10000000", "slippageBps": 50 }`
- **200** `{ "xdr": "AAAA…", "vaultAddress": "C…", "caller": "G…" }`
- **400** `{ "message": "Faltan parámetros: vaultAddress, caller, shares." }`

### 12.6 `POST /api/defindex/submit`
Transmite una TX Defindex firmada (Web3).

- **Body** `{ "xdr": "AAAA…" }`
- **200** `{ "txHash": "abc…", "network": "testnet" }`
- **400** `{ "message": "Falta el parámetro xdr firmado." }`

### 12.7 `POST /api/defindex/custodial-deposit`  ·  `rate-limit: write`  ·  **Custodial**
Depósito firmado por el backend (con fee sponsorship). Soporte para **depósito dividido** (`fundPercent`): parte al vault del usuario y parte al Fondo Social.

- **Body**
  ```json
  {
    "vaultAddress": "C…",
    "email": "user@trustleaf.test",
    "amount": "1.0",
    "fundPercent": 10,
    "slippageBps": 50,
    "invest": true
  }
  ```
- **200 (modo split)**
  ```json
  {
    "mode": "split",
    "userAmountDisplay": "0.9",
    "fundAmountDisplay": "0.1",
    "network": "testnet"
  }
  ```
- **200 (modo custodial normal)**
  ```json
  {
    "mode": "custodial",
    "txHash": "abc…",
    "signedXdr": "AAAA…",
    "amountStroops": "10000000",
    "amountDisplay": "1.0",
    "network": "testnet"
  }
  ```
- **400** `{ "message": "Faltan parámetros: vaultAddress, email, amount." }`

### 12.8 `POST /api/defindex/custodial-withdraw`  ·  `rate-limit: write`  ·  **Custodial**
Retiro custodial firmado por el backend.

- **Body** `{ "vaultAddress": "C…", "email": "user@trustleaf.test", "amount": "1.0", "slippageBps": 50 }`
- **200**
  ```json
  {
    "txHash": "abc…",
    "signedXdr": "AAAA…",
    "amountStroops": "10000000",
    "amountDisplay": "1.0",
    "network": "testnet"
  }
  ```
- **400** `{ "message": "Faltan parámetros: vaultAddress, email, amount." }`

---

## 13. Modelos de dato compartidos

### Prescription (item del dashboard)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | number | ID on-chain |
| `patient` | string | publicKey G… |
| `doctor` | string | publicKey G… |
| `medicationHash` | string | hex |
| `expiresAt` | number | epoch segundos |
| `isUsed` | boolean | |
| `status` | `"active"` \| `"used"` \| `"expired"` | derivado |
| `issuedAt` | string | ISO ledger close |
| `issuedLedger` | number | |
| `txHash` | string | |

### Estado de receta (`status`)
- `active` → `!isUsed && expiresAt > now`
- `used` → `isUsed`
- `expired` → `!isUsed && expiresAt <= now`

### operationType (para `/api/stellar/submit`)
`"issue"` | `"dispense"` | `"retain"` | `"release"`

---

## 14. Flujos recomendados

### A) Emitir receta — Custodial (médico)
1. `POST /api/stellar/derive-wallet` (obtener publicKey del paciente desde su email).
2. `POST /api/stellar/doctor/issue-prescription` con `doctorEmail`.

### B) Emitir receta — Web3 (médico con Freighter/Albedo)
1. `POST /api/stellar/doctor/build-issue-prescription` → obtiene `xdr`.
2. Firmar `xdr` con la wallet del cliente.
3. `POST /api/stellar/submit` con `operationType: "issue"`.

### C) Dispensar — Web3 (dispensario con Freighter/Albedo)
1. `POST /api/stellar/dispensary/validate-prescription` (verificar antes).
2. `POST /api/stellar/dispensary/build-dispense-prescription` → `xdr`.
3. Firmar con wallet del dispensario.
4. `POST /api/stellar/submit` con `operationType: "dispense"`.

### D) Retener / Liberar (custodia on-chain)
- Custodial: `retain-prescription` → `release-prescription`.
- Web3: `build-retain-prescription` → firma → `submit` (`"retain"`) → `build-release-prescription` → firma → `submit` (`"release"`).

### E) Verificación pública (QR del PDF)
- `GET /api/stellar/prescription/:id/verify` (sin login).

### F) Depósito ReFi — split con Fondo Social
- `POST /api/defindex/custodial-deposit` con `fundPercent > 0`.

---

## Convenciones para el Frontend

- **Errores:** asumir `{ message: string }` en cualquier 4xx/5xx. Mostrar `message` al usuario (ya está en español).
- **Numéricos:** enviar `durationDays`, `prescriptionId`, `quantity`, `totalQuantity`, `slippageBps`, `fundPercent` como número; `amount` y `shares` como string para no perder precisión.
- **Direcciones Stellar:** `G…` (cuentas) y `C…` (contratos). Validar formato antes de enviar.
- **Rate limits:** manejar `429` con feedback al usuario (esperar y reintentar).
- **Custodial vs Web3:** usar el selector de firma acordado (Fase 2). Custodial requiere `*Email`; Web3 requiere `*Address` + paso de firma local + `submit`.
- **Passkeys:** verificar `GET /api/passkeys/health` → `configured: true` antes de ofrecer el flujo.

---

*Fuente canónica: `server.ts` (modo dev, Express+Vite). Réplica serverless en `api/` para Vercel. Contratos Soroban default definidos como constantes en `server.ts` y overridables por env vars (`STELLAR_*_CONTRACT_ID`).*
