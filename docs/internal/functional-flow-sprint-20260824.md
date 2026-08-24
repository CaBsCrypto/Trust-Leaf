# Sprint funcional read-only — 2026-08-24

Base: Fase 1 `d385b3d`. Rama candidata: `integration/functional-flow-candidate-20260824`.

## Objetivo y límites

Dejar un flujo técnico reproducible con fixtures sintéticos: identidad autorizada → actor opaco → receipt → lectura/indexación Testnet → QR mínimo → vistas por rol. No se habilitan submissions, recursos externos, datos clínicos reales ni producción.

Defaults obligatorios durante todo el sprint:

- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false`
- `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`
- ninguna cuenta, secreto, IdP, Postgres/Supabase o KMS/HSM real;
- ninguna escritura RPC, fondeo, deploy, push o merge a `main`.

## Tablero real

| Frente | Rama / worktree | Responsable | Estado | Gate de integración |
|---|---|---|---|---|
| Scrum/integración | `integration/functional-flow-candidate-20260824` / `wt-functional-flow-integration` | Scrum Master | CANDIDATA LOCAL | cherry-picks revisados, preflight combinado |
| autorización por objeto | `phase2/object-authorization-20260822` / `wt-phase2-object-auth` | Seguridad backend | INTEGRADO | actor/receipt server-side, cross-tenant y replay negativos |
| persistencia/QR | `sprint/durable-receipt-mapping-20260824` / `wt-durable-receipt-mapping` | Datos/privacidad | INTEGRADO, ADAPTER LOCAL | cifrado, CAS, mapping opaco, adapter real cerrado |
| indexer/UI/admin/E2E | `sprint/readonly-indexer-role-e2e-20260824` / `wt-readonly-indexer-role-e2e` | Lectura/UX/QA | INTEGRADO, READ-ONLY | cero writes, estados, roles y panel admin cubiertos |

## Dependencias y orden de integración

1. Congelar contratos de identidad, actor, receipt y operación idempotente.
2. Integrar autorización por objeto y tests negativos.
3. Integrar port durable cifrado y mapping opaco.
4. Conectar lector/indexador y proyecciones UI por rol únicamente a esos contratos.
5. Ejecutar suite combinada, privacy scan, TypeScript y build.
6. Revisión independiente de diferencias y gates externos.

## Definition of Done local

- ningún handler operacional confía en email, rol, address, wallet, identidad o XDR para decidir propiedad;
- acceso a receipt se decide con principal autenticado y registro server-side;
- replay e idempotency conflict se rechazan de forma determinista;
- QR contiene únicamente handle opaco y la respuesta pública permanece minimizada;
- stores, indexer y rate limits tienen ports durables; sólo fixtures memory están activos;
- vistas por médico, paciente, dispensario y admin no amplían permisos;
- panel admin mínimo muestra sólo colas operacionales, estados, trazabilidad técnica y alertas sintéticas; no incluye PHI ni acciones activas;
- todas las rutas mutantes permanecen cerradas incluso para un principal válido;
- documentación separa implementado de infraestructura pendiente.

## Decisiones externas mínimas posteriores

1. IdP/JWKS y owners del lifecycle de allowlists.
2. Store Postgres/Supabase, región, RLS, backups y retención.
3. KMS/HSM, workload identity, rotación y break-glass.
4. RPC/indexer durable, finality/reorg/SLA y límites distribuidos.
5. Binding verificado de usuario real a actor y proceso de alta/suspensión.
6. Gate legal, clínico y farmacéutico; la evidencia técnica no constituye validez clínica.
7. Autorización separada para cualquier nueva submission Testnet.

**Estado inicial:** GO para desarrollo sintético local/read-only; NO-GO para submissions y producción.

## Evidencia integrada

- `test:legacy-object-auth`: PASS — propiedad subject→actor→receipt, grants, acceso cruzado, tamper de identidad/XDR y replay/conflict.
- `test:durable-receipt-mapping`: PASS — envelope cifrado, IDs/QR opacos, CAS, ownership e idempotencia.
- `test:readonly-indexer-role-e2e`: PASS — recuperación/cursor/reorg, todos los estados y roles, panel admin y forbidden-data scan.
- `npm run preflight`: todas las suites y TypeScript pasaron. El build dentro del sandbox se detuvo únicamente por `spawn EPERM` al crear `esbuild`.
- `npm run build` repetido fuera de esa restricción local: PASS, 2.426 módulos; sólo warning histórico de chunks mayores a 800 kB.

## Límites confirmados de la candidata

- El middleware Express usa actualmente fixtures sintéticos in-memory para subject→actor→receipt. El port cifrado está validado, pero no se conecta a Postgres/KMS ni debe describirse como persistencia externa activa.
- El indexer implementa CAS/recovery mediante un port, pero el adapter incluido es `durable:false` en memoria; no hay RPC/indexer live configurado.
- Los handlers serverless separados todavía no comparten la cadena completa de autorización por objeto; no deben exponerse como equivalentes al servidor Express.
- El panel admin sólo muestra fixtures operacionales y mantiene acciones sensibles deshabilitadas; no constituye administración productiva.
- Ninguna submission fue ejecutada o habilitada. El estado final continúa NO-GO para nuevas transacciones Testnet y producción.

## Revisión visual reproducible

- Guion operativo: `docs/internal/visual-readonly-e2e-runbook-20260824.md`.
- Backlog de hallazgos UX: `docs/internal/visual-readonly-ux-backlog-20260824.md`.
- Gate automatizado complementario: `npm run test:visual-readonly-review`.

## Revisión independiente

Veredicto: **GO limitado para demo local aislada/read-only; NO-GO como candidata desplegable**. No se encontró P0 mientras ambos kill-switches permanezcan en `false`.

Hallazgos obligatorios antes de cualquier despliegue o submission:

- las funciones serverless en `api/stellar/*` no comparten todavía toda la cadena JWT/RBAC/object-auth de Express;
- los adapters de mapping/indexer durables permanecen en memoria y no coordinan reinicios o múltiples instancias;
- los builders y contrato clínico legacy usan addresses/cantidades y payload clínico, incompatibles con el receipt opaco nuevo; deben aislarse o retirarse antes de exposición;
- `submitDefindexSigned` y `signAndSubmitDefindex` recibieron un kill-switch interno adicional durante la integración; las rutas ya respondían 503.
