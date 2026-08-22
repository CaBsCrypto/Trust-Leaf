# Sprint post-smoke — lectura Testnet y gates operativos

Baseline: `3a7e636`, posterior al smoke técnico documentado. Rama Scrum: `integration/post-smoke-readonly-20260822`.

## Regla operativa

`TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` permanece inmutable durante este sprint. No se autorizan nuevas transacciones, deploy, fondeo, producción, mainnet, push, merge a `main` ni datos reales. La única interacción de red admisible es lectura RPC/indexer del contrato Testnet ya desplegado mediante allowlist.

## Frentes activos reales

| Frente | Rama / worktree | Responsable | Estado | Resultado esperado |
|---|---|---|---|---|
| Scrum e integración | `integration/post-smoke-readonly-20260822` / `wt-post-smoke-integration` | Scrum Master | EN CURSO | integración selectiva y gates |
| Lectura UI/QR | `sprint/readonly-ui-qr-20260822` / `wt-readonly-ui-qr` | Backend + UX | EN CURSO | RPC/indexer read-only, QR mínimo |
| Auth/admin | `sprint/auth-admin-minimal-20260822` / `wt-auth-admin-minimal` | Seguridad/identidad | EN CURSO | auth server-side y panel readiness fail-closed |
| Datos/KMS/observabilidad | `sprint/durable-data-kms-observability-20260822` / `wt-durable-data-kms-observability` | Datos + seguridad/SRE | EN CURSO | ports durables, cifrado, redacción, rate limit |
| QA E2E read-only | rama por crear tras freeze | QA independiente | PROGRAMADO | médico/paciente/QR/dispensario/admin sin writes |

## Definition of Done

- contract ID, RPC y schema v1 se validan por allowlist server-side;
- ningún endpoint o componente puede abrir submission ni construir mutaciones;
- QR público revela sólo existencia, coincidencia y estado y resiste enumeración/tamper;
- auth verifica issuer, audience, expiración, subject allowlist, rol y scope sin confiar headers;
- admin mínimo sólo muestra readiness sanitizado y permanece cerrado sin auth/allowlist reales;
- persistencia durable se expresa mediante un port reversible; el adapter real permanece cerrado sin configuración;
- envelope encryption, AAD, versiones/rotación, auditoría append-only y concurrencia tienen tests;
- logs/métricas no incluyen tokens, handles completos, PII/PHI, secretos o XDR;
- rate limits y fallos de proveedor son fail-closed;
- E2E por rol, privacy scan, preflight y revisión independiente quedan verdes;
- documentación distingue implementado localmente de infraestructura y aprobaciones pendientes.

## Decisiones humanas antes de nuevas submissions

1. IdP/JWKS, owners de allowlist y proceso de alta/baja por rol.
2. Proveedor Postgres/Supabase, región, backups, retención/borrado y RLS; aún no configurado.
3. KMS/HSM, IAM/workload identity, doble control, rotación y break-glass.
4. Proveedor de indexer/RPC, finality, SLA, reorg y reconciliación durable.
5. Política de rate limits, observabilidad, incident response y conservación de auditoría.
6. Revisión legal, clínica y farmacéutica; el smoke no constituye receta ni dispensación válida.
7. Nueva autorización explícita, acotada y separada por operación Testnet.

**Estado:** GO para desarrollo/read-only local; NO-GO para nuevas submissions y producción.
