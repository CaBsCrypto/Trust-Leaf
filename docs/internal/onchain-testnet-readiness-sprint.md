# Sprint de preparación on-chain — Stellar Testnet

Documento vivo del Scrum Master. Baseline: `a7767b3` de `integration/simulated-testnet-gate-20260822`. El usuario autorizó el 2026-08-22 una ceremonia real y acotada en Stellar Testnet con fixtures sintéticos. La autorización no incluye pagos, producción, mainnet, `main`, push ni datos reales; cada transacción sigue condicionada a los gates técnicos y al runbook.

## Objetivo y límites

Preparar una candidata verificable para solicitar después un gate humano separado de Stellar Testnet. Todos los ejercicios usan fixtures sintéticos. El receipt es no transferible y sus eventos son versionados. La cadena nunca recibe PII/PHI, identidad, diagnóstico, dosis, gramaje, saldo, PDF ni metadata clínica. El QR público conserva únicamente existencia, coincidencia y estado. El detalle clínico permanece cifrado off-chain y no se presenta como receta legalmente válida.

## Tablero del sprint

| Frente | Rama / worktree | Responsable | Estado | Dependencias / gate |
|---|---|---|---|---|
| Scrum e integración | `integration/onchain-testnet-readiness-20260822` / `wt-onchain-integration` | Scrum Master | EN CURSO | integra sólo commits con evidencia |
| 1. Contrato/IDL/eventos | `sprint/onchain-contract-20260822` / `wt-onchain-contract` | Ingeniería Soroban | EN CURSO | tests locales; cero deploy |
| 2. Auth/allowlists/scopes | `sprint/onchain-auth-kms-20260822` / `wt-onchain-auth-kms` | Seguridad backend | EN CURSO | proveedor real y cuentas bloqueados |
| 3. Signer/custodia/KMS | misma rama de auth/KMS | Seguridad de claves | EN CURSO | KMS/custodia reales requieren decisión |
| 4. Adapter RPC/submission | `sprint/onchain-rpc-indexer-20260822` / `wt-onchain-rpc-indexer` | Ingeniería Stellar | EN CURSO | transporte fixture; submission off |
| 5. Indexer/reconciler | misma rama RPC/indexer | Backend/SRE | EN CURSO | RPC/indexer durable bloqueados |
| 6. Persistencia cifrada/mapping opaco | `sprint/testnet-e2e-data-qa-20260822` / `wt-testnet-e2e-data-qa` | Datos/privacidad | EN CURSO | sólo interfaces y fixtures locales |
| 7. QA/E2E/privacy/concurrencia | misma rama E2E/data | QA independiente | EN CURSO | depende de frentes 1–5 |
| Remediación RPC/indexer live | `sprint/testnet-live-adapter-20260822` / `wt-testnet-live-adapter` | Stellar + SRE | EN CURSO | corrige nombres de funciones y decoder real |

## Definition of Done local

- interfaces y estados congelados con tests deterministas;
- auth, signer, RPC y submission fallan cerrados sin configuración explícita;
- timeout queda `unknown` y nunca gatilla resubmission ciega;
- eventos, logs, QR y fixtures pasan escaneo de campos prohibidos;
- persistencia clínica usa sólo un modelo local/abstracto cifrado, sin servicio configurado;
- E2E médico → paciente → QR → dispensario usa exclusivamente fixtures sintéticos;
- threat model, runbook, smoke y teardown reflejan únicamente controles verificados;
- preflight, contrato/workspace y revisión independiente están verdes;
- rama candidata limpia y sin cambios a `main`.

## Gates humanos antes de Testnet

1. Auth y allowlist reales aprovisionadas y probadas por rol/scope para cualquier acceso web. La ceremonia CLI aislada no las sustituye.
2. Cuentas seudónimas, custodios, owners, rotación y revocación aprobados.
3. KMS/HSM y separación de secretos configurados fuera del repositorio.
4. RPC/indexer allowlisted, política de finality/reorg y observabilidad aprobadas.
5. Persistencia durable cifrada, backups, retención y auditoría aprobados.
6. Hash WASM, contract ID esperado, passphrase Testnet y runbook revisados.
7. Aceptación de correlación residual on-chain y revisión jurídica/clínica/farmacéutica del ejercicio sintético.
8. Autorización explícita y separada para deploy/smoke Testnet. **RECIBIDA** para una ceremonia sintética acotada; permanece condicionada al resto de los gates y no implica mainnet ni producción.

**Estado actual:** `NO-GO TESTNET` hasta cerrar todos los gates anteriores.

## Evidencia de pre-gate actual

- Contrato integrado: 21/21 tests; WASM de 12.665 bytes, SHA-256 `718467336c29d771af93612ecaa3954ec3bd14837ad2c219587e5b75e591e370`; IDL opaca con 11 funciones y eventos `schema_version=1`.
- Preflight web combinado: verde, incluyendo auth/custodia, RPC prep, event source, indexer, privacidad, TypeScript y build.
- Alias técnicos `trustleaf-admin`, `trustleaf-doctor` y `trustleaf-dispensary`: presentes, claves públicas con formato válido, cuentas existentes y saldo Testnet positivo. No se registraron direcciones ni secretos.
- RPC oficial `https://soroban-testnet.stellar.org`: saludable al consultar `getHealth`.
- Auditoría independiente: **NO-GO temporal** hasta alinear nombres de funciones, implementar/verificar transporte y decoder RPC reales, cerrar runbook sin placeholders y documentar la excepción de custodia CLI/rollback.
