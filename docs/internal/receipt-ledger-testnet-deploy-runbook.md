# Receipt Ledger — runbook Testnet (gated)

Estado: preparado, **no ejecutado**. Este documento no autoriza despliegue,
fondeo ni uso de datos reales.

## Gates obligatorios

Antes de cualquier transacción, registrar aprobación humana separada y confirmar:

- `cargo test -p receipt-ledger` y build reproducible del WASM exacto;
- SHA-256 e interfaz/IDL extraída desde ese mismo WASM;
- threat model, roles técnicos, custodia/rotación y procedimiento de rollback aprobados;
- cuentas exclusivas de Testnet con fixtures sintéticos, nunca derivadas de identidad;
- ningún input contiene PII/PHI, medicamento, dosis, gramaje, cantidad, saldo, PDF,
  fechas clínicas ni metadata clínica;
- RPC, network passphrase y contract ID apuntan inequívocamente a Testnet.

## Preparación local sin red

Desde `soroban/`:

```powershell
cargo fmt --all -- --check
cargo test -p receipt-ledger
stellar contract build --package receipt-ledger --locked
Get-FileHash -Algorithm SHA256 .\target\wasm32v1-none\release\receipt_ledger.wasm
stellar contract info interface --wasm .\target\wasm32v1-none\release\receipt_ledger.wasm --output json-formatted
```

La interfaz emitida por el último comando y el hash deben guardarse como evidencia
del mismo artefacto. No aceptar una IDL copiada manualmente.

## Despliegue (bloqueado hasta aprobación explícita)

Usar identidades almacenadas de forma segura; nunca incluir semillas en comandos,
logs, tickets o variables versionadas.

```powershell
stellar contract deploy --wasm .\target\wasm32v1-none\release\receipt_ledger.wasm --source <DEPLOYER_ALIAS> --network testnet --alias receipt-ledger-testnet
```

Guardar contract ID, hash WASM, ledger y resultado. Detenerse si la simulación, el
hash o la red no coinciden con la evidencia aprobada.

## Inicialización e invocaciones sintéticas

Los valores `<...>` deben ser cuentas técnicas Testnet y hex de 32 bytes generados
aleatoriamente para fixtures. Primero inspeccionar la CLI derivada:

```powershell
stellar contract invoke --id receipt-ledger-testnet --source <ADMIN_ALIAS> --network testnet -- --help
```

Luego, sólo bajo la misma autorización de ejecución, seguir el orden:

1. `init` con administrador técnico.
2. `set_doctor` y `set_dispensary` con cuentas técnicas efímeras.
3. `issue` con `receipt_id`, `commitment` y `operation_id` opacos.
4. `set_grant`, `activate`, `record_partial` y `mark_dispensed`, usando un
   `operation_id` nuevo por intención y el `expected_version` observado.
5. Repetir exactamente una operación para demostrar idempotencia y enviar una
   versión obsoleta para demostrar rechazo por concurrencia.
6. Verificar que QR/indexador sólo expongan existencia, coincidencia y vigencia.

Antes de enviar cada mutación puede construirse XDR sin transmitirlo mediante
`--build-only`; esto tampoco sustituye la revisión humana del payload y la red.

## Criterios de parada y rollback

Parar ante red ambigua, auth inesperada, evento con `schema_version` desconocida,
timeout/resultado `unknown`, datos no opacos o divergencia de versión. No reintentar
una intención con otro `operation_id` mientras su resultado sea desconocido.

El contrato no es actualizable ni transferible. El rollback operativo consiste en
detener submissions, revocar roles/grants si es seguro y volver el adapter al modo
fail-closed; desplegar otra instancia exige nueva aprobación y nueva evidencia.
