# Gate de aplicación Supabase — baseline sintética

**Estado:** **APLICADO Y VERIFICADO** sólo en el proyecto Supabase de desarrollo
sintético. Fecha de corte: 2026-08-26. No autoriza policies funcionales, usuarios,
datos reales ni producción.

## Alcance del diff

- configuración CLI local sin Project Ref ni secretos;
- servicios locales API, Realtime, Studio, Storage, Edge y Analytics deshabilitados;
- Auth sin signup; seed deshabilitado;
- migración versionada `20260826060000_trustleaf_synthetic_security_baseline.sql`;
- schema privado con vínculos opacos, envelopes cifrados, grants, entitlements, receipts, idempotencia y auditoría;
- RLS `ENABLE` + `FORCE` en todas las tablas y **cero policies** en este baseline;
- revocación explícita y default privileges para `public`, `anon`, `authenticated` y `service_role`;
- roles técnicos `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` sin asignaciones;
- trigger append-only para impedir `UPDATE/DELETE` de auditoría.

No contiene PII/PHI, receta, diagnóstico, dosis, gramaje, RUT, email, wallet, dirección, claves o Project Ref. No crea bucket, Edge Function, usuario ni política pública.

## Evidencia disponible

- `npm run test:supabase-migration-security`: revisión estática de versionado, tablas, RLS, grants, auditoría y campos prohibidos.
- `npm run qa:supabase-readiness`: puertos locales, cifrado/rotation/CAS/audit, mapping opaco, typecheck y build.
- `git diff --check` y diff humano deben pasar antes de gate.

## Evidencia remota cerrada

La baseline se aplicó exactamente una vez mediante el MCP oficial. Supabase la
registró con nombre `trustleaf_synthetic_security_baseline` y versión remota
`20260826055213`; el archivo local aprobado conserva el prefijo
`20260826060000`. La diferencia corresponde al versionado administrativo del
MCP, no a un segundo diff aplicado.

- schema `trustleaf_private` y 7 tablas vacías;
- RLS habilitado y forzado 7/7, cero policies;
- roles técnicos `NOLOGIN/NOINHERIT/NOBYPASSRLS`;
- cero grants no deseados a roles API/PUBLIC;
- trigger append-only activo;
- QA local de baseline verde.

Los avisos `rls_enabled_no_policy` son esperados en este baseline de denegación
total. Los índices de FK sugeridos por el advisor quedan para una migración
separada y no deben añadirse silenciosamente.

## Próximo gate, separado

La migración RBAC/Auth posterior se revisa en
`supabase-auth-rbac-application-gate-20260826.md`. Requiere diff, QA, dry-run y
autorización humana nuevos. No se encadena automáticamente con esta baseline.

Sigue **NO-GO** para personas/datos reales, API pública, Storage, Edge,
producción o integración clínica.
