# Auth real y admin minimo read-only

## Implementado y probado

- Verificacion JWT RS256 contra JWKS HTTPS, con `kid`, cache corta, timeout y rechazo de algoritmos distintos.
- Validacion server-side de `iss`, `aud`, `exp`, `sub`, roles y scopes.
- Allowlist server-only por subject/UID. Los headers de rol se ignoran.
- `GET /api/admin/readiness` requiere rol `admin` y scope `admin:readiness:read`; devuelve solo flags sanitizados.
- `AdminReadinessPanel` consume exclusivamente ese GET, falla cerrado y no expone controles de escritura. Queda listo para montarse cuando el login/IdP sea aprovisionado.
- La respuesta declara `submissionEnabled: false` y `mutationsAvailable: false`. No existe accion de escritura en este panel.
- Fixtures criptograficos sinteticos cubren autorizado, sin token, subject no permitido, IdP/JWKS caido y allowlist ausente/invalida.

## Requiere aprovisionamiento y revision humana

- Elegir/configurar el IdP real y su issuer, audience y URL JWKS.
- Crear usuarios reales fuera del codigo y aprobar explicitamente los UID/subjects en el secreto server-side de allowlist. La coleccion Firebase `appAdministrators/{uid}` puede seguir como fuente administrativa, pero no reemplaza la autorizacion del backend hasta implementar sincronizacion autenticada y auditada.
- Definir entrega/rotacion del allowlist (secret manager), revocacion, break-glass y auditoria de accesos.
- Conectar el cliente Firebase al endpoint usando `getIdToken()` despues de completar el aprovisionamiento. No se implemento login real en este sprint.
- Revisar CSP, CSRF/same-site, rate limits distribuidos y monitoreo antes de cualquier despliegue.

## Gates

- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` permanece obligatorio.
- No habilitar mutaciones Testnet por obtener readiness verde.
- No usar datos de pacientes, recetas o credenciales reales en pruebas.
