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

---

## Addendum de remediación — integración `6c45cc6`

Revisión read-only realizada sobre `integration/post-smoke-readonly-20260822` en `6c45cc6`, sin arrancar servidor ni efectuar tráfico de red.

### Remediaciones confirmadas

- **P0 original del flag global: remediado para el servidor Express actual.** El middleware intercepta las rutas POST mutantes Stellar, admin, passkeys y Defindex y exige `assertTestnetMutationEnabled()` antes de alcanzar sus handlers. La política exige conjuntamente `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=true`, `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=true`, runtime `local-synthetic`, Testnet/passphrase/endpoints allowlisted, entorno no productivo y relayer local. Con el valor obligatorio del sprint (`false`) falla cerrado con `503 TESTNET_MUTATIONS_DISABLED`.
- **Defensa en profundidad de bajo nivel confirmada.** Las nueve apariciones de `sendTransaction`/`submitTransaction` en `api/_lib/stellar.ts` tienen un `assertTestnetMutationEnabled()` inmediatamente anterior. El test estático inspecciona cada llamada con `txToSubmit` y la matriz negativa prueba default, producción, mainnet passphrase, RPC/Horizon ajenos, relayer público, runtime incorrecto y submissions deshabilitadas.
- **Montaje del readiness admin confirmado.** `AdminReadinessPanel` sólo recibe `getIdToken` cuando `adminAuth.mode === 'authorized'` y existe `adminAuth.user`; una sesión demo puede ver la ruta admin, pero no monta el panel readiness autenticado. El panel sólo ejecuta GET con bearer real y no ofrece mutaciones.
- Suites focalizadas verdes: `test:pilot-safety`, `test:admin-auth-readiness`, `test:readonly-ui-qr` y `test:durable-data-controls`.

### Riesgos residuales

#### P0 antes de autorizar cualquier nueva submission — RBAC operacional no integrado

El gate ambiental evita writes durante este sprint, pero las rutas de issue, dispense, retain/release, submit XDR y registro/revocación administrativa aún no invocan el nuevo authorizer JWKS/allowlist/role/scope. Si posteriormente se cambian ambos flags a `true`, el gate de entorno por sí solo no autentica al caller; varias rutas siguen aceptando identidad o XDR desde el request.

Gate: integrar autorización server-side por operación y añadir negativos por rol/scope/subject antes de solicitar autorización separada para submissions.

#### P1 — transport RPC reutilizable sin guard propio

`api/_lib/stellar-sdk-rpc-transport.ts` expone `submit()` y llama directamente `server.sendTransaction()` sin el gate ambiental. No se encontró consumidor de producción en esta revisión, por lo que no invalida el cierre del servidor actual, pero es una ruta reutilizable peligrosa si se conecta posteriormente.

Gate: inyectar una capability/policy de submission fail-closed o aplicar el mismo guard en el límite del transport, con test que demuestre cero llamadas al servidor cuando está cerrado.

#### P1 — evidencia del middleware principalmente estática

La suite verifica exhaustivamente la función de política y los guards de bajo nivel, pero no hace una prueba HTTP que recorra cada ruta protegida y confirme que su handler/transport no fue invocado con el flag `false`. Tampoco hay aún E2E autenticado médico/paciente/dispensario/admin.

### Veredicto actualizado

**GO limitado para continuar desarrollo y pruebas locales read-only con `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false`. NO-GO para cambiar el flag a `true`, nuevas submissions o producción** hasta cerrar el P0 de autorización operacional y repetir preflight/E2E integrado.
