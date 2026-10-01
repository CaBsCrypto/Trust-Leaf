# DEM-SEC-01: autorizacion de lectura compartida

Fecha: 2026-10-01. Rama `fix/shared-patient-read-authorization`.
Base: `803937757d39b448279be82951b6300cf1a431b3`, CI main
[36684088051 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36684088051).
GitHub deployment 6754004213 success y Vercel
`dpl_3zGcaUrauuQRSrFe1u9GUdv2JBj6` Ready/alias oficial reconfirmados.

Entrega integrada por [PR56](https://github.com/CaBsCrypto/Trust-Leaf/pull/56):
main `199e1ae7ae6c8a29c807b41138a8e327990e7b09`, arbol identico al candidato
`dfca5ad09a3ad9c67cb454e42bc3c11e2d264bb3`. La evidencia de publicacion siguiente
sustituye el bloqueo temporal del CLI; no cierra la evaluacion humana del piloto.

## Alcance

Migracion incremental `20261001010000_shared_patient_read_authorization.sql`:
el RPC publico conserva firma y acciones. Su implementacion previa se mueve al
schema privado y se revoca para public/anon/authenticated/service_role.
Solo el snapshot de dispensario se intersecta con membresia actual, paciente
activo y vigente, grant y tratamiento vigentes. No se confia en identificadores
de paciente/organizacion enviados por el navegador.

Se retiran tratamiento, grant, perfil y recibos de otras organizaciones cuando
esa autorizacion no existe. Permanecen los recibos propios de la organizacion,
sin que ellos autoricen contactos o tratamiento. Se conservan las politicas
actuales del medico y del paciente y todas las acciones de escritura.
La politica de lectura con medico inactivo sigue separada; no se decide aqui.

## Reproduccion permanente

```powershell
node tests/sql/shared-patient-read.mjs --baseline
node tests/sql/shared-patient-read.mjs
```

PGlite efimero, red bloqueada, identidades UUID sinteticas. Baseline: 14 PASS y
5 fallos esperados (suspended/revoked/expired/valid_until pasado e igualdad).
Candidato: 19/19 PASS. La igualdad usa el reloj de una misma sentencia SQL,
no una espera temporal. Los perfiles y los recibos de un segundo paciente y de
una tercera organizacion permiten detectar un filtro excesivo o insuficiente.

Incluye grants revocados/vencidos, tratamiento revocado y ambos vencimientos,
recibos propios, entrada ajena manipulada, wrapper privado inaccesible,
anon/authenticated denegados y retirada del operador. Los cuatro estados del
medico conservan exactamente la politica baseline. Cada escenario de lectura
compara hashes de todas las tablas privadas, incluidas auditoria e idempotencia;
la lectura no crea, modifica ni elimina registros de negocio.

El runner PostgreSQL independiente incluye cuatro cambios de ciclo del paciente
confirmados en una conexion y leidos desde otra: PASS en CI candidato. Demuestra
retirada despues del commit, no cancelacion de lecturas ya iniciadas. PGlite no
acredita concurrencia entre conexiones. El runner local rehuso la base no vacia;
no se modifico esa base ni se sustituyo este gate por la prueba PGlite.

## Gates y limites

Tipos globales: 0 diagnosticos. Delta de tipos: baseline/current/added 0.
Regresiones locales de operaciones, comercio, equipo, incorporaciones,
dispensary-lifecycle y bloqueo heredado aprobadas. Restaurador de respaldo
sintetico PASS; no equivale a restaurar la base publicada.
Build local PASS (advertencias preexistentes de anotaciones Privy y chunks).
Atenciones PASS: encargado/operador en 360/390/768/1024/1440, Chrome headless con
Playwright del runtime 1.62.1 y respuestas sinteticas locales. Notas medicas PASS:
navegacion, ambos cierres, errores, conflicto, respuesta perdida y retirada de
autorizacion en 320/390/768/1024/1440. Son viewports, no telefono fisico.
Inventario PASS: ambos roles/cinco anchos, descarte, errores, cambio de alcance,
retirada de acceso y respuesta perdida con el mismo identificador. Las escrituras
son respuestas interceptadas y efectos sinteticos; no movimientos publicados.

[CI candidato 36817670803 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36817670803)
incluye PostgreSQL independiente, PostgREST, tipos, builds off/on y regresiones
browser medicas, de inventario, operaciones y comercio. Preview GitHub 6776567177
success; Vercel Ready. El acceso anonimo a `/paciente` en preview responde 302
hacia proteccion Vercel: no se desactivo ni acredita navegacion autenticada.
[Revision tecnica independiente del SHA exacto](https://github.com/CaBsCrypto/Trust-Leaf/pull/56#issuecomment-5925143656)
sin hallazgos bloqueantes; no se presenta como aprobacion humana de GitHub.

## Migracion remota y respaldo

El 401 inicial del CLI se resolvio al renovar el usuario su sesion localmente,
sin compartir credenciales. Se contrastaron las 33 migraciones previas y los
hashes de las cuatro funciones instaladas, normalizando CRLF a LF en `prosrc`.
La comparacion coincide con la base revisada; no se reparo historial remoto.

Procedimiento existente `scripts/backup-operations-application.ps1`: respaldo
`D:\00 CODEX - OPENIA\.backups\trustleaf\application-20261001-020403.dpapi`,
SHA256 `ED3C5F59C932C0C142A20A2367A2F0BD4B3FD19DCC2B249DADCE2CA6C41988FD`.
DPAPI CurrentUser, fuera de Git; 49 tablas/262 filas restauradas en PGlite aislado.
Es respaldo de aplicacion con esquema, datos, relaciones y secuencias, no de
Auth/Storage/Vault ni toda la configuracion de plataforma. No se genero copia
plana en archivos ni se incorporaron datos personales a esta evidencia.

Se aplico exclusivamente `20261001010000_shared_patient_read_authorization.sql`
en una transaccion con bloqueo asesor, comprobaciones de historial/hash y
registro de esa version. Sin `db push`, migracion mensual ni DML de negocio.
SHA256 de la migracion:
`350F4227B20A2D7C9C1B98485291ACA8E9B5B792F4A03AE654D5DCA2545C1353`.
Historial posterior: 34 versiones, ultima 20261001010000, una sola aparicion de
esa version y cero de 20260906120000. PostgREST recibe recarga del esquema.

Hash LF instalado del wrapper publico: `710feb44d641bb3b71ad8d51f57c99bd`.
La implementacion previa conserva `df21cb04ff6bd5d5eb33da10d7da55de` en privado;
las tres funciones privadas anteriores tambien conservan su codigo. ACLs:
anon/authenticated no ejecutan estas funciones; service_role ejecuta solo la
entrada publica y no los cuatro wrappers privados de la cadena. No se alteraron
estados de pacientes en produccion para repetir los negativos: se contrastan
fuente instalada y regresiones aisladas.

## Publicacion y lecturas oficiales

PR56 fusionado 01/10 05:14:28 UTC. GitHub deployment 6776758948 success vincula
199e1ae con `trustleaf-i8swaqweu-cabscryptocontacto-6028s-projects.vercel.app`.
Vercel `dpl_9RJbexLuzTCUxUCgsi7U1BQYF8Hm` Ready y alias trustleaf.org y
www.trustleaf.org contrastados. La asociacion al SHA viene de GitHub.
El [CI de main 36818824045](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36818824045)
PASS: ejecucion independiente del candidato, incluidos PostgreSQL/PostgREST,
builds y todas las regresiones browser. DEM-SEC-01 cerrado y publicado: no solo
aprobacion de pruebas locales. La anotacion de deprecacion de Node 20 en acciones
GitHub preexistentes no es un fallo del producto ni se cambia en esta entrega.

Navegacion oficial del coordinador con la sesion paciente existente: tratamientos
con 30 g asignados, 20 g retirados y 10 g disponibles; tratamiento anterior
revocado separado. Comprobante 3150a49a-a8b2-4e19-a46b-a453adb7c15f de 10 g,
producto ficticio, lote Piloto-B-20260908 y tratamiento 4119236d recuperables.
Actualizar datos mantiene el comprobante, lectura oficial 01/10 02:16 Santiago.
B muestra Autorizar 24 horas, sin grant activo visible; no se pulso esa accion.
Solo lectura y navegacion; no prueba de autonomia, celular fisico ni de operador.

Smoke anonimo: cuatro entradas de actor HTML 200; operations-pilot, agenda,
dispensary-commerce y dispensary-onboarding 401 AUTH_REQUIRED, todas no-store.
Agenda envia solo `no-store`; las otras tres incluyen `private`. GET dashboard
heredado y POST validate-prescription con identificador sintetico: 410
LEGACY_PRIVATE_ROUTE_DISABLED, no-store/private. No prueba autenticada de los
otros actores. La asercion exploratoria inicial exigio `private` tambien a agenda
y fallo; se contrasto el contrato y encabezado real antes de clasificarlo: no
se confirma un fallo de cache ni se cambio el producto para esa diferencia.

No se modificaron B, Browns, permisos, tratamientos, stock, saldo ni comprobantes
publicados. Borrador mensual excluido, SHA256:
`BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8`.
La renovacion B requiere confirmacion especifica del paciente y la comprobacion
final de publicacion. Las invitaciones externas no se envian en este cierre:
privacidad minima, compatibilidad del contacto y acompanamiento siguen como gates
separados. La QA del agente no acredita autonomia, teclado movil real ni
habilitacion clinica/comercial. Politica doctor-active, DEM-LEG-01 y carreras
revocacion/cuarentena/retirada frente a entrega pendientes no se cierran por
aprobar la retirada de lectura post-commit.
