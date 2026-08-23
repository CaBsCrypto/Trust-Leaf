# Sprint post-smoke — lectura Testnet y gates operativos

Baseline: `3a7e636`, posterior al smoke técnico documentado. Rama Scrum: `integration/post-smoke-readonly-20260822`.

## Regla operativa

`TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` permanece inmutable durante este sprint. No se autorizan nuevas transacciones, deploy, fondeo, producción, mainnet, push, merge a `main` ni datos reales. La única interacción de red admisible es lectura RPC/indexer del contrato Testnet ya desplegado mediante allowlist.

## Frentes activos reales

| Frente | Rama / worktree | Responsable | Estado | Resultado esperado |
|---|---|---|---|---|
| Scrum e integración | `integration/post-smoke-readonly-20260822` / `wt-post-smoke-integration` | Scrum Master | CANDIDATA LOCAL | integración selectiva y gates |
| Lectura UI/QR | `sprint/readonly-ui-qr-20260822` / `wt-readonly-ui-qr` | Backend + UX | INTEGRADO | RPC/indexer read-only, QR mínimo |
| Auth/admin | `sprint/auth-admin-minimal-20260822` / `wt-auth-admin-minimal` | Seguridad/identidad | INTEGRADO | JWKS/RBAC para readiness y panel real aislado |
| Datos/KMS/observabilidad | `sprint/durable-data-kms-observability-20260822` / `wt-durable-data-kms-observability` | Datos + seguridad/SRE | INTEGRADO, ADAPTER LOCAL | ports durables, cifrado, redacción, rate limit |
| QA E2E read-only | `test/post-smoke-readonly-e2e-20260822` / `wt-post-smoke-qa` | QA independiente | GO READ-ONLY LIMITADO | revisión negativa independiente, sin writes |

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

## Evidencia de la candidata

- `npm run preflight`: todas las suites, TypeScript y controles previos al build pasaron. El build dentro del sandbox falló únicamente al crear el proceso de `esbuild` (`spawn EPERM`).
- `npm run build` ejecutado localmente fuera de esa restricción: PASS, 2.422 módulos; persiste sólo el warning histórico de chunk grande.
- `test:pilot-safety`: exige simultáneamente `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=true` y el gate de mutaciones, runtime sintético local, Testnet allowlisted y no producción. Con el valor de sprint `false`, los envíos quedan cerrados.
- Las nueve llamadas legacy de envío y el transport RPC reutilizable tienen guard fail-closed inmediatamente antes del envío.
- `test:admin-auth-readiness`: el panel real usa token del IdP y no comparte la superficie legacy con controles mutantes; la sesión demo no recibe ese panel.
- Informe independiente: `post-smoke-readonly-independent-qa-20260822.md`.
- Fase 1 de autorización legacy: `phase1-legacy-auth-rbac-20260822.md`.

## Límites confirmados

- El lector QR real requiere token opaco previamente emitido y secreto HMAC gestionado; el flujo de emisión durable no está habilitado.
- JWKS/RBAC protege readiness, no las rutas operacionales legacy. Es gate obligatorio antes de cualquier nueva submission.
- Postgres/Supabase, KMS/HSM, rate limit distribuido e indexer durable no están configurados; los adapters validados son locales.
- Falta E2E HTTP autenticado completo por rol. No se declara GO de Testnet ni producción.
