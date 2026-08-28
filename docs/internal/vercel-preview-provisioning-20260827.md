# Preparación Vercel Preview/Development — TrustLeaf

**Estado:** worktree enlazado localmente al proyecto Vercel `trustleaf`; el
repositorio `CaBsCrypto/Trust-Leaf` quedó conectado al proyecto. No se leyeron
valores, no se modificaron variables y no se hizo deploy. Fecha: 2026-08-27.
**Gate:** enlace local confirmado; **NO-GO** para env/deploy hasta revisar scopes y
ceremonia de carga.

## Evidencia del enlace

- La URL y el project ID/nombre del proyecto `trustleaf` coinciden con el destino
  confirmado por el usuario.
- Se ejecutó el enlace local, que creó `.vercel/project.json` (ignorado por Git),
  y la conexión autorizada de `CaBsCrypto/Trust-Leaf` al proyecto Vercel.
- El inventario de deployments muestra sólo releases Production históricos; no
  existe aún Preview de esta candidata.

Conclusión: el worktree y el repositorio están conectados a `trustleaf`. `vercel
env ls` mostró únicamente nombres y scope Production; todos aparecen como
`Encrypted` y no se leyeron valores. No se hizo deploy ni se modificaron
variables. El primer Preview sintético exige una rama remota aprobada y las
validaciones locales completas.

## Inventario read-only de deployments (2026-08-27)

| Superficie | Evidencia | Clasificación |
|---|---|---|
| `trustleaf.org`, `www.trustleaf.org`, `trustleaf.vercel.app` | Alias del deployment Production más reciente; fuente CLI, rama `main`, commit histórico con referencia DeFindex | Producción histórica; no usar como evidencia de la candidata sintética actual. |
| Deployments listados de `trustleaf` | Todos están `Ready`, target `Production`; no se encontró target Preview | Históricos; no ejecutar QA de candidata contra ellos. |
| `design/landing-3d-safe-rescue-20260814` | Rama local de diseño 3D | No publicada en el proyecto Vercel actual. |
| `integration/human-ui-candidate-20260824` | Antecesora de la rama actual | Ya incorporada al historial local; no se debe cherry-pick de nuevo. |
| `feature/trustleaf-key-preflight-20260827` | Worktree actual: UI integrada + paquete local Supabase/Auth/RBAC/custodia | Candidata local; aún sin commit remoto ni URL Preview. |

El código de una landing histórica concreta no puede atribuirse sólo por los
aliases: los deployments publicados disponibles son Production y su metadata
no identifica la rama de diseño 3D. Una vez creada una Preview de la candidata,
esa URL será la única superficie válida para su QA visual.

## Matriz de variables

Sólo se prepara la matriz para `development` y `preview`. `production` queda
fuera del alcance y sin valores. Los nombres no contienen secretos reales.

| Variable | Scope Vercel | Tipo | Responsable | Default/gate |
|---|---|---|---|---|
| `VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED` | Development, Preview | pública/flag | seguridad + frontend | `false`; sólo `true` tras Auth sintético aprobado |
| `VITE_SUPABASE_URL` | Development, Preview | pública | plataforma | URL del proyecto dev elegido; no fijar hasta link humano |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Development, Preview | pública | plataforma | publishable únicamente; nunca `service_role`/`sb_secret` |
| `TRUSTLEAF_AUTH_ISSUER` | Development, Preview | servidor | seguridad/IdP | HTTPS exacto; deny si vacío/mismatch |
| `TRUSTLEAF_AUTH_AUDIENCE` | Development, Preview | servidor | seguridad/IdP | audiencia fija; deny si ausente |
| `TRUSTLEAF_AUTH_JWKS_URL` | Development, Preview | servidor | seguridad/IdP | HTTPS allowlisted; `kid`/alg rotables |
| `TRUSTLEAF_AUTH_JWKS_ALGORITHMS` | Development, Preview | servidor | seguridad | `RS256,ES256` sólo tras PoC |
| `TRUSTLEAF_AUTH_JWKS_CACHE_TTL_SECONDS` | Development, Preview | servidor | seguridad | TTL corto revisado; outage = deny |
| `TRUSTLEAF_DATABASE_URL` | Development, Preview | secreto servidor | plataforma | no frontend; KMS/rotación/TLS pendientes |
| `TRUSTLEAF_KMS_PROVIDER` / `TRUSTLEAF_KMS_KEY_ID` | Development, Preview | referencia servidor | plataforma + privacidad | vacío hasta proveedor aprobado |
| `TRUSTLEAF_KMS_KEY_ALIAS` / `TRUSTLEAF_KMS_KEY_VERSION` | Development, Preview | referencia servidor | custodia | versión fijada; exportación deshabilitada |
| `TRUSTLEAF_KMS_WORKLOAD_IDENTITY` / `TRUSTLEAF_KMS_AUTH_REF` | Development, Preview | referencia servidor | IAM | workload no humano; sin credenciales inline |
| `TRUSTLEAF_KMS_ENABLED` | Development, Preview | flag servidor | seguridad | `false` |
| `TRUSTLEAF_PUBLIC_QR_HMAC_KEY_REF` / `_VERSION` | Development, Preview | referencia servidor | privacidad/QR | sólo KMS; no colocar HMAC en Vercel env |
| `TRUSTLEAF_PUBLIC_QR_SIGNING_ENABLED` | Development, Preview | flag servidor | seguridad | `false` hasta rotación/replay QA |
| `TRUSTLEAF_STELLAR_SIGNER_PROVIDER` | Development, Preview | referencia servidor | custodia | vacío hasta PoC |
| `TRUSTLEAF_SIGNER_PUBLIC_KEY` | Development, Preview | pública/servidor | custodia | comparar por canal restringido; no seed |
| `TRUSTLEAF_STELLAR_*_ALIAS` / `_KEY_VERSION` | Development, Preview | referencia servidor | custodia | una pareja por rol; no alias real aún |
| `STELLAR_*_ADDRESS`, RPC, passphrase, contract IDs, WASM hashes | Development, Preview | configuración | release | allowlist exacta; no identidad humana |
| `TRUSTLEAF_STELLAR_SIGNING_ENABLED` | Development, Preview | flag servidor | seguridad | `false` |
| `TRUSTLEAF_TESTNET_SUBMIT_ENABLED` / `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS` | Development, Preview | flags servidor | release | ambos `false` |

