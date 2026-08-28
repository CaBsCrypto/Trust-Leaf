# ADR-005 — Supabase como plataforma de prueba preferida

**Estado:** propuesto para aprobación humana. **Fecha de corte:** 2026-08-26.
**Alcance:** arquitectura y fixtures sintéticos; no se creó proyecto, credencial, migración, SDK ni infraestructura.

## Decisión propuesta

Usar **Supabase (Postgres + Supabase Auth + RLS)** como objetivo del siguiente entorno de prueba aislado. Mantener los puertos actuales como frontera y prohibir acceso directo desde React a tablas clínicas. Neon queda como alternativa Postgres válida y también ofrece Auth/RLS; la preferencia por Supabase responde a la dirección de producto y a consolidar el primer camino de prueba, no a una supuesta incapacidad de Neon.

Esta decisión no declara cumplimiento, preparación clínica ni autorización para datos reales. Supabase sólo pasa de objetivo a adaptador ejecutable después de aprobar región/contrato, modelo de amenazas, RLS, cifrado por aplicación, restore y pruebas de autorización.

## Evidencia del repositorio

- No hay SDK de Supabase o Neon instalado ni configuración Neon.
- `.env.example` sólo contiene nombres públicos legacy `VITE_SUPABASE_*`; no existe configuración server-side aprobada.
- `src/lib/trustData.ts` y `docs/supabase-mvp-schema.sql` son demo legacy: usan clave anónima en navegador, `select=*`, fallback local silencioso y políticas anónimas globales sobre columnas identificables. **No son reutilizables para piloto real.**
- Los puertos `durable-encrypted-store`, `durable-receipt-mapping` y `durable-readonly-receipt-indexer` sí son frontera reutilizable; sus adapters durables externos aún no existen.

## Supabase vs Neon

| Criterio | Supabase | Neon | Decisión |
|---|---|---|---|
| Auth + Postgres + RLS | Integrados; JWT y claims pueden alimentar RLS | Auth/RLS disponibles; igualmente exige fijar modo y contratos de identidad | Supabase concentra el primer camino aprobado |
| Autorización | RLS, grants, hooks y custom claims; exige políticas explícitas | RLS con JWT/JWKS; Data API y Neon RLS tienen restricciones de coexistencia | Ambas requieren pruebas negativas |
| Cifrado clínico | TLS/at-rest de plataforma; Vault no reemplaza KMS clínico | TLS/at-rest y KMS de plataforma; tampoco reemplaza KMS clínico | Envelope encryption externo en ambos |
| Backups | Backups/PITR dependen del plan; Storage requiere respaldo separado | Restore/branching/snapshots según producto/plan | Validar plan y ejecutar restore real |
| Operación de prueba | Menos proveedores para Auth/RLS/Postgres | Excelente branching, más ensamblaje de identidad | Supabase preferido; Neon contingencia |

## Frontera de migración

1. React sólo llama servicios server-side autenticados; nunca usa `service_role` ni tablas clínicas directamente.
2. El servicio resuelve `JWT subject → actor_ref → object_ref`, aplica scopes y vuelve a comprobar propiedad.
3. Postgres conserva metadatos mínimos y ciphertext; KMS/HSM externo envuelve DEK por objeto.
4. Firestore/local queda congelado para demo. No hay dual-write silencioso ni fallback local tras un fallo durable.
5. Sólo fixtures sintéticos se exportan en ensayo. Cada lote tiene conteo, digest y reconciliación.
6. Cutover requiere suite RLS multirol, backup/restore, auditoría append-only, rollback y revisión independiente.

## Reglas de identidad y RLS

- RLS en toda tabla expuesta y grants mínimos; ausencia de JWT/policy deniega.
- No confiar en `raw_user_meta_data`; roles operativos provienen de claims controlados server-side o tablas de grants.
- JWT viejo, rol suspendido, vínculo revocado o MFA insuficiente deben fallar cerrados.
- `service_role` queda exclusivamente server-side, bajo allowlist y auditoría; nunca en bundle o navegador.
- Vista pública QR se implementa como DTO minimizado server-side, no como lectura anónima de tablas.

## Cifrado, auditoría y retención

- PII, ficha, consentimiento y detalle de receta se separan en envelopes cifrados por aplicación.
- Postgres guarda ciphertext, wrapped DEK, versión de clave, AAD y referencia opaca; el KMS/HSM no se provisiona en esta fase.
- Auditoría append-only con secuencia, resultado y hash encadenado; sin payload clínico.
- Retención/borrado son clases pendientes de dictamen chileno. Deben incluir backups, legal hold, crypto-erasure cuando corresponda y restore drills.

## Fuentes primarias de producto consultadas

- Supabase: [Database overview](https://supabase.com/docs/guides/database/overview), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [JWT](https://supabase.com/docs/guides/auth/jwts), [RBAC/custom claims](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac), [backups](https://supabase.com/docs/guides/platform/backups), [Vault](https://supabase.com/docs/guides/database/vault), [signing keys](https://supabase.com/docs/guides/auth/signing-keys).
- Neon: [RLS](https://neon.com/docs/guides/row-level-security), [security overview](https://neon.com/docs/security/security-overview), [branching](https://neon.com/docs/guides/branching-intro), [DPA](https://neon.com/pdf/DPA.pdf).

Las páginas se consultaron el 2026-08-26. Las capacidades y planes deben volver a verificarse al provisionar.

## Consecuencias y gate humano mínimo

La única decisión inmediata es: **aprobar Supabase como entorno de prueba aislado y autorizar una fase posterior de provisioning sin datos reales**, indicando región/plan y responsables de IdP, KMS y backup. Esa aprobación aún no autoriza pacientes, producción ni migración.
