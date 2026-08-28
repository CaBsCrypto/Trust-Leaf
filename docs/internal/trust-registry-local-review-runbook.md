# Gate visual local por rol — TrustRegistry + ReceiptLedgerV2

Estado: **GO sólo para QA local con fixtures**. **NO-GO** para deploy, submissions, Testnet, producción o datos reales.

Esta ruta no demuestra autenticación, autorización server-side, custodia, RPC, indexación live ni validez clínica o jurídica. Su función es hacer visible el contrato de estados mínimo que deberá cotejarse con evidencia Testnet después de un deployment autorizado.

## Comando reproducible

```powershell
npm run qa:visual-role-gate
npm exec vite -- --host 127.0.0.1 --port 5197
```

Ruta base:

`http://127.0.0.1:5197/demo/trust-registry?scenario=doctor-validated`

La prueba automatizada valida 12 escenarios obligatorios, normalización de query no allowlisted, ausencia de llamadas de red/firma/envío, fixtures sin PII/PHI, foco visible, reduced-motion, TypeScript y build. No reemplaza la revisión Browser.

El bloque read-only añadido consume un puerto de snapshots sanitizados y muestra freshness, cursor, finality, reorg y salud del lector. El fixture local permanece sin red y fail-closed. El guion detallado y los negativos están en [`v2-readonly-ui-e2e-runbook.md`](./v2-readonly-ui-e2e-runbook.md).

## Matriz visible obligatoria

| Paso | Rol visible | Query | Estado mínimo esperado | Evento futuro para cotejo |
| --- | --- | --- | --- | --- |
| validar médico | admin | `doctor-validated` | credencial médica `active` | `ActorCredentialIssued` |
| suspender médico | admin | `doctor-suspended` | médico `suspended`; receipt `blocked` | `ActorCredentialSuspended` |
| validar dispensario | admin | `dispensary-validated` | dispensario `active` | `ActorCredentialIssued` |
| expirar dispensario | admin | `dispensary-expired` | dispensario `expired`; receipt `blocked` | `ActorCredentialExpired` |
| elegibilidad paciente | médico | `patient-eligible` | elegibilidad opaca `active` | `EligibilityIssued` |
| revocar elegibilidad | médico | `eligibility-revoked` | elegibilidad `revoked`; receipt `blocked` | `EligibilityRevoked` |
| emitir receipt | médico | `receipt-issued` | `issued · v1` | `ReceiptChanged:Issued` |
| activar receipt | médico | `receipt-active` | `active · v2` | `ReceiptChanged:Active` |
| evento parcial | dispensario | `receipt-partial` | `partial · v3` | `ReceiptChanged:Partial` |
| cerrar dispensado | dispensario | `receipt-dispensed` | `dispensed · v4` | `ReceiptChanged:Dispensed` |
| revocar receipt | médico | `receipt-revoked` | `revoked · v3`; nuevas acciones bloqueadas | `ReceiptChanged:Revoked` |
| auditoría | admin | `admin-audit` | secuencia opaca v1→v2→v3 | `AuditReview` + eventos recibidos |

Cada pantalla debe mostrar `Evidencia Testnet V2 · pendiente`, red esperada y evento esperado. Contract ID y transacción permanecen sin enlace hasta que estén allowlisted en el manifest de deployment aprobado. Una ausencia visible es el comportamiento correcto antes del deploy.

## Guion humano compacto

1. Abrir la ruta base y confirmar `Fixture local · sin deploy`.
2. Recorrer las 12 opciones del selector en el orden de la matriz.
3. En cada opción, cotejar rol, paso, resultado, tres credenciales, receipt/versión y evento esperado.
4. Confirmar que las negativas usan rojo y muestran `blocked`, `suspended`, `expired` o `revoked` según corresponda.
5. En `admin-audit`, comprobar sólo rol técnico, acción, resultado y versión; no debe aparecer identidad, ficha, diagnóstico, receta, dosis, cantidad, dirección, clave o secreto.
6. Abrir `?scenario=forged`: debe normalizarse a `scenario=active`.
7. Confirmar que no existe botón de emitir, activar, dispensar, revocar, firmar o enviar. El único control de flujo es el selector local.

## QA Browser obligatorio

Registrar navegador/versión, commit y hora UTC. No usar login, extensiones de wallet ni red externa.

### Desktop

- viewport aproximado `1440 × 900`;
- recorrer las 12 opciones;
- verificar cero overflow horizontal, texto legible y ausencia de errores de consola;
- comprobar que el bloque de evidencia continúa pendiente y sin enlace externo V2.

### Móvil

- viewport `390 × 844`;
- repetir al menos: `doctor-suspended`, `patient-eligible`, `receipt-partial`, `admin-audit`;
- confirmar `scrollWidth === clientWidth`, cards apiladas y selector operable.

### Teclado y foco

- sin mouse: `Tab` debe recorrer `Volver` y `Escenario visible` en orden;
- `Alt+↓`/flechas cambian opción y la vista actualiza su `aria-live`;
- todos los controles deben mostrar outline dorado de `:focus-visible` con offset;
- no deben existir trampas de teclado.

### Reduced motion

- emular `prefers-reduced-motion: reduce`;
- repetir cambio de escenario y navegación por teclado;
- no debe observarse scroll suave ni animación/transición esencial; el contenido y foco permanecen visibles.

## Evidencia segura a conservar

- commit y árbol limpio;
- resultado de `npm run qa:visual-role-gate` y, antes de integrar, `npm run preflight`;
- dos capturas sin datos reales: desktop `admin-audit` y móvil `receipt-partial`;
- dimensiones, overflow, estado de consola, foco y reduced-motion;
- después del deploy autorizado: sólo URLs públicas Testnet y hashes/IDs ya aprobados en el manifest; nunca claves, tokens QR completos ni mapping off-chain.

## Evidencia Browser de esta rama (2026-08-25)

- desktop: 12/12 escenarios mostraron rol, resultado y evento esperado; cero enlaces V2 antes del manifest, cero overflow y cero errores/warnings de consola;
- móvil `390 × 844`: `doctor-suspended`, `patient-eligible`, `receipt-partial` y `admin-audit` sin overflow horizontal;
- teclado/foco: botón `Volver` y selector recibieron outline dorado sólido con offset;
- reduced-motion: la regla `@media (prefers-reduced-motion: reduce)` está cargada en CSSOM y elimina scroll suave/transiciones no esenciales. El Browser de QA reportó preferencia normal y no expone emulación de media; queda pendiente una pasada humana con la preferencia del sistema activada;
- build: PASS local (2.427 módulos); persiste el warning histórico por chunk `stellar` mayor a 800 kB, ajeno a esta superficie;
- test focal: PASS. Preflight combinado debe repetirse en la rama de integración con dependencias instaladas.

## Gaps P0 que esta UI no resuelve

- autenticación real y RBAC por objeto;
- contract IDs V2/hash WASM/IDL allowlisted y deploy autorizado;
- lectura RPC/indexador durable y correlación segura de eventos;
- KMS/HSM, approvals y custodia reales;
- audit log durable y evidencia de revocación/expiry posterior a reinicio;
- acceso clínico, pacientes reales o cualquier declaración de validez.

Si falta cualquiera de estos gates, la UI puede aprobar QA local pero el deployment sigue **NO-GO**.