No cargar `STELLAR_*_SECRET`, `STELLAR_RELAYER_API_KEY`, `STELLAR_MERCURY_JWT`,
`STELLAR_MERCURY_KEY`, service keys Supabase ni claves KMS. Si una variable
legacy contiene valor, el preview debe fallar cerrado y abrir incidente.

## Ceremonia segura de carga posterior

1. Usuario confirma el proyecto Vercel exacto y scopes Development/Preview;
   Production sigue excluido.
2. Seguridad confirma proveedor/region KMS, IdP/JWKS, owners y quorum 2-de-3.
3. Se genera cada secreto dentro del proveedor elegido, con exportación
   deshabilitada; el chat no recibe valores.
4. El custodio carga valores directamente en Dashboard/CLI, revisa scope y
   activa auditoría; nadie copia valores al repositorio o frontend.
5. Se valida presencia sólo con `vercel env ls` y un endpoint de readiness que
   devuelva booleanos/códigos, nunca valores.
6. Se mantiene `TRUSTLEAF_*_SIGNING_ENABLED=false` y submissions false; el
   preview sólo prueba Auth/RBAC sintético y lecturas.
7. Rotación/revocación se ensaya en Development, se verifica rollback y se
   destruye el preview antes de cualquier decisión de producción.

## QA automatizado de navegador para el futuro Preview

No se ejecutó porque aún no existe Preview de esta candidata. Cuando exista una
URL de Preview aprobada:

1. Arrancar con fixtures sintéticos y sin login real. Si una ruta exige sesión,
   detenerse y pedir al usuario que inicie sesión; nunca sustituirla.
2. Con el skill Browser, probar desktop y móvil en `/`, `/demo/pilot-flow`,
   `/medico`, `/paciente`, `/dispensario` y `/admin`.
3. Recorrer estados mínimos: admin vacío → médico pending/active → paciente
   sintético → QR mínimo → dispensario parcial/total → auditoría técnica.
4. Verificar negativos visibles: ausencia de bearer, rol cruzado, actor
   suspendido/vencido, QR manipulado/replay, timeout/unknown y transición
   indebida. Confirmar que no se muestran PHI/PII, claves, tokens ni claims de
   validez clínica/legal.
5. Repetir con teclado/foco, `prefers-reduced-motion`, viewport estrecho y
   error de red. Guardar sólo capturas sintéticas y códigos de resultado.
6. Registrar en CI un comando futuro `npm run qa:vercel-preview` que falle si
   falta la URL allowlisted, si `VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED` se activa
   sin Auth aprobado o si los flags Testnet están abiertos.

La prueba de navegador no demuestra cumplimiento legal, persistencia clínica,
validez de receta ni autorización de producción.

## Decisiones humanas pendientes

- decidir si las variables existentes sólo Production deben conservarse aisladas;
- scopes permitidos (Development/Preview; Production prohibido);
- método Auth/IdP único y owners JWKS;
- KMS/HSM, región, workload identities y quorum;
- política de rotación, retención, incidentes y teardown;
- autorización separada para cargar secretos y otra para cualquier deploy.
