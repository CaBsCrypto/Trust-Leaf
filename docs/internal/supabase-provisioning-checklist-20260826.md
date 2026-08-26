# Checklist de provisioning Supabase — entorno sintético

**Estado:** pendiente; no se provisionó nada. Este checklist no autoriza datos reales.

## Decisiones humanas previas

- [ ] Aprobar Supabase como plataforma de prueba aislada y responsable técnico.
- [ ] Elegir región/plan tras revisar DPA, subencargados, transferencias y disponibilidad.
- [ ] Elegir proveedor/owner de KMS-HSM externo; Supabase Vault no sustituye envelope encryption clínica.
- [ ] Aprobar clases de retención y prueba de restore con responsables legal/seguridad.

## Provisioning técnico

- [ ] Proyecto vacío, sin importación Firestore/local y sin usuarios reales.
- [ ] Auth con MFA para privilegios; issuer/audience/JWKS allowlisted y rotación ensayada.
- [ ] Secretos sólo server-side; comprobar que bundle/logs no contienen database URL ni `service_role`.
- [ ] Aplicar schema versionado primero con RLS habilitado y sin políticas: todo debe denegar.
- [ ] Agregar políticas y grants por una migración revisada; no usar claims editables por el usuario.
- [ ] Configurar KMS externo, separación de duties, rotación y recovery.
- [ ] Configurar backups/PITR según plan, export separado de Storage y restore aislado.
- [ ] Observabilidad con redacción, alertas de denegación/anomalía y rate limits distribuidos.

## Suite obligatoria antes de fixtures compartidos

- [ ] JWT ausente, inválido, vencido, issuer/audience incorrecto y rol suspendido: denegados.
- [ ] Médico asignado/no asignado; paciente propio/cruzado; dispensario asignado/cruzado; admin sin contenido clínico.
- [ ] Consentimiento/relación expirados y JWT stale: denegados.
- [ ] Escritura concurrente CAS, idempotencia, replay y rollback transaccional.
- [ ] QR público sólo devuelve existencia/estado mínimo; no permite enumeración.
- [ ] Backup y restore comparados por conteo/digest; revocación de clave y runbook de incidente.
- [ ] Revisión independiente con evidencia y árbol limpio.

## Migración posterior (bloqueada)

No migrar datos reales. El ensayo permitido exporta únicamente fixtures con manifiesto, digest, conteo y reconciliación. Se elimina el fallback silencioso `Firebase → Supabase → local`; cualquier fallo durable se expone como error fail-closed.
