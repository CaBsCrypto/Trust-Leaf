# Roadmap de continuación — Supabase operativo seguro

**Corte:** 2026-08-26. **Entorno:** desarrollo sintético. Este documento es el
punto de reanudación; no acredita cumplimiento ni preparación clínica.

## Estado comprobado

| Estado | Evidencia |
|---|---|
| **APLICADO EN SUPABASE** | baseline `trustleaf_synthetic_security_baseline`; schema privado con 7 tablas vacías; RLS ENABLE+FORCE 7/7; cero policies; grants públicos/API revocados; auditoría append-only |
| **PREPARADO LOCALMENTE** | rama `feature/supabase-auth-rbac-local-20260826`; cliente Auth fail-closed; migración RBAC siguiente y suites multirol; no aplicada |
| **LEGACY DETECTADO** | React todavía importa Firebase/Firestore y contiene fallbacks locales; no migrado ni aprobado como autoridad clínica |
| **PENDIENTE DE AUTORIZACIÓN** | aplicación de RBAC, usuarios sintéticos, exposición de schema/API, configuración Auth, KMS/backups y cualquier adapter durable |

## Fases y Definition of Done

1. **Cerrar diff Auth/RBAC local.** Terminado cuando QA Supabase, typecheck,
   build, diff check y revisión independiente estén verdes; el SQL no contiene
   PII/PHI ni escrituras directas de `authenticated`.
2. **Gate remoto RBAC.** Terminado cuando existe diff/dry-run sanitizado,
   rollback revisado y autorización humana explícita para una sola migración.
3. **Prueba RLS multirol sintética.** Terminado cuando médico, paciente,
   dispensario, admin, anónimo, suspendido, vencido y cross-tenant tienen
   evidencia allow/deny reproducible; cero datos reales.
4. **Comandos durables.** Terminado cuando enrolamiento, consentimiento,
   relación, receipt y dispensación técnica usan CAS, idempotencia, auditoría y
   cifrado por aplicación; no hay fallback local/Firebase silencioso.
5. **Operación de desarrollo.** Terminado con MFA admin, bootstrap/rotación,
   KMS, rate limits, logs redactados, backup/restore y respuesta a incidentes.
6. **Evaluación de piloto real.** Sólo después de evidencia y aprobación formal
   de seguridad/privacidad, abogado, médico y químico farmacéutico.

## Camino crítico y responsables

| Dependencia/gate | Responsable | Estado |
|---|---|---|
| QA y revisión SQL/RLS | ingeniería + seguridad independiente | en curso local |
| aplicar migración RBAC | usuario/owner Supabase | bloqueado por aprobación separada |
| método Auth, MFA y primer admin | producto + seguridad | pendiente |
| KMS, backup/PITR, retención | infraestructura + privacidad | pendiente |
| consentimiento/ficha/receta/farmacia | legal + clínico + QF + ingeniería | NO-GO |

## Reanudación concreta

1. Abrir el worktree `wt-supabase-readiness` y confirmar la rama/árbol limpio.
2. Ejecutar `npm run qa:supabase-readiness` y `git diff --check`.
3. Revisar `supabase-auth-rbac-application-gate-20260826.md` y el diff de
   `20260826150000_trustleaf_auth_rbac_minimum.sql`.
4. Con MCP oficial, hacer sólo inspección read-only + lint/dry-run sanitizado.
5. Solicitar autorización explícita antes de aplicar. No encadenar migraciones.
6. Tras aplicar, verificar migración, policies, grants y pruebas multirol dentro
   de transacciones reversibles; detenerse ante cualquier diferencia.

## Riesgos y NO-GO

- Una sesión Auth no equivale a actor verificado ni consentimiento.
- Cero policies en la baseline significa denegación total, no flujo operativo.
- Firebase/local y Supabase no pueden hacer dual-write ni fallback silencioso.
- No habilitar Data API, Storage, Realtime, Edge, Testnet submissions o deploy.
- No usar personas, emails, RUT, fichas, recetas, diagnósticos o claves reales.
