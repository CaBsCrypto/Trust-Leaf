# Receipt Ledger v1 — contrato local

Estado: implementado y probado localmente. No desplegado en Testnet ni autorizado para uso clínico.

## Superficie congelada para revisión

El contrato Soroban independiente `receipt-ledger` registra únicamente:

- `receipt_id`: valor aleatorio opaco de 32 bytes;
- `commitment`: valor opaco de 32 bytes calculado fuera de cadena;
- `state`: `Issued`, `Active`, `Partial`, `Dispensed`, `Revoked` o `Expired`;
- `version`: contador monotónico.

No crea un token transferible. No almacena paciente, RUT, diagnóstico, medicamento, dosis, gramaje, cantidad, saldo, PDF, consentimiento, historial ni metadata clínica. Los eventos incluyen la cuenta técnica autorizada que ejecutó la operación; esa cuenta no debe contener ni derivarse de identidad clínica.

## Controles implementados y verificados

- autorización separada para administrador, médico y dispensario;
- deshabilitación de roles con comportamiento fail-closed;
- máquina de estados explícita y estados terminales;
- compare-and-swap mediante `expected_version` para rechazar carreras;
- idempotencia mediante `operation_id` opaco;
- unión del `operation_id` a la cuenta actora y al dominio exacto (`issue`, `activate`, `partial`, `dispense`, `revoke` o `expire`);
- rechazo de reapropiación por otra cuenta autorizada y de replay entre funciones;
- rechazo de reutilización del mismo `operation_id` con parámetros distintos;
- eventos versionados separados para los seis estados;
- expiración materializada por administrador, sin publicar duración ni fecha clínica;
- pruebas de ciclo completo, repetición exacta, replay alterado, concurrencia, transición terminal y roles.

Comando de evidencia:

```text
cargo test -p receipt-ledger
```

## Límites y gates pendientes

- El contrato no puede comprobar la aritmética oculta de saldo o dispensación parcial. Esa regla permanece fuera de cadena; el commitment solo ancla su versión.
- Los estados, tiempos y cuentas técnicas actoras son públicos. Una cuenta reutilizada permite correlacionar operaciones y análisis temporal; antes de Testnet se debe aprobar una estrategia de cuentas seudónimas, rotación/custodia y su impacto de auditoría. Nunca debe derivarse una cuenta desde RUT, correo, ficha o identificador de paciente.
- La generación criptográfica de IDs/commitments, custodia de claves, registro operativo cifrado, QR, firma server-side y RBAC de aplicación no pertenecen a este contrato.
- Falta revisión independiente del IDL, auditoría de seguridad y autorización específica antes de cualquier despliegue Testnet.
- No demuestra autenticidad o validez clínica/legal y no debe emplearse con pacientes o datos reales.
