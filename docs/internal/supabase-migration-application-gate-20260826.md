# Gate de aplicación Supabase — baseline sintética

**Estado:** diff local preparado; **NO APLICAR**. Fecha de corte: 2026-08-26.

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

## Evidencia aún requerida

El MCP Supabase está registrado en Codex para el proyecto autorizado, pero esta tarea preexistente no recibió sus herramientas. Por tanto aún faltan, y no deben inferirse:

1. inspección remota read-only de schemas, extensiones, versión Postgres y migraciones;
2. lint oficial contra entorno local/linked;
3. dry-run remoto que liste exactamente los statements pendientes;
4. revisión independiente del SQL y confirmación de rollback;
5. aprobación humana explícita del diff/dry-run.

Hasta cerrar los cinco puntos, el estado es **NO-GO para aplicar**.

## Secuencia autorizable posterior

1. Reabrir una tarea que exponga el MCP Supabase autenticado y ejecutar sólo inspección read-only.
2. Comparar Postgres remoto con `major_version` local y corregir sólo el config local si difiere.
3. Ejecutar lint y dry-run oficial; guardar salida sanitizada sin secretos.
4. Presentar diff, riesgos y rollback al usuario.
5. Sólo con nueva aprobación, aplicar esta única migración y verificar que todas las lecturas `anon/authenticated/service_role` están denegadas.

La posterior creación de policies funcionales, usuarios sintéticos, KMS, datos o adapters es otro gate separado.
