# Gate de redeploy Testnet — TrustRegistry + ReceiptLedgerV2

Estado: **NO-GO**. Este documento prepara una decisión posterior; no autoriza deploy ni transacciones.

## Razón de redeploy

El `ReceiptLedger` desplegado el 22-08-2026 usa allowlists internas y no referencia un registry externo. Su ABI no permite activar enforcement de credenciales sin reemplazar el contrato. La estrategia segura es mantener v1 como evidencia histórica read-only y desplegar dos contratos nuevos sólo después de aprobación:

1. `TrustRegistry`.
2. `ReceiptLedgerV2`, inicializado una vez con el contract ID exacto del registry.

No hay migración automática ni copia de receipts. Los fixtures v1 siguen en v1. Toda demostración v2 debe emitir nuevos IDs y commitments sintéticos.

## Secuencia propuesta, bloqueada hasta autorización

1. Congelar IDL/eventos y aprobar threat model.
2. Reproducir tests y WASM; registrar hashes y versiones de toolchain.
3. Aprobar cuentas técnicas seudónimas, admin/custodia y política de rotación.
4. Desplegar `TrustRegistry` Testnet.
5. Smoke read-only de `get_admin/is_active` antes de emitir credenciales.
6. Emitir sólo credenciales sintéticas de médico/dispensario y una elegibilidad sintética.
7. Desplegar `ReceiptLedgerV2` con allowlist de network/passphrase/registry/hash.
8. Ejecutar un único E2E sintético autorizado: issue→active→grant→partial→dispensed y negativos de suspensión/revocación.
9. Indexar eventos v1/v2 por contract ID, sin mezclar schemas.
10. Mantener submissions deshabilitadas al terminar y publicar informe de teardown.

## GO/NO-GO humano

Requiere decisión explícita sobre:

- cuenta admin y política multisig/KMS/HSM;
- cuentas técnicas de médico/dispensario sin identidad pública;
- ventanas de expiry y riesgo de correlación temporal;
- contract IDs, network passphrase, RPC allowlist y hashes WASM;
- quién puede materializar expiry y operar respuesta a incidentes;
- autenticación backend real, idempotency store durable y audit log;
- indexer con cursor/finalidad/reorg y redacción;
- revisión jurídica, clínica, farmacia y privacidad limitada a demo sintética;
- autorización separada de deploy y luego otra para cada smoke con writes.

Si falta un solo punto: **NO-GO**.

## Rollback/teardown

- No promover IDs nuevos a configuración web productiva.
- Mantener `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false` fuera de la ventana de smoke.
- Si falla registry o receipt v2, abandonar sus contract IDs, conservar evidencia y no reutilizar operation IDs.
- No intentar “migrar hacia atrás” ni editar historia; v1 y v2 se consultan por separado.
- Rotar/revocar credenciales técnicas sintéticas si el contrato funciona pero el smoke se detiene.
- El teardown no elimina datos públicos de Testnet; sólo impide nuevas operaciones y retira los IDs de allowlists locales.

## Evidencia necesaria antes de pedir deploy

- `npm run contract:test:credentials` PASS.
- `npm run preflight` PASS.
- build WASM reproducible de ambos contratos.
- specs/IDL extraídas desde WASM y comparadas con `trust-registry-idl-v1.md`.
- revisión independiente de ausencia de PII/PHI y bypass de registry.
- QA local de `/demo/trust-registry?scenario=active` y tres escenarios negativos.

Nada de lo anterior constituye validez clínica/legal o habilitación de pacientes reales.
