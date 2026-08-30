# Gate — identidad sintética y primer administrador

**Estado:** preparado localmente; no aplicado a Supabase.  
**Alcance:** sólo desarrollo sintético; no habilita usuarios, datos clínicos ni producción.

## Controles preparados

- La migración RBAC existente deja que un sujeto autenticado solicite sólo
  `doctor`, `patient` o `dispensary`, siempre `pending`; `admin` se rechaza.
- La nueva migración
  `20260829110000_trustleaf_synthetic_admin_bootstrap.sql` crea un único admin
  activo sólo a través de una ceremonia directa de operador. No se concede a
  `anon`, `authenticated`, `service_role` ni auditor.
- La ceremonia requiere membresía en el rol `trustleaf_server`, una identidad
  Auth sintética ya creada, digest de idempotencia de 32 bytes, bloqueo global,
  ausencia de admin y ausencia de vínculo previo del sujeto.
- La salida escribe un vínculo técnico y eventos append-only; no recibe perfil,
  email, RUT, evidencia, ficha, receta ni metadatos clínicos.
- La aprobación/suspensión/revocación posterior conserva CAS, idempotencia y
  auditoría mediante `admin_set_actor_state` de la migración RBAC.

## Evidencia local

```text
npm run test:supabase-auth-rbac-migration
npm run test:supabase-auth-rbac
npm run test:supabase-identity-bootstrap
git diff --check
```

Los tests son contrato local/fixtures. No prueban una sesión Supabase remota ni
una ceremonia efectiva hasta que el MCP oficial esté disponible y el gate se
apruebe.

## Gate antes de aplicar en desarrollo

1. Confirmar por MCP, en modo read-only, baseline aplicada y las siete tablas
   con RLS `ENABLE + FORCE`; comprobar que no hay grants/policies inesperados.
2. Revisar y aprobar exactamente las migraciones RBAC y bootstrap, en orden.
3. Definir el operador autorizado y el titular de la cuenta Auth **sintética**
   de primer admin; ambos fuera de código y de esta documentación.
4. Ejecutar la ceremonia desde conexión administrativa directa aprobada, una
   vez, con trazabilidad de cambio; no mediante frontend ni API pública.
5. Verificar con cuatro identidades sintéticas que enrolamiento, aprobación,
   denegación cruzada, suspensión, CAS e idempotencia se comporten como el
   contrato local.

## NO-GO

- No bootstrap si el operador/rol `trustleaf_server` no tiene proceso de
  custodia y baja documentado.
- No cargar datos identificables o clínicos, ni habilitar acciones clínicas,
  receipts mutables o submissions Stellar.
- No activar UI de enrolamiento hasta que Supabase Auth, JWKS, RLS remoto y
  auditoría durable estén verificados con identidades sintéticas.
