# Relieve Vivo en TrustLeaf Cannabis

Rama de revisión `redesign/cannabis-relieve-vivo`. La base es `61d24ecd91a245c464a25b20e3f19e72bd8057fd`, con `qr-cold-load-fix.patch` y `visual-refresh-local.patch` de `cannabis-qr-release-20261021`. La referencia de producción para la comparación es `dpl_HfoqHjurhnsp6t7T3xQNj3HaJxsd` en `cannabis.trustleaf.org`.

El [mapa de la interfaz](TRUSTLEAF_UI_MAP.md) enumera la landing, los portales, las vistas técnicas y las opciones de cada perfil.

## Abrir la revisión local

Desde la raíz del checkout con Node.js 22:

```powershell
npm ci
npm ci --prefix tests/sql --ignore-scripts
npm ci --prefix tests/ui
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5195 --strictPort
```

Abre `http://127.0.0.1:5195/` para revisar la portada, el menú, la ficha clínica y la receta ilustrativas, y los accesos por perfil.

Para revisar el bloque público de trazabilidad y probar ambas listas de espera, abre el modo local de la portada:

```powershell
node node_modules/vite/bin/vite.js --config vite.visual.config.ts --mode waitlist-local
```

Usa `http://127.0.0.1:5210/#trazabilidad`, `http://127.0.0.1:5210/#lista-de-espera-paciente` o `http://127.0.0.1:5210/#lista-de-espera-dispensario`. `/api/cannabis-waitlist` guarda el correo normalizado, el perfil y la fecha en la base local privada `scratch/cannabis-waitlists/local`. Los registros se conservan al reiniciar. Para otra instancia de prueba usa `TRUSTLEAF_LOCAL_WAITLIST_INSTANCE` con un nombre de hasta 64 caracteres en minúsculas, números o guiones. Usa exclusivamente correos ficticios en este entorno.

La captura publicada está preparada para el mismo endpoint en Cannabis. La migración `20261122020000_cannabis_waitlist.sql` crea el almacenamiento privado en Supabase. Las variables `TRUSTLEAF_CANNABIS_WAITLIST_ENABLED` y `VITE_CANNABIS_WAITLIST_ENABLED` se activan solo al preparar la publicación de Cannabis con su base migrada.

En otra terminal, inicia los perfiles con `npm run demo:local -- 5207`. Abre la URL completa que imprime el servidor tras `LOCAL_DEMO_READY`, incluido el fragmento temporal. La capacidad se genera al iniciar el servidor y se retira de la barra al entrar. Usa el selector de actores y el buzón local para las invitaciones de encargado y operador. El [recorrido del piloto local](../tests/local-demo/README.md) detalla los pasos. Los datos son sintéticos y se conservan al recargar mientras el servidor siga abierto.

## Reproducir las comprobaciones

```powershell
npm run test:critical-static
npm run test:public-verification
node tests/public-verification-cold-load.test.mjs
npm run test:local-demo
node tests/local-demo/public-build.test.mjs
```

Las pruebas de esta revisión usaron Playwright 1.56.1 y Chrome. Si Playwright está fuera del checkout, indica su ruta en `PLAYWRIGHT_MODULE`. Para Edge, configura `PLAYWRIGHT_CHANNEL=msedge`. Ejecuta estos comandos con la portada local abierta.

```powershell
$env:RELIEVE_TEST_URL = 'http://127.0.0.1:5195'
node tests/ui/relieve-landing-browser.mjs
node tests/local-demo/run-journey.mjs
```

El primero revisa la portada a 320, 390, 768, 1024 y 1440 px, comprueba las entradas de los cuatro portales y las vistas técnicas, verifica los cuatro estados de QR por enlace directo, recarga y otra pestaña, y guarda capturas en `scratch/redesign-qa/`. El segundo inicia y cierra su propio servidor. Comprueba la navegación con teclado en paciente, médico e incorporaciones administrativas, y guarda el recorrido y las capturas en `scratch/local-demo/journey/`. El informe de límites de sesión queda en `scratch/local-demo/boundaries-report.json`.

Con la portada abierta en el puerto 5210, ejecuta la misma prueba de navegador con `RELIEVE_TEST_URL=http://127.0.0.1:5210` y `RELIEVE_TEST_WAITLIST=1` para verificar las dos inscripciones con un correo ficticio.

`node tests/sql/cannabis-waitlist-persistence.mjs` comprueba que los datos sobrevivan a un reinicio en un servidor aislado y que la base permanezca fuera de las rutas públicas.

Pasaron TypeScript, el build y la comprobación de que la compilación pública excluye la demo local. En Chrome, la portada, los cuatro accesos, las cuatro vistas técnicas y los cuatro estados del QR pasaron sobre el build final sin errores JavaScript. El recorrido SQL pasó sus 17 etapas con cinco identidades, 16 capturas y cero solicitudes externas. Pasó también la comprobación de que un reinicio retira los datos abiertos en otra pestaña y descarta las respuestas de la sesión anterior.

La demo administrativa cubre invitaciones e incorporación. El panel completo de administración y el escritorio médico con sesión real requieren una cuenta autorizada de Privy en un origen permitido. Queda pendiente esa prueba con recarga y segunda pestaña, y la revisión en un celular físico.

## Publicación y reversión

La revisión se comparte primero en local o en un preview protegido. Tras la aprobación, registra el destino activo de `cannabis.trustleaf.org`, prepara la compilación con `--skip-domain` y asigna solo ese alias al candidato. Verifica accesos por rol, recarga de enlaces y QR de demostración, incluidas las cabeceras de privacidad del verificador. Si hay que revertir, reasigna únicamente el alias Cannabis al despliegue que servía justo antes de publicar.
