# Runbook E2E sintético — datos, QR y ceremonia Testnet

Estado: predeploy local. Este runbook **no autoriza** red, despliegue, fondos, datos reales ni actos clínicos. Todo valor es fixture opaco.

## Alcance y aliases reservados

- `trustleaf-admin`: despliegue, inicialización y rollback técnico.
- `trustleaf-doctor`: emisión/activación/revocación sintética.
- `trustleaf-dispensary`: parcial/dispensada sintética.
- El indexador usa RPC de solo lectura y nunca firma.

Los aliases no son identidades de personas. Excepción temporal: la custodia local de Stellar CLI se permite **solo** para esas cuentas sintéticas de Testnet durante esta ceremonia. No se exportan seeds, no se imprimen secretos y la excepción termina al cerrar la prueba. KMS/HSM y doble control continúan pendientes para cualquier entorno superior.

## Preflight local, sin red

Desde la raíz del repositorio:

```powershell
git status --short --branch
npm run test:testnet-e2e-data-qa
npm run test:receipt-shared-e2e
npm run test:public-verification
npm run lint
```

Desde `soroban/`:

```powershell
cargo fmt --check -p receipt-ledger
cargo test -p receipt-ledger
stellar contract build --package receipt-ledger --locked
Get-FileHash -Algorithm SHA256 .\target\wasm32v1-none\release\receipt_ledger.wasm
stellar contract info interface --wasm .\target\wasm32v1-none\release\receipt_ledger.wasm --output json-formatted
```

Guardar commit, hash WASM, IDL extraída y resultados. Fallar cerrado ante árbol sucio, prueba roja, campos prohibidos, red ambigua o artefactos discordantes.

## Payloads opacos de ceremonia

Generar cada hex con CSPRNG y conservar la correlación únicamente en evidencia cifrada. Los siguientes nombres representan exactamente 32 bytes hex, jamás texto UTF-8 ni hashes de PII/PHI:

```text
RECEIPT_ACTIVE=<64 hex aleatorios>
RECEIPT_REVOKED=<64 hex aleatorios independientes>
RECEIPT_EXPIRED=<64 hex aleatorios independientes>
COMMITMENT_V1=<64 hex aleatorios>
COMMITMENT_V2=<64 hex aleatorios>
COMMITMENT_V3=<64 hex aleatorios>
COMMITMENT_V4=<64 hex aleatorios>
OP_ISSUE=<64 hex aleatorios>
OP_ACTIVATE=<64 hex aleatorios>
OP_PARTIAL=<64 hex aleatorios>
OP_DISPENSE=<64 hex aleatorios>
OP_REVOKE=<64 hex aleatorios>
OP_EXPIRE=<64 hex aleatorios>
```

No se admiten nombres, RUT, email, direcciones de paciente, diagnóstico, medicamento, dosis, gramaje, cantidad/saldo, PDF, texto libre ni metadata clínica. El saldo usado por QA es local, cifrado y explícitamente sintético; nunca forma parte del payload on-chain.

Tras autorización separada de deploy, inspeccionar primero la interfaz efectiva:

```powershell
stellar contract invoke --id receipt-ledger-testnet --source trustleaf-admin --network testnet -- --help
```

Construir cada invocación primero con `--build-only`. El orden es `init`, roles, `issue`, `activate`, `record_partial`, `mark_dispensed`; en receipts independientes ejecutar `revoke` y `expire`. Usar siempre el nombre y orden exactos que entregue `--help`/IDL del WASM, `expected_version` observado y un `operation_id` único por intención. No copiar una plantilla si diverge de la IDL.

## QA y evidencia exigida

La corrida médico → paciente → QR → dispensario debe demostrar:

1. `active`, `partial`, `dispensed`, más receipts independientes `revoked` y `expired`.
2. QR con respuesta limitada a existencia, coincidencia y vigencia; audience incorrecta, expiración y segundo uso fallan.
3. Replay exacto no agrega evento; mismo identificador con payload distinto falla.
4. Dos mutaciones con la misma versión producen como máximo una ganadora.
5. Eventos/ABI/logs no contienen campos prohibidos ni secretos.
6. Indexación converge por ledger/event ID; `unknown` bloquea nuevas mutaciones incompatibles hasta reconciliar.

Evidencia: commit, árbol limpio, comandos y exit codes, hash/IDL WASM, contract ID, cuenta pública por alias, transaction hashes, ledger/event IDs, timestamps UTC, respuesta QR redactada y URLs del explorador Testnet. Nunca guardar seed, token QR completo ni mapeo descifrado.

## Parada y rollback

Detener inmediatamente ante timeout/`unknown`, versión o esquema desconocido, rol inesperado, dato no opaco, RPC que no sea Testnet o divergencia indexador/ledger. No regenerar `operation_id` para una intención incierta.

El **rollback owner** es quien controla `trustleaf-admin`, bajo doble revisión del responsable de seguridad. Debe pausar submissions, revocar grants/roles cuando sea seguro, poner adapter/indexer fail-closed y preservar evidencia. El contrato no se borra ni reescribe; una nueva instancia requiere otro hash, revisión y autorización explícita.

## Gates: verificados y pendientes

Verificados localmente por esta rama: mapeo opaco efímero; AES-256-GCM con AAD ligada al receipt; alias `trustleaf-*`; CAS de versión; QR corto de un uso/audience; proyección pública mínima; estados sintéticos y replay en fixtures.

Pendientes antes del deploy: suite combinada verde en la rama de integración, auditoría independiente, artefacto WASM/IDL/hash final, revisión del threat model, disponibilidad segura de aliases Testnet y autorización humana separada. Pendientes aun después de Testnet: KMS/HSM real, persistencia cifrada durable, auth/allowlists reales, políticas de retención, evaluación legal/clínica/farmacéutica, mainnet y producción. Una prueba verde no otorga validez clínica o legal.
