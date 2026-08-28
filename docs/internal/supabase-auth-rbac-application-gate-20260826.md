# Gate de aplicación — Supabase Auth/RBAC mínimo

**Estado:** preparado localmente; **NO APLICAR**. Fecha de corte: 2026-08-26.

## Resultado preparado

- SDK oficial de Supabase en el navegador, inerte mientras
  `VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED=false`.
- Sólo URL pública y `sb_publishable_*`; una clave `secret/service_role` en
  configuración cliente falla cerrada.
- La identidad viene del JWT de Supabase. El rol operativo se resuelve desde
  `trustleaf_private.actor_bindings`; no se confía en metadata editable ni en
  roles/scopes declarados por el cliente.
- Migración local
  `20260826150000_trustleaf_auth_rbac_minimum.sql`: lectura RLS por objeto para
  médico, paciente, dispensario y admin; ninguna escritura directa para
  `authenticated`.
- Enrolamiento propio limitado a médico/paciente/dispensario en estado
  `pending`. Un admin no puede autoasignarse.
- Activación, suspensión y revocación preparadas mediante una función
  administrativa con actor admin durable, CAS, idempotencia y evento de
  auditoría append-only; el digest global se serializa con advisory lock y el
  admin no puede auto-bloquearse.
- `idempotency_journal.actor_ref` conserva integridad referencial hacia el actor.

No se conectó el frontend, no se creó usuario, no se expuso el schema en Data
API y no se aplicó esta migración al proyecto remoto.

## Efecto previsto por rol

| Rol | Lecturas permitidas por RLS | Mutaciones preparadas | Negativos obligatorios |
|---|---|---|---|
| médico | vínculo propio; entitlements/receipts asignados; envelopes otorgados | solicitar enrolamiento; ninguna operación clínica directa | otro médico/paciente/receipt, actor suspendido y JWT vencido |
| paciente | vínculo propio; entitlement/receipt propio; envelopes propios/otorgados | solicitar enrolamiento | otro paciente, rol cliente adulterado, consentimiento ajeno |
| dispensario | vínculo propio; receipt sólo con grant activo `receipt:read/operate` | solicitar enrolamiento | receipt no otorgado, grant vencido/revocado, acceso clínico |
| admin | cola de actores, estado técnico de entitlements/receipts, auditoría | cambiar estado de actor no-admin con CAS/idempotencia | autoalta admin, versión obsoleta, transición inválida |

El admin no obtiene lectura automática de `encrypted_objects`; el detalle
cifrado requiere propiedad o grant explícito. El QR público sigue fuera de
estas tablas y conserva su DTO mínimo actual.

## Flujo de enrolamiento y consentimiento

1. Auth crea una sesión; por sí sola no otorga rol operativo.
2. El actor solicita uno de los roles no-admin y queda `pending`.
3. Un admin ya aprovisionado por ceremonia controlada revisa evidencia
   sintética y activa/suspende/revoca mediante CAS.
4. Una relación médico-paciente y su consentimiento se representan con
   `patient_entitlements` y `relationship_grants`.
5. Este incremento sólo autoriza sus lecturas. Los comandos durables para crear
   relación, registrar consentimiento y decisión clínica siguen pendientes;
   no debe usarse escritura directa ni presentarse como flujo validado.

## QA antes de solicitar aplicación

```text
npm run test:supabase-migration-security
npm run test:supabase-auth-rbac-migration
npm run test:supabase-auth-rbac
npm run test:supabase-auth-client
npm run test:supabase-roadmap
npm run qa:supabase-readiness
git diff --check
```

La inspección remota literal está versionada en
[`supabase-auth-rbac-readonly-inspection.sql`](./supabase-auth-rbac-readonly-inspection.sql).
Debe ejecutarse dentro de una transacción `READ ONLY`; no es una migración.
El dry-run debe comparar su salida, `list_migrations` y el diff local antes de
autorizar cualquier aplicación.

Después, revisión humana del SQL y dry-run sanitizado contra el mismo proyecto.
La aplicación remota requiere una autorización separada y exacta para esta
única migración.

## Gates pendientes

- decidir método de login sintético, MFA admin y owners de bootstrap/baja;
- crear usuarios exclusivamente sintéticos y una ceremonia de primer admin;
- probar las policies dentro de una transacción con cuatro JWT/roles separados;
- confirmar que `trustleaf_private` permanece fuera de APIs públicas o definir
  una exposición mínima revisada;
- implementar comandos de consentimiento/relación con auditoría y CAS;
- seleccionar KMS, backup/restore, retención e incident response;
- revisión independiente de seguridad, privacidad, legal, clínica y farmacia
  antes de cualquier persona o dato real.

**NO-GO:** datos reales, service key en frontend, roles desde metadata cliente,
fallback Firebase/local silencioso, acceso anónimo, deploy o producción.
