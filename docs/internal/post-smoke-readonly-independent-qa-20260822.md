# QA independiente — sprint post-smoke read-only

Fecha: 2026-08-22. Rama auditada: `test/post-smoke-readonly-e2e-20260822` en `1d04520`.

## Veredicto

**NO-GO para arrancar el servidor completo como entorno read-only, habilitar nuevas submissions o avanzar a producción.** Los módulos nuevos aislados tienen evidencia local favorable, pero los endpoints mutantes legacy del servidor no están cerrados por `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` ni por la nueva autorización server-side.

No se efectuó login, acceso a secretos, lectura de datos reales, transacción, fondeo, deploy, push ni escritura de red. La lectura RPC real opcional tampoco se ejecutó.

## Findings priorizados

### P0 — el flag read-only no gobierna los caminos mutantes legacy

`server.ts` conserva rutas POST que llaman funciones de issue, dispense, retain, release, registro/revocación, submit de XDR, passkeys y Defindex. `api/_lib/stellar.ts` conserva múltiples llamadas `prepareTransaction`, `sendTransaction` y `submitTransaction`. Ninguno de esos dos archivos consulta `TRUSTLEAF_TESTNET_SUBMIT_ENABLED`.

Ejemplos de exposición: `/api/stellar/doctor/issue-prescription`, `/api/stellar/dispensary/dispense-prescription`, `/api/stellar/submit`, `/api/stellar/dispensary/retain-prescription`, `/api/stellar/admin/register-doctor` y `/api/defindex/submit`.

Gate requerido: middleware global fail-closed para toda ruta mutante, más tests estáticos y de integración que demuestren `503/403` sin ejecutar builders, signer, RPC o submit cuando el flag no sea exactamente `true`. Para el sprint actual debe permanecer exactamente `false`.

### P0 — auth real no protege las rutas operacionales legacy

La verificación JWKS/issuer/audience/expiry/subject allowlist/role/scope está conectada a `/api/admin/readiness`, pero el escaneo de `server.ts` no encuentra uso del nuevo authorizer en las rutas operacionales anteriores. Varias aceptan identidad declarada en el body (`doctorEmail`, `dispensaryEmail`) o XDR directamente.

Gate requerido: autorización server-side por endpoint y eliminación de identidad confiada desde headers/body. No basta con proteger el panel readiness.

### P1 — E2E por rol todavía no existe sobre endpoints integrados

Hay unit/integration tests útiles para roles y scopes sintéticos, QR público, panel admin y lifecycle local, pero no una matriz E2E integrada médico/paciente/dispensario/admin contra un servidor con auth real y lector RPC/indexer. El QR es el único flujo nuevo conectado a UI/API; no hay detalle read-only autenticado por rol.

Gate requerido: fixtures firmados sintéticos por cada rol, allowlist y scopes, con negativos cruzados y confirmación de cero llamadas a transport mutante.

### P1 — preflight incompleto por dependencia ausente

`npm run preflight` pasó las primeras doce suites hasta `test:admin-auth-readiness` y se detuvo en `test:stellar-rpc-prep`: `ERR_MODULE_NOT_FOUND` para `@stellar/stellar-sdk`. No se instalaron dependencias para evitar modificar el árbol/lockfile sin necesidad. TypeScript y build no llegaron a ejecutarse en ese comando.

### P2 — límites operativos aún locales

El rate limit del QR y el repositorio cifrado/KMS son adaptadores en memoria. Esto valida semántica (CAS, tamper, rotación, auditoría, redacción), no durabilidad, atomicidad multi-instancia, rate limit distribuido ni HSM/KMS real.

## Evidencia verde local

- Contract ID allowlisted exacto: `CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3`.
- QR: token opaco autenticado, tamper/formato inválido uniforme, input inválido sin RPC, timeout fail-closed, headers no-store/no-referrer y proyección mínima.
- Auth/admin: ausencia de bearer, outsider, rol y scope incorrectos, JWKS caído, allowlist/config inválida y rechazo de headers de rol no confiables.
- Datos: ID opaco, AES envelope sin plaintext visible, AAD/tamper, CAS y concurrencia, rotación/rewrap, cadena de auditoría, campos prohibidos anidados, redacción y rate limit.
- Lifecycle sintético local: active/partial/dispensed/revoked/expired, replay idempotente, QR single-use/expiry y proyección pública mínima.
- Suites ejecutadas directamente y verdes: `test:admin-auth-readiness`, `test:readonly-ui-qr`, `test:testnet-e2e-data-qa`, `test:durable-data-controls`, `test:visual-qa-regressions`.
- `.env.example` fija `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false`; no había `.env` local en el worktree durante la auditoría.

## Decisión antes de nuevas submissions

No solicitar autorización de submission todavía. Primero deben cerrarse los dos P0, instalar/verificar dependencias de manera reproducible, completar preflight y E2E integrado por rol, y repetir esta auditoría. La evidencia es exclusivamente técnica y sintética; no acredita validez clínica ni legal.
