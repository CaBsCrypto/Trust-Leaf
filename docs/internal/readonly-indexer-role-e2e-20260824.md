# Lector/indexador durable y UI read-only por rol — 2026-08-24

## Alcance confirmado

Este paquete prepara lectura técnica reproducible del receipt Soroban en Stellar Testnet sin crear transacciones. Usa exclusivamente fixtures sintéticos en las pruebas y mantiene los gates de mutación cerrados.

- Ruta de flujo visible: `/demo/receipt-pilot`.
- Ruta admin visible: `/admin`, sólo después de autenticación admin y validación server-side del token por `/api/admin/readiness`.
- Estados cubiertos: `issued`, `active`, `partial`, `dispensed`, `revoked`, `expired` y `unknown`.
- Roles cubiertos: médico, paciente, dispensario y admin.
- QR público: conserva la respuesta mínima existente; el paciente sólo obtiene un token demo opaco.

## Controles implementados y verificados

| Control | Evidencia reproducible |
| --- | --- |
| Cursor y ledger canónico mediante puerto durable CAS | `npm run test:readonly-indexer-role-e2e` |
| Recuperación tras reinicio, replay idempotente, gap y reorg | `npm run test:readonly-indexer-role-e2e` |
| El source espera el commit durable antes de declarar `ingested` | `npm run test:readonly-indexer-role-e2e` |
| RPC source sólo usa `getLedgers` y `getEvents` | `npm run test:stellar-event-source` y scan negativo del E2E |
| Proyección por rol y todos los estados | `npm run test:readonly-indexer-role-e2e` |
| Panel admin deny-by-default y posterior al JWT/RBAC server-side | `npm run test:readonly-indexer-role-e2e` |
| Cola de profesional/dispensario, pacientes operativos, trace y alertas sin PII/PHI | forbidden-data scan en `npm run test:readonly-indexer-role-e2e` |
| Acciones admin sensibles deshabilitadas | assertions sobre los tres controles `disabled` |
| TypeScript | `npm run lint` |
| Suite combinada y build (2.426 módulos) | `npm run preflight` — PASS; sólo warning histórico de chunks mayores a 800 kB |

El puerto `DurableReceiptIndexerStorePort` exige `compareAndSwap` atómico. El adaptador incluido es `fixture-memory`, por lo que su health reporta `durable: false`. Un adaptador de base durable puede implementarse sin cambiar el consumidor, pero no se configura en este sprint.

## Límites y gates pendientes

- No existe en esta rama un adaptador Postgres/Supabase configurado; el puerto durable está listo, pero el fixture en memoria no sobrevive el proceso.
- La lectura RPC Testnet real requiere URL, contract allowlist y start ledger aprobados. Las pruebas usan transporte fixture y dobles del SDK; no hacen llamadas de red.
- El timeline de médico/dispensario muestra sólo estado técnico y referencia opaca. No contiene identidad, ficha, consentimiento, dosis, gramaje ni saldo clínico.
- El panel admin contiene fixtures opacos. No permite verificar, suspender ni resolver alertas. Esas acciones requieren auth real, autorización por objeto y auditoría durable.
- No se ha validado validez clínica, legal o farmacéutica.
- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false` continúan siendo precondiciones estrictas. Este paquete no contiene transportes de escritura RPC.

## Integración segura

1. Ejecutar `npm run test:readonly-indexer-role-e2e`.
2. Ejecutar `npm run test:stellar-event-source`, `npm run test:receipt-indexer` y `npm run lint`.
3. Ejecutar `npm run preflight` en la candidata integrada.
4. Revisar que ambos flags de mutación permanezcan en `false`.
5. No habilitar RPC real ni base externa sin decisión humana y secretos gestionados fuera del repositorio.
