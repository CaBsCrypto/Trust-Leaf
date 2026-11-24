# Piloto privado con FichaOnChain

Cannabis conserva la receta sintética y su estado clínico. FichaOnChain almacena su referencia, el estado sincronizado y la prueba de integridad de Stellar Testnet. La integración del piloto opera mediante la API privada `/api/v1` de FichaOnChain.

## Configuración aislada

- Usar un Preview de Cannabis y otro de FichaOnChain, una base Supabase exclusiva del piloto y los App ID de Privy de cada portal. Aplicar `20261124011856_ficha_link_pilot.sql` en la base aislada después de las migraciones de identidad. El navegador de Cannabis requiere `VITE_PRIVY_ENABLED=true`, `VITE_PRIVY_APP_ID` y `VITE_PRIVY_CLIENT_ID`.
- Fijar `STELLAR_NETWORK=testnet`, `TRUSTLEAF_FICHA_LINK_MODE=synthetic`, el origen exacto de la API de prueba en `TRUSTLEAF_FICHA_LINK_ORIGIN` y la referencia de la base aislada en `TRUSTLEAF_FICHA_LINK_SUPABASE_REF`. `SUPABASE_URL` debe coincidir con el origen del proyecto. Configurar las credenciales de servidor de Privy y Supabase en el Preview.
- `TRUSTLEAF_FICHA_LINK_SERVICE_TOKEN` es la credencial del socio habilitada por FichaOnChain con los permisos `clinical-links:bind`, `clinical-links:write` y `proofs:verify`. `TRUSTLEAF_FICHA_LINK_ACTOR_KEY` es una clave independiente de 32 bytes en hexadecimal. Mantenerla estable para que el identificador opaco por cuenta permanezca estable.
- Configurar los UUID de actor de un médico y dos pacientes sintéticos activos en `TRUSTLEAF_FICHA_LINK_DOCTOR`, `TRUSTLEAF_FICHA_LINK_PATIENT` (titular P1) y `TRUSTLEAF_FICHA_LINK_CONTROL_PATIENT` (control P2). Usar el UUID de actor de Cannabis que devuelve la sesión privada, sin cruzar IDs de Privy entre portales.
- Activar `TRUSTLEAF_FICHA_LINK_PILOT_ENABLED=true` y `VITE_TRUSTLEAF_FICHA_LINK_PILOT_ENABLED=true` en el Preview. Poner el interruptor de servidor en `false` para detener consultas y mutaciones del piloto, conservando su evidencia.

Los previews protegen el acceso mediante Vercel Authentication. Para conectar los servidores, en `trustleaf-demo` agrega `trustleaf` como Trusted Source con la regla Preview → Preview. Luego fija `TRUSTLEAF_FICHA_LINK_VERCEL_TRUSTED_SOURCE=true` solo en el Preview de Cannabis. `TRUSTLEAF_FICHA_LINK_ORIGIN` debe ser el origen HTTPS `.vercel.app` exacto del Preview de FichaOnChain. Cannabis envía el token OIDC al origen configurado junto con la credencial de la API. Los pacientes siguen ingresando por las sesiones web de cada portal. [Vercel Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)

## Comprobación

1. El titular P1 genera un código en FichaOnChain y lo canjea en `/pilot/ficha` con la sesión de paciente de Cannabis. Copia el código de confirmación a FichaOnChain y confirma. Cannabis muestra el estado vigente con **Consultar vinculación**.
2. El médico sintético entra a `/pilot/ficha` y emite. La aplicación almacena una versión de PDF y un evento con ID estable antes de contactar a FichaOnChain. **Reenviar eventos** repite el envío con los mismos IDs y contenido si la comunicación se interrumpe.
3. La ficha muestra **Ver receta**. El enlace abre `/pilot/recetas/{resourceRef}` en Cannabis, donde la sesión del paciente P1 autoriza la descarga. El servidor recalcula el compromiso de los mismos bytes y consulta la prueba. La cuenta P2 recibe el mismo resultado de recurso no encontrado que con una referencia inexistente.
4. Revocar desde Cannabis cambia su estado clínico, y el siguiente envío sincroniza FichaOnChain. La evidencia de la versión se verifica separadamente. Retirar la vinculación en FichaOnChain cierra la consulta de su prueba; el titular conserva el acceso directo autorizado a su documento en el emisor.

Ejecutar `npm run test:ficha-link-pilot` para probar el flujo con Postgres local en PGlite y un API de FichaOnChain simulado, incluido el PDF alterado. La validación entre portales requiere los dos entornos aislados y el contrato dedicado de Testnet.
