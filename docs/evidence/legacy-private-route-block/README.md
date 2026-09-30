# DEM-SEC-02: retirada de dos lecturas privadas heredadas

Fecha: 2026-09-30. Rama `fix/legacy-route-authorization`, desde main
`637e17c866ff50d01d7e2176316eb85963534957`.
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
- Calidad ejecuto independientemente 198 + 324 casos antes del ultimo caso de
  cuerpo grande, con wrapper que permite solo loopback: cero intentos externos.
  Sin hallazgos que bloqueen la retirada acotada. El coordinador repite la suite
  final y exige checks sobre el commit candidato antes de integrar.

## Revisiones y limites

Seis misiones: Seguridad (unico editor del producto), Medico, Paciente,
Dispensario, Admin y Calidad/UX independiente. Los cuatro actores conectados usan
Supabase, no estas dos URLs. Tipos sin diagnosticos; regresiones de autorizacion,
seguridad del piloto, verificacion publica, consolidacion, operaciones SQL e
incorporacion aislada PASS. CI incluye ahora la nueva regresion y guards asociados.
CI/preview, integracion y lecturas oficiales se identifican en el PR y tablero;
una prueba local por si sola no cierra la publicacion.
Coordinador: builds piloto off/on (catalogo/incorporacion on) PASS, con avisos
preexistentes de chunks y anotaciones Privy; tipos 0/0 diagnosticos, Node 22.20.0.
La suite nueva tambien PASS con Node 22.23.2. Comercio API/SQL, agenda, Privy
identidad/RBAC, equipo y lifecycle PASS en aislamiento. No equivalen a sesiones
reales ni a carreras PostgreSQL independientes; esas puertas se contrastan en CI.

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
