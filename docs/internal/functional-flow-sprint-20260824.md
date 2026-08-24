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
| Scrum/integración | `integration/functional-flow-candidate-20260824` / `wt-functional-flow-integration` | Scrum Master | EN CURSO | cherry-picks revisados, preflight combinado |
| autorización por objeto | `phase2/object-authorization-20260822` / `wt-phase2-object-auth` | Seguridad backend | EN CURSO | actor/receipt server-side, cross-tenant y replay negativos |
| persistencia/QR | `sprint/durable-receipt-mapping-20260824` / `wt-durable-receipt-mapping` | Datos/privacidad | EN CURSO | cifrado, CAS, mapping opaco, adapter real cerrado |
| indexer/UI/E2E | `sprint/readonly-indexer-role-e2e-20260824` / `wt-readonly-indexer-role-e2e` | Lectura/UX/QA | EN CURSO | cero writes, estados y roles cubiertos |

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
