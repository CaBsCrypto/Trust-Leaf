# Guion de revisión UI + evidencia Testnet — 2026-08-24

Estado: candidata local read-only. No autoriza submissions, despliegue, datos reales ni uso clínico.

## Ruta y propósito

Abrir `/demo/receipt-pilot`. La vista separa deliberadamente:

- **fixture local:** proyección navegable sin identidad ni datos clínicos;
- **evidencia Testnet:** enlaces al contrato desplegado y a transacciones históricas del smoke del 22-08-2026;
- **QR público demo:** sólo existencia, coincidencia y estado mínimo. No consulta por nombre/RUT ni muestra detalle operacional.

Rutas reproducibles:

- médico: `/demo/receipt-pilot?role=doctor&scenario=active`
- paciente: `/demo/receipt-pilot?role=patient&scenario=active`
- dispensario: `/demo/receipt-pilot?role=dispensary&scenario=partial`
- admin: `/demo/receipt-pilot?role=admin&scenario=dispensed`
- estados alternos: `active`, `partial`, `dispensed`, `revoked`, `expired` o `unknown`.

## Guion humano

1. Confirmar el banner `Revisión local · sin submissions` y el copy de fixture sintético/no validez clínica.
2. Abrir el contrato en Stellar Expert y comprobar el ID `CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3`.
3. En Médico, abrir `Issued` y `Active`; contrastar con la timeline local versionada.
4. En Paciente, comprobar que no hay cantidades, identidad o historial. Abrir el QR demo y verificar que la respuesta pública sólo muestra existencia, coincidencia y estado.
5. En Dispensario, abrir `Partial` y `Dispensed`; comprobar que no hay acción de ledger disponible.
6. En Admin, revisar los seis enlaces históricos, las colas opacas y que todas las acciones sensibles están deshabilitadas.
7. Recorrer `active`, `partial`, `dispensed`, `revoked`, `expired` y `unknown`; refrescar y comprobar que rol/escenario se conservan en la URL. El QR de `partial` se minimiza públicamente a `active`; `dispensed` no ofrece un QR reutilizable.
8. Revisar ancho móvil y navegación por teclado: selector de rol, escenario, enlaces y QR.

## Evidencia automatizada

- `npm run test:ui-onchain-review`: contrato allowlisted, enlaces Testnet exactos, cuatro roles, rutas deterministas, privacy scan y ausencia de primitivas de escritura.
- `npm run test:visual-qa-regressions`: QR activo por navegación SPA y gate admin no identificable.
- `npm run lint` y `npm run build`: integridad TypeScript/build.
- `npm run preflight`: suite combinada antes de integrar.

## Backlog UX observado

| Prioridad | Hallazgo / mejora | Estado |
|---|---|---|
| P1 | Ejecutar QA visual Browser desktop/móvil y teclado sobre servidor local | pendiente de preview |
| P1 | Confirmar accesibilidad de contraste y foco visible en Stellar Expert links | pendiente de revisión humana |
| P2 | Añadir indicador de última lectura RPC cuando exista indexer durable | bloqueado por infraestructura; no mezclar en UI |
| P2 | QR Testnet real requiere emisión durable de token opaco y backend autenticado | bloqueado por KMS/store/IdP |
| P2 | El panel admin de esta ruta es preview con fixture; el panel real permanece detrás de auth | confirmado/limitado |

## Límites

La página no consulta RPC directamente ni declara que el fixture sea el receipt histórico. Los enlaces prueban actividad técnica en Testnet; no prueban identidad, contenido clínico, propiedad, cumplimiento ni validez de una receta. `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false` permanecen obligatorios.
