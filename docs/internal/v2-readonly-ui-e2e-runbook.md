# UI read-only V2 — guion humano y gate E2E

Estado: **GO para fixture local**. **NO-GO para lectura Testnet** hasta integrar un lector/indexador durable revisado. No habilita mutaciones, firma, envío, login real, uso clínico ni validez jurídica.

## Ejecutar

```powershell
npm run qa:v2-readonly-ui
npm exec vite -- --host 127.0.0.1 --port 5198
```

Abrir `http://127.0.0.1:5198/demo/trust-registry?scenario=doctor-validated`.

## Contrato visible

La UI consume `V2ReadonlyEvidencePort`, no RPC. El puerto entrega sólo un snapshot sanitizado con rol, estado mínimo, freshness legible, cursor técnico no sensible, finality, reorg y —únicamente después de allowlist— una referencia truncada y URL de Stellar Expert Testnet.

El fixture predeterminado debe mostrar:

- `source: local-fixture`, `finality: local-fixture` y `reorg: none`;
- `Evidencia Testnet V2 · pendiente` sin link;
- razón visible `Reader/indexer Testnet aún no conectado`;
- cero llamadas de red, firma, mutación o lectura de secretos.

Todo snapshot con rol/escenario discordante, campo inseguro, host no allowlisted, finality pendiente, reorg/reconciliación, freshness stale o excepción se transforma en `unknown` + `blocked` y elimina la evidencia.

## Recorrido por rol

1. **Admin:** `doctor-validated`, `doctor-suspended`, `dispensary-validated`, `dispensary-expired`, `admin-audit`.
2. **Médico:** `patient-eligible`, `eligibility-revoked`, `receipt-issued`, `receipt-active`, `receipt-revoked`.
3. **Paciente:** `patient-readonly`; sólo estado mínimo y referencias truncadas, nunca ficha o identidad.
4. **Dispensario:** `receipt-partial` y `receipt-dispensed`.

En cada paso cotejar rol, estado/versión, evento esperado, bloque de lector y ausencia de PHI/PII. No interpretar el fixture como evidencia on-chain.

## Browser QA obligatorio

- Desktop `1440×900`: recorrer todos los escenarios; consola limpia; cero overflow; selector y estado `aria-live` actualizan.
- Móvil `390×844`: repetir `doctor-suspended`, `patient-readonly`, `receipt-partial`, `admin-audit`; verificar `scrollWidth === clientWidth`.
- Teclado: `Tab` llega a Volver, selector y sólo a un link de evidencia si el snapshot está allowlisted; foco visible; sin trampas.
- Reduced motion: con la preferencia del sistema activa, cambios de escenario y foco no dependen de animación.
- Negativos de puerto: ejecutar `npm run test:v2-readonly-ui-e2e`; debe probar tamper de rol/escenario, host, referencia completa, stale, pending, reorg y excepción con redacción.

## Gate para conectar el lector durable

Antes de sustituir el fixture debe existir revisión de: autenticación server-side del snapshot, allowlist exacta de red/contract/hash, persistencia y recuperación del cursor, regla de finality, reconciliación/reorg, retry/idempotencia, redacción de logs, rate limit y E2E por rol. La UI seguirá fail-closed si cualquiera falta.

No conservar capturas con tokens completos, identificadores correlacionables, secretos o datos reales. Las evidencias seguras son commit, resultado de suite, viewport, estado de consola y referencias ya aprobadas/truncadas.

## Evidencia local de esta rama — 2026-08-25

- suite focal, TypeScript y build: PASS; 2.428 módulos transformados;
- desktop `1440×900`: admin, médico, paciente y dispensario muestran rol/estado correctos, snapshot fixture, cero enlaces externos y cero overflow;
- móvil `390×844`: `doctor-suspended`, `patient-readonly`, `receipt-partial` y `admin-audit` sin overflow; evidencia V2 permanece pendiente y sin links;
- consola: cero warnings/errores;
- teclado: selector enfocable con outline sólido y offset; la suite estática conserva `:focus-visible` global y ausencia de trampas añadidas;
- reduced-motion: media rule cargada y control sin transición; el Browser de QA reportó preferencia normal, por lo que queda pendiente repetir con la preferencia reducida del sistema activa;
- warning histórico: el chunk `stellar` supera 800 kB; no pertenece a esta superficie read-only.
