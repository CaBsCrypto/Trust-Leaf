# Fase 1 — autenticación y permisos de rutas legacy

Rama: `phase1/legacy-auth-rbac-20260822`. Alcance exclusivamente local y sintético.

## Estado confirmado

- Las rutas existentes bajo `/api/stellar`, `/api/passkeys` y `/api/defindex` se clasifican explícitamente como públicas o protegidas.
- Toda ruta nueva o no reconocida en esos namespaces responde con denegación por defecto antes de alcanzar su handler.
- Las rutas protegidas verifican bearer JWT RS256 contra JWKS HTTPS, issuer, audience, expiración y allowlist server-side de subject→rol.
- Cada ruta protegida exige rol y scope. Los headers que declaran rol no otorgan permisos.
- El principal autorizado queda en `res.locals.authPrincipal`; los handlers no reciben identidad desde headers de rol.
- El middleware de autenticación se ejecuta antes del gate de mutación. Una identidad autorizada todavía encuentra las mutaciones cerradas.
- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false` permanecen como defaults obligatorios.

## Matriz resumida

| Superficie | Roles | Scopes |
|---|---|---|
| emisión/build médico | médico | `receipt:issue` |
| dashboard/constancia legacy | paciente, médico o admin según ruta | `receipt:read` |
| validar/dispensar | dispensario | `receipt:read`, `receipt:dispense` |
| retener/liberar | dispensario | `receipt:retain`, `receipt:release` |
| registro/revocación/verificación operacional | admin | `actor:manage`, `actor:verify` |
| faucet técnico | admin | `testnet:faucet` |
| envío XDR | relayer técnico | `receipt:submit` |
| passkey | paciente | `wallet:read`, `wallet:send` |
| DeFindex legacy | paciente o admin | `finance:read`, `finance:write` |

Las rutas públicas se limitan a health/contracts/readiness y health de passkeys. La verificación QR minimizada nueva conserva su controlador separado.

## Evidencia reproducible

- `npm run test:legacy-route-auth`: matriz completa de rutas, JWT firmado sintético, acceso positivo por rol, ausencia de token, rol cruzado, scope faltante, subject externo, configuración ausente y ruta futura no declarada.
- `npm run test:pilot-safety`: los flags y allowlists de red siguen fail-closed.
- `npm run lint`: TypeScript.
- `npm run preflight`: suite combinada, incluida esta fase.

## Límites y gates pendientes

- Esta fase cierra autorización a nivel de ruta; no crea un directorio durable subject→actor ni autorización por objeto. Antes de nuevas submissions debe vincularse el principal autenticado con la cuenta/receipt concreta y eliminar la identidad operacional confiada desde body (`doctorEmail`, `dispensaryEmail`, direcciones o XDR).
- IdP/JWKS y allowlist reales no están configurados. Sin ellos, las rutas protegidas responden 503.
- No hay sesiones, pacientes ni datos reales; no se validó cumplimiento clínico o legal.
- Los endpoints legacy siguen presentes por compatibilidad, pero ambos gates de mutación permanecen apagados. Esta fase no autoriza Testnet, fondeo, pagos ni producción.
