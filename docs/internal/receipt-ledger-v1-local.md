# Receipt Ledger v1 — contrato local

Estado: implementado y probado localmente. No desplegado en Testnet ni autorizado para uso clínico.

## Superficie congelada para revisión

El contrato Soroban independiente `receipt-ledger` registra únicamente:

- `receipt_id`: valor aleatorio opaco de 32 bytes;
- `commitment`: valor opaco de 32 bytes calculado fuera de cadena;
- `state`: `Issued`, `Active`, `Partial`, `Dispensed`, `Revoked` o `Expired`;
- `version`: contador monotónico.

No crea un token transferible. No almacena paciente, RUT, médico, dispensario, diagnóstico, medicamento, dosis, gramaje, cantidad, saldo, PDF, consentimiento, historial ni metadata clínica. Las cuentas autorizadas son cuentas técnicas seudónimas y no se publican dentro de los eventos del recibo.

## Controles implementados y verificados

- autorización separada para administrador, médico y dispensario;
- deshabilitación de roles con comportamiento fail-closed;
- máquina de estados explícita y estados terminales;
- compare-and-swap mediante `expected_version` para rechazar carreras;
- idempotencia mediante `operation_id` opaco;
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
- Los estados y sus tiempos de transacción son públicos y permiten análisis temporal, aunque los identificadores sean aleatorios.
- La generación criptográfica de IDs/commitments, custodia de claves, registro operativo cifrado, QR, firma server-side y RBAC de aplicación no pertenecen a este contrato.
- Falta revisión independiente del IDL, auditoría de seguridad y autorización específica antes de cualquier despliegue Testnet.
- No demuestra autenticidad o validez clínica/legal y no debe emplearse con pacientes o datos reales.
