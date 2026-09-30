# DEM-SEC-02: retirada de dos lecturas privadas heredadas

Fecha: 2026-09-30. Rama `fix/legacy-route-authorization`, desde main
`637e17c866ff50d01d7e2176316eb85963534957`.
Estado: DEM-SEC-02 cerrado/publicado por [PR54](https://github.com/CaBsCrypto/Trust-Leaf/pull/54),
main `65aaeb8e703c13e97cc5707dff1ebfb22e4e01a4`. Cierre documental posterior
en `docs/legacy-route-security-closeout`, sin cambios funcionales.
Base: [PR52 integrado](https://github.com/CaBsCrypto/Trust-Leaf/pull/52),
[CI de main 36674600541 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36674600541),
deployment GitHub 6752429450 / Vercel dpl_AdCZKkANoDLQg2aVgNYBsbB3EQj5 Ready,
alias www.trustleaf.org contrastado. No inferir SHA solo de `vercel inspect`.

## Comportamiento y reproduccion

- GET `/api/stellar/patient/:address/dashboard` y POST
  `/api/stellar/dispensary/validate-prescription`: 410,
  `{"code":"LEGACY_PRIVATE_ROUTE_DISABLED"}`. Otros metodos: 405,
  `{"code":"METHOD_NOT_ALLOWED"}`. Ambos con `Cache-Control: no-store, private`.
- Blocker compartido antes de auth, parser e identificadores. No bandera, token,
  rol o selector interno permite recuperar datos desde estas dos lecturas.
- Sin cambios de APIs Supabase, permisos, migraciones o datos. Mutaciones
  heredadas mantienen sus guards; verificadores publicos permanecen separados.
- `npm run test:legacy-private-route-block -- --baseline` obtiene los dos
  exports originales con `git show 637e17c`, sustituye exclusivamente el adaptador
  Stellar por datos ficticios: seis respuestas anonimas 200, flags off/on/production.
  No consulta produccion ni demuestra que hubiera una fuga desplegada.
- Suite actual: 198 casos de los exports reales y 325 HTTP Express. Incluye
  credenciales ausentes/invalidas/declaradas, referencias propias/ajenas/malformadas,
  metodos, HEAD, OPTIONS, cuerpo JSON invalido/grande, selectores falsos, arrays,
  mayusculas y slash final. Cero llamadas al adaptador Stellar y `fetch`.
- Express ejecuta las dos declaraciones `app.all` reales extraidas del AST de
  `server.ts`, con Express real y puerto loopback efimero. Verifica posicion antes
  de parser/auth y cero ejecuciones downstream; no inicia el servidor completo,
  no importa dotenv ni usa credenciales reales. Los controles de rutas ajenas
  prueban passthrough, no equivalen a una prueba integral de esos modulos.
- Calidad repitio independientemente los 198 + 325 casos del candidato final
  `2b6abed7a3faf2d5ab0396fa9f77ca326b62a514`, con wrapper que permite solo loopback:
  cero intentos externos y sin hallazgos que bloqueen la retirada acotada.
  [Revision del SHA exacto](https://github.com/CaBsCrypto/Trust-Leaf/pull/54#issuecomment-5906057743).

## Revisiones y limites

Seis misiones: Seguridad (unico editor del producto), Medico, Paciente,
Dispensario, Admin y Calidad/UX independiente. Los cuatro actores conectados usan
Supabase, no estas dos URLs. Tipos sin diagnosticos; regresiones de autorizacion,
seguridad del piloto, verificacion publica, consolidacion, operaciones SQL e
incorporacion aislada PASS. CI incluye ahora la nueva regresion y guards asociados.
El [CI candidato 36681425847](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36681425847)
PASS incluye tipos, builds off/on, PostgreSQL independiente, PostgREST y browser
de operaciones, notas, inventario y comercio. Preview GitHub 6753556670 success,
Vercel dpl_DxA5edfyCKBjUBcmLLtaEr3bPNWw Ready. Las cuatro rutas de actor devolvieron
302 hacia proteccion Vercel sin sesion; no se desactivo ni aprobo navegacion autenticada.
Coordinador: builds piloto off/on (catalogo/incorporacion on) PASS, con avisos
preexistentes de chunks y anotaciones Privy; tipos 0/0 diagnosticos, Node 22.20.0.
La suite nueva tambien PASS con Node 22.23.2. Comercio API/SQL, agenda, Privy
identidad/RBAC, equipo y lifecycle PASS en aislamiento. No equivalen a sesiones
reales ni a carreras PostgreSQL independientes; esas puertas se contrastan en CI.
Browser local adicional: inventario/atenciones/jornada encargado y operador en
360/390/768/1024/1440 PASS, notas en los anchos de su runner PASS. Node 22.23.2
para inventario; Playwright 1.62.1 con Chrome local, no Chromium 1.58.2 de CI.
No son pruebas de celular fisico/autonomia. Servidores propios 4342/4345 detenidos.

## Publicacion contrastada

PR54 fusionado el 30/09 a las 07:10:55 UTC. Arbol del candidato identico al main
65aaeb8. GitHub deployment 6753696128 success asocia ese SHA a
trustleaf-k8jlfq9yx-cabscryptocontacto-6028s-projects.vercel.app; Vercel
dpl_5Fvrs9YCcXXLvNgFidWiEVX6URD8 Ready y alias www.trustleaf.org contrastados.
[CI de main 36682243915](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36682243915)
PASS: ejecucion distinta, comprobada independientemente del candidato.

Ocho comprobaciones oficiales con identificadores sinteticos: GET dashboard y
POST validation 410; otros metodos POST/GET, HEAD y OPTIONS 405, siempre no-store,
private y solo codigo seguro (HEAD sin cuerpo). Cuatro entradas HTML 200 y cuatro
APIs operativas 401/no-store sin token. No se accedio a datos protegidos ni se
ejecutaron escrituras de negocio. Es evidencia del bloqueo actual, no de la
exposicion anterior ni del uso humano de los cuatro paneles.

El adaptador esta sustituido en el harness: cero llamadas de negocio no significa
ausencia de importaciones SDK en todo `server.ts` o en acciones vecinas. URI cruda
invalida puede devolver 400 de Express antes del blocker, sin ejecutar la lectura.
Los tokens son entradas sinteticas, no sesiones reales validadas.

Pendientes heredados independientes: `MockupPortal` sustituye fallos de validacion
por exito simulado y conserva un dashboard en cache no segmentada por identidad.
No se modifica ni se aprueba esa UI en esta entrega; se registra DEM-LEG-01 para
revision independiente, sin declarar fuga en produccion ni entrega real.

DEM-SEC-01 sigue abierto: pacientes inactivos en proyeccion compartida. Invitaciones
externas y renovacion del permiso B permanecen pausadas. Autonomia humana, teclado
fisico y carreras no cubiertas siguen pendientes. B/Browns/historiales intactos;
borrador mensual excluido, SHA256
`BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8`.
