# Sprint de preparación on-chain — Stellar Testnet

Documento vivo del Scrum Master. Baseline: `a7767b3` de `integration/simulated-testnet-gate-20260822`. Este sprint prepara código y evidencia local; **no autoriza deploy, submission, fondeo, pagos, producción, main, push ni datos reales**.

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
| 6. Persistencia cifrada/mapping opaco | rama de segunda ola por crear | Datos/privacidad | PROGRAMADO | depende de interfaces y threat model |
| 7. QA/E2E/privacy/concurrencia | rama de segunda ola por crear | QA independiente | PROGRAMADO | depende de frentes 1–6 |

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

1. Auth y allowlist reales aprovisionadas y probadas por rol/scope.
2. Cuentas seudónimas, custodios, owners, rotación y revocación aprobados.
3. KMS/HSM y separación de secretos configurados fuera del repositorio.
4. RPC/indexer allowlisted, política de finality/reorg y observabilidad aprobadas.
5. Persistencia durable cifrada, backups, retención y auditoría aprobados.
6. Hash WASM, contract ID esperado, passphrase Testnet y runbook revisados.
7. Aceptación de correlación residual on-chain y revisión jurídica/clínica/farmacéutica del ejercicio sintético.
8. Autorización explícita y separada para deploy/smoke Testnet. No implica mainnet ni producción.

**Estado actual:** `NO-GO TESTNET` hasta cerrar todos los gates anteriores.
