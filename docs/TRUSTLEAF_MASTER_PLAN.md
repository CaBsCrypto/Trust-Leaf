# Trust Leaf: alcance, narrativa y plan maestro

Fecha de corte: 2026-09-08. Estado: piloto operativo integrado a main; respaldo
restaurado, migracion aplicada y activacion alojada confirmada. Aceptacion
del recorrido completo con usuarios pendiente.
Este documento es el punto de entrada para el nuevo alcance. No certifica
cumplimiento sanitario ni autoriza datos clinicos reales, mainnet o despliegues.

## Tablero vigente: activacion y operacion diaria

Este tablero sustituye la secuencia de expansion del corte de septiembre 6.
Objetivo acordado: operacion diaria simulada, medico independiente, dispensario
de una sede con encargado y operadores, paciente con trazabilidad y admin con
supervision minima mas POV sintetico. Pagos y contabilidad quedan fuera.

| Fase | Implementado / evidencia local | Despliegue y aceptacion |
|---|---|---|
| 0 Consolidar base | PR #22 integrado en `e05644f`, CI main `34211275049` aprobada; respaldo de aplicacion restaurado y respaldo de funciones verificado; 27 migraciones remotas | Piloto y correccion PT409 aplicados individualmente, sin incluir borrador mensual; version oficial READY y sesiones reales confirmadas |
| 1 Activar actores/equipos | Alta/aprobacion/agenda existentes pasan SQL; nuevo consentimiento de piloto, organizacion, encargado/operador y retiro de acceso probados | Login real de cuatro roles; B solicita, admin aprueba y confirma rol activo. Organizacion B y encargado visibles en admin; cinco participantes. Operador independiente pendiente |
| 2 Agenda/consulta | Agenda existente reutilizada; inicio y cierre de consulta persistentes, independientes de abrir Meet | Publicacion, reserva entre cuentas separadas y Meet generado observados el 08-09; cancelacion del nuevo piloto pendiente |
| 3 Atencion/tratamiento | Nota privada versionada, cierre con/sin tratamiento, emision simulada y revocacion | Medico aloja borrador y ambos cierres; paciente confirma tratamiento de 30g/3 periodos y concede/revoca/restaura permiso temporal con recarga. Revocacion del tratamiento pendiente |
| 4 Entregas/stock | Caso 10g A + 20g B y PostgreSQL 17 con conexiones independientes: cuota/stock compartidos, reintento concurrente, respuesta perdida, permisos, cuarentena y vencimiento pasan | A entrega 10g y B 20g desde cuentas separadas; paciente confirma 30g retirados, saldo 0g y dos comprobantes persistentes. Usuario confirma stock B de 80g y formulario bloqueado con cupo agotado; admin observa ambas entregas y auditoria |
| 5 Paneles diarios | Browser + SQL local completa solicitud de cita, consulta, tratamiento, permisos y entregas; captura desktop/movil de 5 identidades, recarga e invalidacion de identidad | Recorrido real parcial de cuatro roles; admin observa dos entregas, dos cierres y auditoria. Recarga y movil administrativos comprobados en el recorrido previo a B; no sustituye todos los escenarios pendientes |

Version integrada: `src/features/operations`, API `/api/operations-pilot`,
migracion `20260909010000_operations_pilot.sql` y correccion de conflictos
`20260909020000_pilot_business_conflicts.sql`. Activacion requiere ambos flags
`TRUSTLEAF_OPERATIONS_PILOT_ENABLED=true` (servidor) y
`VITE_OPERATIONS_PILOT_ENABLED=true` (build); por defecto estan desactivados.
Los participantes deben aceptar datos ficticios. No se crean cuentas Privy ni
roles administrativos automaticamente. El operador necesita rol dispensario
aprobado, participar en el piloto y ser agregado por referencia por un encargado.

Los paneles piloto reemplazan al portal heredado en las cuatro rutas cuando
se activa el flag; no escriben datos clinicos ni inventario en Firebase. No se
ha eliminado globalmente Firebase ni el portal antiguo. La agenda y aprobaciones
siguen utilizando sus RPC existentes; no se construyo una segunda cola.

Evidencia ejecutada en esta entrega:
- `npm run test:operations-pilot`: limites API, identidad, errores y cantidades.
- `npm run test:operations-pilot-sql`: migraciones reales en PGlite aislado.
- `node tests/sql/approval-flow.mjs`: regresion de altas, aprobacion y agenda.
- `node tests/ui/operations-browser.mjs`: cinco POV, reserva, nota, emision,
  dos dispensarios, entregas, persistencia y capturas de 1365px / 390px;
  recuperacion de respuesta perdida sin duplicados e invalidacion ante 403.
- `npm run build`: completo con piloto deshabilitado y habilitado;
  advertencias de dependencias y tamano de bundles.
- `node tests/vercel-function-budget.test.mjs`: 11 funciones efectivas.
- Los 19 errores de tipos heredados quedaron corregidos: direccion Freighter,
  permisos asincronos, callbacks y contratos de custodia/estados. `npm run lint` pasa.
- CI [34191628264](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/34191628264)
  pasa sobre main `2477c44`: tipos, SQL, PostgreSQL 17 independiente, dos builds y browser.
  El ensayo verifica por `pg_stat_activity` que ambas sesiones esperan un lock.
- Restaurador de respaldo validado con datos sinteticos: tablas, funciones,
  registros, FK y secuencias. Esto NO acredita un respaldo real ya realizado.
- [PR #16](https://github.com/CaBsCrypto/Trust-Leaf/pull/16) fusionado tras CI verde.
  Codigo desplegado: `2477c4461c37e9856eafb3dd62ae470de817215c`.
- Smoke anonimo alojado: raiz y cuatro rutas HTTP 200; los cuatro botones de
  Privy quedan habilitados en Chrome sin errores JS. No se inicio ninguna sesion.
  API sin identidad: HTTP 401; con header ficticio: HTTP 503 `PILOT_DISABLED`;
  respuestas privadas sin cache. Esto verifica el bloqueo, no el flujo autenticado.

Pendiente verificable: integracion real del recorrido, recuperacion completa del
servicio, retencion/cifrado de datos clinicos y acceso privado a llamadas. Los datos del
piloto son ficticios; no afirmar que esta capa contiene una ficha clinica apta
para produccion. Detalles reproducibles en [runbook del piloto](operations-pilot-runbook.md).

La migracion mensual `20260906120000_monthly_dispensing_quota.sql` estaba sin
registrar al iniciar el trabajo. Se conserva intacta, no es dependencia del nuevo
piloto y NO debe entrar en un `db push` indiscriminado. Se aplicaron exclusivamente
el piloto y despues su correccion de conflictos revisada; no se repararon ni
modificaron versiones historicas.

Revision remota del 2026-09-08: las 25 versiones previas coincidieron con la
cadena revisada. Supabase informo `backups:null` y `pitr_enabled:false`.
Tras autorizacion explicita se guardo `application-20260908-025819.dpapi` en
`D:\00 CODEX - OPENIA\.backups\trustleaf`, fuera de Git. Windows DPAPI CurrentUser;
SHA256 `DB864E429FA40F67209D38108ABFB9024D66F451857856333EFF23C6F655560E`.
La restauracion aislada en PGlite recupero 18 tablas y 68 registros, con funciones,
columnas, claves foraneas y secuencias verificadas; sin filas en logs ni texto plano
persistente. Alcance de aplicacion, no Auth, Storage, Vault ni recuperacion completa
de Supabase. La clave depende del usuario Windows actual.

Se aplico `20260909010000_operations_pilot.sql` junto con su entrada de historial
en una sola transaccion, previa prueba local del wrapper y rechazo del reintento.
Resultado remoto: 26 versiones, 13 tablas nuevas con RLS forzado, RPC denegada
a anon/authenticated y permitida a service_role. Cero participantes y entregas
al terminar la migracion; el borrador mensual continua excluido.

Activacion confirmada en `dpl_3LBmhuSrU8hrkMm7L5eGD6kJZGEd`, reconstruccion de
main `8431b6e` con ambos flags true y alias `https://www.trustleaf.org`.
Sin sesion la API sigue respondiendo HTTP 401 `AUTH_REQUIRED`, `no-store, private`.
La sesion administradora real carga "Supervision del piloto", el correo de la
cuenta y "Aceptar y participar". Esa primera comprobacion no creo datos clinicos
de prueba desde administracion. El acceso a esta primera pantalla no
acredita los demas POV ni el recorrido completo.

### Matriz de aceptacion alojada al activar

| Escenario | Resultado | Pendiente / defecto |
|---|---|---|
| Respaldo cifrado y restauracion de aplicacion | Aprobado: 18 tablas/68 registros, restauracion aislada | No sustituye recuperacion completa del servicio |
| Migracion unica, historial y permisos SQL | Aprobado: 26 versiones, 13 tablas con RLS forzado | Borrador mensual excluido |
| Bloqueo sin sesion | Aprobado: HTTP 401 y sin cache | Repetir al cambiar flags o autenticacion |
| Sesion administradora y participacion | Aprobado: alta desde interfaz y recarga; nueva sesion Google/Privy confirma cuatro participantes, una entrega, dos consultas finalizadas, organizacion y auditoria minima | Nuevas aprobaciones y equipo de B pendientes |
| Admin desktop/movil y bloqueo de otro rol | Aprobado: sin desbordamiento horizontal a 390px y 1366px; medico, paciente y dispensario deniegan a la cuenta admin | Demas roles y dispositivos con identidades separadas pendientes |
| Medico publica, paciente reserva, Meet y cancelacion | Parcial: horario 09-09 a las 09:00 publicado y reservado por cuentas separadas; enlace Meet generado; persistencia y cita compartida confirmadas | No se probo conexion audiovisual a este nuevo enlace ni cancelacion en esta ejecucion |
| Consulta con/sin tratamiento y permisos del paciente | Parcial: borrador, historial y ambos cierres en medico; paciente ve notas cerradas, tratamiento y saldo; concede/revoca/restaura permiso de 24h, con persistencia | Revocacion del tratamiento y observacion del dispensario durante revocacion pendientes |
| Dispensarios A/B: 10g + 20g y stock conjunto | Entregas alojadas verificadas: A 10g y B 20g, mismo tratamiento/periodo y comprobantes distintos; paciente ve 30g retirados y saldo 0g, incluso tras recarga. Usuario confirma stock B de 80g y bloqueo con saldo agotado; admin observa contador 2 y ambos eventos de entrega | Operador independiente y restantes escenarios negativos alojados pendientes; pruebas concurrentes aisladas no equivalen a una carrera ejecutada en produccion |
| Operador, recarga, cambio de cuenta y movil | Parcial alojado: cambios de cuenta, recargas y dispensario a 390px; su identidad no accede a admin/medico/paciente | Operador independiente y movil de los otros roles pendientes; browser sintetico no sustituye esos POV |

### Validacion del objetivo: primer recorrido administrativo

2026-09-08: se registro la participacion del admin desde el panel oficial y se
comprobo recarga, navegacion Actividad/Organizaciones y POV sinteticos de solo
lectura. Medicion DOM: documento 385px en viewport 390px y 1360px en viewport
1366px; panel sin desbordamiento interno. Las vistas sinteticas no cambian la
identidad. La misma sesion fue rechazada en `/medico`, `/paciente` y
`/dispensario` sin cambiar su rol. Tras cerrar esa sesion desde el acceso medico,
la pestana administrativa volvio al formulario de ingreso sin datos protegidos.

Defectos encontrados: la vista de organizaciones vacias no mostraba un estado
explicito y un rechazo de escritura invalidaba las lecturas posteriores del panel.
El segundo fallo se reprodujo localmente con dos sesiones: stock 100g, ajuste
rechazado -200g y ajuste +10g confirmado en la otra sesion; la primera no mostraba
110g al recuperar foco. La correccion rearma las lecturas despues de cualquier
resultado y separa errores de lectura/escritura para conservar el rechazo visible.
Regresion local pasa, incluida reconexion, replay sin duplicar y estado vacio.
Tambien se neutralizo el encabezado del acceso medico para no afirmar aprobacion
antes de validar el rol. [PR #17](https://github.com/CaBsCrypto/Trust-Leaf/pull/17)
fusionado en `0d4bbe0`, con
[CI de main aprobado](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/34196442528).
Vercel `dpl_G9RDnu2KHQBUh5WywBrSDwHjhnHb` Ready y alias oficial confirmados;
estado vacio y encabezado neutro observados en produccion. Esto no implica aun
validacion alojada de las escrituras medicas o de dispensacion.

### Validacion ampliada: equipo y agenda sincronizada

2026-09-08: se amplio `tests/ui/operations-browser.mjs` con interfaces reales y
SQL aislado, sin modificar manualmente registros para completar los recorridos:

- Cancelacion por paciente reflejada en medico, bloqueo de iniciar una cita
  cancelada y retiro del horario liberado.
- Cierre de otra consulta sin tratamiento; ninguna receta adicional creada.
- Alta de operador por el encargado, persistencia tras recarga, stock propio
  de cada organizacion y rechazo HTTP 403 de un ajuste enviado por el operador.
- Revocacion y nueva autorizacion por el paciente; el tratamiento desaparece
  de la vista del operador mientras no hay permiso.
- Entrega de 10g por operador de A y 20g por B: stock 90g/80g, saldo comun 0g,
  conservacion de la referencia del operador y formulario agotado deshabilitado.
- Retiro del operador desde Equipo: pierde organizacion, privilegios,
  inventario y pacientes anteriores tambien tras recargar.
- Seis POV sinteticos con capturas desktop/movil sin desbordamiento. Se
  inspeccionaron visualmente las capturas de medico y operador en movil.

La ampliacion reprodujo otro defecto: la agenda abierta del paciente no recibia
horarios nuevos al recuperar foco porque el refresco solo atendia Meet pendiente.
`PrivyAgenda` ahora refresca todas las agendas visibles cada 15 segundos y al
recuperar foco, visibilidad o conexion. No es una suscripcion en tiempo real.
Serializa lecturas, invalida resultados anteriores a las escrituras y conserva
errores de escritura separados del refresco. Un 401/403 retira las citas visibles.

Pruebas locales aprobadas: `npm run lint`, `npm run qa:operations-pilot`, recorrido
browser + SQL ampliado, reserva con respuesta perdida, y Calendar con HTTP
simulado para ambos roles. Esta ultima verifica Meet pendiente -> listo,
cancelacion posterior, recuperacion de 503 y limpieza ante 403. Las tres suites
de navegador quedan exigidas por CI. No se llamo a Google desde esas pruebas.

Entrega integrada mediante [PR #18](https://github.com/CaBsCrypto/Trust-Leaf/pull/18),
merge `ce143fdd158674712d2ab22c826808e239d462b5`. CI aprobado en el
[PR](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/34198558967) y en
[main](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/34198953389), incluidos
tipos, PostgreSQL independiente, builds y las tres suites de navegador.
Vercel `dpl_J97S92Xd3htgmpqVYcnnP5DaSAQF` Ready, enlazado a ese commit por el
estado de GitHub y servido por `www.trustleaf.org` y `trustleaf.org`.
Smoke anonimo posterior: `/api/agenda` y `/api/operations-pilot` devuelven 401
`AUTH_REQUIRED` y `no-store` (tambien `private` en operaciones).
Sin migracion nueva ni cambios en flags, cuentas o permisos alojados.
El ingreso medico pendiente en este punto se completo en el recorrido siguiente.
Siguen faltando una segunda organizacion y una cuenta de operador separadas
para el recorrido alojado; ninguna identidad sintetica sustituye esa validacion.

### Aceptacion alojada: agenda y cierres medicos

2026-09-08, aproximadamente 04:39-04:58 America/Santiago: el usuario completo
los ingresos reales de medico y paciente por Privy. Las escrituras siguientes
se realizaron exclusivamente desde `www.trustleaf.org`, con participacion
explicita en el piloto y notas ficticias, sin modificaciones manuales de la base.
No se publican correos, referencias completas ni enlaces de llamadas en Git.

- Medico: participacion, publicacion de un horario el 09-09-2026 09:00-09:30
  y persistencia tras recarga. La automatizacion de fecha/hora no sustituyo
  los valores predeterminados; se comprobo la fecha real y se utilizo ese unico
  horario, sin crear duplicados para ocultar la diferencia.
- Paciente: participacion con otra identidad, reserva del horario anterior,
  confirmacion y enlace Meet generados. Recarga conserva la cuenta y la cita
  aparece en Mi atencion. Antes de emitir, Tratamientos indica que no hay
  tratamientos y no presenta acciones de dispensacion.
- Medico: al regresar con su propia cuenta ve esa misma reserva. Inicia la
  atencion, guarda una nota explicitamente ficticia y recarga: estado En atencion,
  borrador e historial de una version conservados. Finaliza con tratamiento
  simulado: 30g asignados, 0g retirados, 30g disponibles, periodo 1 de 3.
- Caso sin tratamiento: se uso la cita previa de prueba del 07-09 a las 09:00,
  se guardo otra nota ficticia y se finalizo sin emision. La herramienta de clic
  agoto su espera, pero la lectura posterior confirmo guardado; no se repitio
  la escritura. Nueva recarga confirma ambas atenciones finalizadas y un solo
  tratamiento total, con sus controles de emision retirados.
- Capturas del navegador interno muestran el panel paciente sin tratamiento y
  el panel medico con el tratamiento; no acreditan aun todos los tamanos moviles.

Pendiente: volver al paciente para comprobar tratamiento y autorizar una
organizacion; preparar dispensario, equipo y lotes ficticios desde sus paneles;
ejecutar entregas A/B y supervision administrativa. No hay entrega de medicina
real ni uso clinico autorizado por esta prueba.

Continuacion alojada 05:01-05:11: la cuenta dispensario aprobo participacion y
creo desde Equipo `Dispensario A - Piloto ficticio`, quedando como encargado.
Recibio un lote ficticio de 100g, con procedencia de QA y vencimiento 31-12-2026
12:00 Santiago. Recarga conserva organizacion/lote/stock; cuarentena y liberacion
se guardan sin alterar cantidades. Atenciones no muestra pacientes sin permiso.
El historial contiene una recepcion de 100g y ninguna entrega.

Defecto alojado abierto: ajuste de -200g contra stock de 100g produce HTTP 503
en lugar del conflicto recuperable esperado. Un unico reintento desde el boton
existente, con el mismo identificador, repite el fallo. El historial y la recarga
conservan 100g, sin movimiento negativo. Vercel confirma el 503; inspeccion de
solo la definicion SQL confirma `PILOT_STOCK_CONFLICT` con SQLSTATE `40001`.
No se ha aislado aun la causa del 503 ni se da por corregida esta proteccion
alojada. Se prepara diagnostico acotado de accion/HTTP/codigo SQL, sin entradas,
notas, identidades ni mensajes crudos del proveedor. No se aplico migracion.

Continuacion 05:14-05:21: paciente ve las dos atenciones finalizadas, notas
cerradas y el mismo tratamiento de 30g. Autoriza a A durante 24h, revoca desde
su panel y vuelve a autorizar; la vigencia persiste tras recarga. El dispensario
no fue observado durante el intervalo revocado; no dar esa comprobacion por
hecha. Tras otro ingreso real de A, aparece el tratamiento compartido sin las
notas medicas. Se registra una sola entrega simulada de 10g: 10g retirados,
20g disponibles y lote con 90g. Historial muestra un comprobante y movimiento
-10g, ademas de la recepcion inicial +100g. Recarga confirma esos valores.
El usuario confirma que ve el historial de entregas de 10g desde paciente en el
otro dispositivo; no confirma aun el saldo de 20g. Correos distintos para B y
operador siguen pendientes. A las 05:32, la misma identidad del dispensario es
rechazada en admin, medico y paciente, sin recibir acceso a sus paneles.

CI del PR #19 detecto una carrera en la prueba de cierre de sesion de Calendar.
Se cancela la operacion en el commit de identidad y la prueba espera la pantalla
desconectada antes de liberar el token demorado. Cinco repeticiones locales y
TypeScript pasan; esta correccion aun requiere nueva CI y despliegue.

Continuacion 05:37-05:40: PR #19 fusionado en `1390e581`, CI de PR y main
aprobadas. Vercel `dpl_6MK7UjoM8vsMPTVX3HgPPCRbcUJm` listo y asociado al dominio
oficial. Dispensario a 390px: atenciones, inventario e historial sin
desbordamiento horizontal; historial a 1366px tampoco desborda. No equivale a
validacion movil de los otros roles. Tamano temporal del navegador restaurado.

El nuevo diagnostico del ajuste negativo informa `TRANSPORT`, sin respuesta
HTTP de Supabase. Stock y entrega previos se conservan. La causa interna del
gateway no esta confirmada. Se prepara `20260909020000_pilot_business_conflicts`:
solo cambia 15 rechazos explicitos de dos funciones del piloto de `40001` a
`PT409`; conserva cuerpos restantes, permisos y datos. APIs de piloto y agenda
mantienen HTTP 409 con compatibilidad para ambos codigos. SQL local, pruebas
API, tipos y browser con base aislada pasan; falta CI/PostgREST y aplicacion.

Fundamento: `40001` es un fallo de serializacion reintentable, no un rechazo
terminal de negocio. PostgREST documenta [reintentos automaticos antiguos](https://github.com/PostgREST/postgrest/issues/3673)
y [codigos HTTP personalizados PT](https://docs.postgrest.org/en/v12/references/errors.html).
CI agrega PostgREST 12.2.12 aislado para comprobar rechazo rapido, reintento
identico y ledger intacto. No se afirma que esa sea la version alojada.

### Cierre del defecto de ajuste: 08-09, 06:01 America/Santiago

- [PR #20](https://github.com/CaBsCrypto/Trust-Leaf/pull/20) fusionado en
  `4347fb6164dd9c66f83f5ad97b31a8ed9f2a5710`. CI PR `34206691422` y main
  `34207139673` aprobadas: tipos, SQL, conexiones independientes, PostgREST,
  builds con/sin piloto y cuatro suites browser.
- Vercel `dpl_9i3Bf7i1hc33gQAHJFkDr7vn1XBP` READY con alias oficial. API
  compatible publicada antes de la migracion.
- Respaldo DPAPI local de ambas definiciones, fuera de Git, restaurado en SQL
  aislado. Comparacion exacta demuestra solo cambio de codigos y ACLs intactas.
  Este respaldo de funciones no sustituye el respaldo anterior de tablas.
- Aplicada solo `20260909020000_pilot_business_conflicts`, SHA256
  `4707AF485972D9BAE579FD68C7FC225B3E49D7D63AB9019CBBEB025DFBF48B3B`.
  Preflight exige 26 versiones y hashes esperados; postflight confirma 27,
  version nueva y ACLs originales. Sin alteraciones de tablas ni datos del piloto.
- Reintento desde el boton existente conserva la misma operacion fallida:
  Vercel registra HTTP 409 y `PT409`; la pantalla informa conflicto y recupera
  los formularios. No se registra movimiento del ajuste de -200g; stock 90g.
- Desde el panel se registran ajuste ficticio +5g y compensacion -5g, ambos con
  motivo y conservados en historial, sin borrar nada. Stock final 90g; cupo
  del paciente permanece con 10g retirados y 20g disponibles. Recarga confirma.
- Pendiente: segundo dispensario autorizado entrega los 20g restantes,
  operador con cuenta independiente, confirmacion del saldo del paciente,
  supervision de estas operaciones desde admin y restantes pruebas negativas
  alojadas. No se declara cerrado el objetivo completo ni habilitado uso real.

Continuacion de cuarentena y busqueda: desde el dispensario alojado se pone el
lote en cuarentena y desaparece del selector, sin alterar saldo ni cantidades.
Se detecta un defecto de presentacion: el formulario seguia habilitado sin
lotes; una busqueda sin coincidencias tambien informaba incorrectamente que
no habia pacientes autorizados, y en inventario quedaba una lista vacia sin
estado. Lote liberado nuevamente y stock de 90g conservado.

Correccion implementada: deshabilitar entrega sin lotes utilizables, mostrar su
estado y distinguir busqueda sin coincidencias de falta real de registros.
Browser con SQL aislado verifica seleccion invalidada por cuarentena,
bloqueo/restauracion entre encargado y operador, ausencia de entregas y
recorrido completo. No requiere migracion ni cambia API/permisos.

### Cierre de disponibilidad y supervision: 08-09, 06:30 America/Santiago

- [PR #21](https://github.com/CaBsCrypto/Trust-Leaf/pull/21) fusionado en
  `df3ff433d2ac632683378b97e52048049418c255`. CI PR `34208662156` y main
  `34209126178` aprobadas, incluidos PostgreSQL independiente, PostgREST y browser.
- Vercel `dpl_F2dAWMV18D2A4MnFjhEC6RxS1gDN` READY con alias oficial.
  Cuarentena alojada muestra ausencia de lotes utilizables y deshabilita selector,
  cantidad y registro de entrega. Busqueda sin coincidencias muestra su estado
  correcto tanto en Atenciones como en Inventario.
- Lote liberado desde su interfaz al finalizar la prueba: activo, 90g. Atenciones
  conserva 10g retirados y 20g disponibles; historial mantiene un comprobante de
  10g y cuatro movimientos (100g, -10g, +5g, -5g). No se creo otra entrega.
- Intento unico de entregar 21g contra saldo de 20g rechazado con HTTP 409/PT409
  a las 06:19, sin alterar cantidades. Es un rechazo alojado secuencial, no una
  nueva prueba de concurrencia con dos cuentas reales.
- Inicio normal Google/Privy con cuenta admin previamente autenticada, sin
  modificar roles ni introducir tokens manualmente. Supervision muestra cuatro
  participantes, dos consultas finalizadas, una entrega, organizacion A/encargado
  y eventos minimos de auditoria. No muestra el contenido de las notas clinicas.
  POV de prueba identificado como sintetico de solo lectura, sin suplantacion.
- Recarga de admin conserva identidad, contadores y auditoria. Captura movil
  inspeccionada a 390px, documento de 385px sin desbordamiento horizontal; tamano
  del navegador restaurado al terminar.
- Defecto visual detectado: el acceso admin sin sesion mencionaba el documento
  heredado `appAdministrators/{uid}` aunque el ingreso usa Privy y permisos SQL.
  Corregido y verificado posteriormente en PR #22, segun el cierre siguiente.
- Sigue pendiente B/operador con cuentas independientes, saldo confirmado por
  el paciente en su dispositivo, revocaciones/vencimientos alojados y cancelacion
  del nuevo ciclo. Esta evidencia no cierra todo el objetivo ni habilita uso real.

### Acceso administrativo sin texto heredado: 08-09, 06:44 America/Santiago

- [PR #22](https://github.com/CaBsCrypto/Trust-Leaf/pull/22) integrado en
  `e05644fc4bc88307c48a31481b48d329b960f5e5`. CI PR `34210857963` y main
  `34211275049` aprobadas. La prueba de texto existente se amplio y se incorporo
  a CI; no sustituye la comprobacion de autenticacion en navegador.
- Vercel `dpl_2pp9nHyPufkbzTxFypthHusAFj3Y` READY con ambos dominios oficiales.
  Tras salir y recargar, la pantalla Privy muestra "Permisos" y "Permiso
  administrativo requerido en Supabase". No declara privilegios por verificar
  identidad ni muestra el documento de Firebase en este camino de acceso.
- Sin credenciales, directorio admin y API del piloto responden HTTP 401
  `AUTH_REQUIRED`, sin cache y sin actores. Inicio normal Google/Privy posterior
  recupera la cuenta admin y la supervision, con una entrega y dos cierres.
- Alcance: texto y regresion; sin cambios en API, autorizacion, migraciones,
  calendario ni datos. El camino heredado deshabilitado permanece sin refactor.
- Pendiente de intervencion del usuario: correos controlados e ingreso de dos
  identidades nuevas, para encargado de dispensario B y operador. La cuenta de
  admin queda abierta; no se reutilizan identidades de otros roles ni se crean
  accesos ficticios para sustituir la validacion alojada.

### Alta alojada del segundo dispensario: 08-09, 16:13 America/Santiago

- El usuario eligio una nueva cuenta que controla, ingreso por Privy desde otro
  dispositivo y confirmo el envio de datos simulados y el estado pendiente.
- Al actualizar la bandeja administrativa aparecio una unica solicitud de
  dispensario con perfil simulado. El directorio confirmo esa nueva identidad
  con rol dispensario y estado pendiente; las otras cinco cuentas se conservaron.
- Admin pulso Autorizar una sola vez. La interfaz confirmo "Cuenta autorizada"
  y dejo vacia la cola. Actualizar actores confirmo estado Activo y rol Dispensario
  para la misma identidad, sin asignarle permisos administrativos.
- Pendiente: recarga en el dispositivo de B, participacion en el piloto,
  organizacion y lote ficticio propios, permiso del paciente y entrega de 20g.
  Esta aprobacion no acredita aun esos pasos ni la prueba de operador.
- No se modifico manualmente la base ni se emitieron nuevas entregas; los correos
  personales y referencias completas no se incluyen en esta evidencia publica.

Continuacion 16:14-16:26: usuario crea `Dispensario B - pruebas` desde su panel.
Admin confirma organizacion y encargado distintos de A, cinco participantes y
evento `create-organization`. Usuario confirma recepcion de lote ficticio; admin
observa `receive-batch` del actor B a las 16:18. Esta vista de auditoria no permite
certificar por si sola los 100g ni la fecha exacta del lote; comprobarlos en B.

Paciente ingresa por correo/OTP y el panel muestra la identidad correcta,
tratamiento vigente de 30g, 10g retirados y 20g disponibles. B aparece inicialmente
sin permiso. Se concede `Autorizar 24 horas` una sola vez desde Tratamientos;
confirmacion guardada con vigencia hasta el 09-09 a las 16:25 Santiago. Recarga,
entrada al panel y lectura nueva confirman permiso y saldo sin cambios.
Permiso de A permanece intacto. Falta observar desde B el paciente compartido,
verificar lote/stock y registrar los 20g restantes; no hay entrega B acreditada aun.

### Entrega parcial entre A y B: 08-09, 16:34-16:35 America/Santiago

- Usuario registra la entrega desde la cuenta de B en el otro dispositivo y
  comunica saldo 0g. La sesion paciente alojada muestra 30g asignados, 30g retirados
  y 0g disponibles en el primer periodo del mismo tratamiento.
- Historial contiene exactamente dos comprobantes, con identificadores distintos:
  10g de A a las 05:20 y 20g de B a las 16:34. Ambos pertenecen al mismo tratamiento
  y periodo, con organizaciones y lotes diferentes. No se repitio la operacion.
- Recarga del navegador, restauracion de la identidad paciente y nueva entrada
  confirman saldo 0g y ambos registros. Captura del historial inspeccionada;
  son comprobantes dentro del panel, no archivos PDF ni correos de entrega.
- No se confirma aun stock final de B (esperado 80g si su recepcion fue 100g),
  bloqueo de una nueva entrega desde su interfaz, supervisor admin de esta segunda
  entrega ni operador independiente. El caso parcial no cierra todo el piloto.

### Cierre del caso A/B: 08-09, 16:52 America/Santiago

- El usuario confirma desde su dispositivo stock B de 80g y todos los controles
  de nueva entrega bloqueados con saldo agotado. Son comprobaciones humanas del
  panel B, no lecturas directas de inventario realizadas por el agente.
- Nueva sesion administradora real en la URL oficial: contador de entregas 2,
  dos consultas finalizadas y cinco participantes. Auditoria muestra entrega B
  a las 16:34 y entrega A a las 05:20, cada una con actor y referencia distintos;
  tambien aparecen permiso del paciente, recepcion de lote y organizacion B.
- No se crean entregas adicionales ni se ajusta stock durante esta supervision.
  El panel de auditoria inspeccionado muestra metadatos operativos, no fichas.
- Queda cerrado este caso simulado de 10g + 20g, comprobantes, saldo agotado y
  supervision. Falta operador con identidad independiente y los otros escenarios
  de la matriz; no equivale al cierre completo del piloto ni habilita uso real.

### Correccion local: supervision de videollamadas

La prueba aislada `tests/ui/calendar-operations-browser.mjs` reprodujo una
escritura administrativa enviada despues del cierre de sesion mientras esperaba
el token. La correccion cancela esa espera y peticion al cambiar identidad,
invalida lecturas previas a escrituras y refresca al recuperar foco/conexion.
Un 401/403 limpia registros; un fallo transitorio conserva el ultimo listado
pero bloquea comandos hasta recuperar una lectura valida. El error de escritura
no desaparece con un refresco exitoso ni se reenvia automaticamente el comando.
Las filas identifican la reserva y solo un codigo de error operacional seguro,
nunca contenido clinico ni errores crudos de Google. Regresion local aprobada;
se agrega a CI. Tipos, API/SQL aislado y cuatro suites browser pasan localmente;
capturas de Calendar administrativo desktop/movil inspeccionadas. Esta
correccion aun no esta integrada ni desplegada.

## 1. Narrativa de producto

Trust Leaf busca ser el espacio cotidiano de atencion cannabica del paciente
y el panel de trabajo diario de quienes lo atienden. No queremos cuatro demos
separadas: queremos una atencion continua, con estados coherentes, permisos
explicitos y trazabilidad entre los participantes.

Para el paciente: entender su tratamiento, encontrar atencion, reservar,
asistir a su consulta, consultar su receta y saldo, gestionar accesos y dar
seguimiento a sus retiros desde un mismo lugar.

Para el medico: organizar su jornada, publicar disponibilidad, atender,
documentar consultas, emitir recetas privadas y dar seguimiento a sus pacientes.

Para el dispensario: gestionar atenciones, verificar autorizaciones y saldo,
registrar retiros parciales y mantener inventario por lote y procedencia.

Para administracion: coordinar la red, revisar altas, resolver incidentes y
supervisar operaciones sin convertir el rol admin en acceso clinico ilimitado.

La propuesta de valor combina continuidad de atencion, orden operativo y
derivacion de pacientes. La adquisicion comercial no debe adelantarse a la
confiabilidad del recorrido ni a las condiciones legales del servicio.

Recorrido principal:

**Reserva -> atencion -> receta privada -> permiso del paciente -> retiro
parcial -> actualizacion de saldo e inventario -> seguimiento.**

## 2. Base entregada y limites de la evidencia

No comenzamos de cero. La agenda persistente y sus pruebas estan en main:
[PR #12](https://github.com/CaBsCrypto/Trust-Leaf/pull/12), merge
`62b2cdc6c3d7135047b008187f7bfa57685cc7c8`, confirmado en GitHub el 2026-09-06.

| Capacidad | Estado al corte | Limite / siguiente comprobacion |
|---|---|---|
| Privy y roles privados Supabase | Integrados; sesiones reales utilizadas | Estabilizar cambios de cuenta y refrescos |
| Solicitudes, aprobacion y directorio admin | Implementados, con pruebas SQL y recorridos reales parciales | Repetir regresion completa con cuentas separadas |
| Medico publica y paciente reserva | Recorrido real verificado en produccion | Ambos recuperaron la misma reserva tras recargar |
| Agenda y permisos negativos | Pruebas aisladas SQL/browser y controles API | Ampliar concurrencia real entre conexiones PostgreSQL |
| Cupos e inventario | Piloto implementado, pruebas SQL/browser y concurrencia PostgreSQL aprobadas; migracion aplicada | Piloto simulado activo; aceptacion entre actores pendiente; borrador anterior intacto |
| Consulta, receta y retiro integral | Recorrido sintetico local enlazado a Supabase RPC | No confundir identidades ficticias ni datos locales con aceptacion en produccion |
| Stellar | Adaptadores y pruebas Testnet parciales | No acreditan el ciclo clinico completo en cadena |

La reserva real de prueba se dejo confirmada. No repetir mutaciones de prueba
sin identificar y gestionar los registros existentes. Este documento no guarda
correos, tokens, claves ni identificadores de pacientes.

Pendientes de estabilizacion conocidos:

- Una escritura de agenda puede guardarse y el refresco posterior fallar por
  limite de solicitudes de Privy. Separar ambos resultados y evitar reenvios.
- Dos pestanas comparten sesion; puede quedar un encabezado de medico obsoleto
  mientras la identidad activa ya es paciente. El servidor debe seguir denegando
  operaciones ajenas y la UI invalidarse inmediatamente.
- Hay contenido simulado y conexiones heredadas Firebase en recorridos que aun
  no se han migrado. Retirar cada dependencia con su prueba, no globalmente.
- Un build verde o una prueba sintetica no equivalen a aceptacion en produccion.

## 3. Alcance por espacio de trabajo

| Panel | Primera entrega util | Ampliacion posterior |
|---|---|---|
| Paciente | Proxima cita, agenda, acceso a llamada, receta privada vigente, saldo del periodo, retiros y permisos | Recordatorios, seguimiento de tratamiento y continuidad de atencion |
| Medico | Mi jornada, disponibilidad, pacientes vinculados, consulta, receta y pendientes | Seguimiento longitudinal y productividad operativa |
| Dispensario | Atenciones autorizadas, saldo compartido, entrega parcial, lotes, existencias y alertas | Reposicion, reportes operativos y gestion avanzada de proveedores |
| Admin | Aprobaciones, directorio, estados, incidentes y auditoria | Vistas operativas transversales y metricas agregadas |

Diseno: navegacion consistente, correo de la sesion visible, rol y estado claros,
acciones frecuentes accesibles, tablas y filtros para trabajo diario. Contemplar
carga, vacio, pendiente, error recuperable, sesion vencida y acceso denegado.
No mostrar actividad ficticia como real ni confundir autenticacion con aprobacion.

Admin tendra tres capacidades distintas: vista operativa minimizada; vista de
demostracion por rol con datos sinteticos; y soporte sobre cuentas reales solo
con alcance, autorizacion aplicable, caducidad y auditoria. No suplantacion libre.

## 4. Reglas compartidas a construir

### Identidad y permisos

Privy acredita identidad; el servidor y Supabase determinan permisos. Medico y
dispensario requieren aprobacion; paciente no requiere aprobacion profesional.
El cliente no puede asignarse roles. Cada API comprueba actor, estado y recurso.
Las cuentas sinteticas y sus privilegios no habilitan operaciones clinicas reales.

### Consulta y comunicacion

Calendar/Meet ya usa organizador central y trabajos persistentes para crear y
cancelar eventos. El usuario confirmo invitaciones y conexion; no es una
certificacion de privacidad. Las salas abiertas se mantienen SOLO para pruebas
sin informacion clinica real. Abrir Meet no inicia ni finaliza la consulta SQL.
El consentimiento OAuth de Calendar es distinto del ingreso a Privy. Referencia:
[Google Calendar: crear eventos](https://developers.google.com/workspace/calendar/api/guides/create-events).

### Receta, cupo y retiros

- Cantidad por periodo y duracion: 30 g durante tres periodos de 30 dias no
  implica 90 g disponibles al inicio.
- Ejemplo de aceptacion: A entrega 10 g; B consulta el saldo autorizado y puede
  entregar hasta 20 g en ese mismo periodo, nunca otros 30 g.
- Decision del piloto: intervalos consecutivos de 720 horas desde la emision,
  inicio inclusivo y fin exclusivo, almacenados en UTC y mostrados en Santiago.
  Sin arrastre; tres periodos equivalen a 90 dias, no tres meses calendario.
  Vigencia de receta, duracion de tratamiento y cupo son campos separados.
  Esta regla simulada no representa una interpretacion de la normativa chilena.
- Cantidades exactas en enteros de miligramos; alcance inicial de flor.
  No inferir equivalencias de aceites o extractos.
- Receta vencida o agotada conserva historial privado, pero no permite retiros.
  No borrar eventos anteriores cuando comienza otro periodo.
- Acceso de dispensario mediante permiso temporal del paciente: saldo y datos
  de dispensacion necesarios, no toda la ficha clinica ni busqueda libre por email.
- El catalogo de dispensarios para retiro se habilita segun receta vigente y
  elegibilidad; sin receta se muestra el camino de atencion, no una compra activa.
- Entrega, saldo mensual y stock se actualizan atomicamente, con idempotencia,
  control de concurrencia y auditoria. Una doble solicitud no duplica el retiro.

### Inventario y trazabilidad

Registrar lote, producto, procedencia, recepciones, movimientos, vencimiento,
cuarentena y existencias. Bloquear entregas con stock insuficiente o lote no apto.
Correcciones mediante movimientos compensatorios autorizados, nunca borrando
el historial. Los ajustes de stock exigen motivo y version; no restituyen cupo.
El flujo de devolucion clinica/anulacion de entrega queda fuera de este piloto.

### Privacidad y prueba en cadena

Ficha y receta detalladas permanecen privadas, con minimizacion, cifrado,
retencion y accesos auditables. Una wallet o un hash publico pueden permitir
correlaciones: no publicar un historial sanitario individual, aunque no lleve nombre.
Stellar sera una capa verificable minima, separada del detalle clinico; su diseno
debe superar revision de privacidad antes de emitir credenciales vinculables.
Analitica futura agregada; no reutilizacion de historiales para campanas sin
evaluar finalidad y base juridica. La evaluacion legal/sanitaria sigue pendiente.

## 5. Secuencia anterior (historica, sustituida por el tablero vigente)

| Fase | Estado | Entrega y criterio de cierre | Depende de |
|---|---|---|---|
| F0 Base entregada | Agenda cerrada con evidencia; regresion transversal pendiente | Registrar evidencia y conservar baseline reproducible | PR #12 |
| F1 Estabilizacion | Pendiente | Sesion coherente entre pestanas; reintentos seguros; sin mocks operativos; regresion de roles y agenda verde | F0 |
| F2 Cuatro paneles | Planificada | Navegacion diaria y estados completos desktop/movil, conectados a capacidades reales | F1 y contratos compartidos |
| F3 Atencion clinica | Planificada | Reserva, enlace privado, consulta y receta enlazadas; accesos indebidos rechazados | F1, F2, modelo clinico privado |
| F4 Cupo y entrega | Borrador local | Caso 10+20, periodos, vencimiento, revocacion y doble retiro concurrente probados | F3 y decisiones de periodos |
| F5 Inventario | Borrador parcial | Recepcion, lote, cuarentena y entrega descuentan stock/cupo sin inconsistencias | F4; contrato de stock coordinado antes |
| F6 Operacion admin | Planificada | Incidentes, evidencia de aprobacion, soporte acotado y vistas por rol verificadas | Minimo desde F1; ampliacion F3-F5 |
| F7 Piloto integral | No iniciado | Cuatro cuentas completan recorrido, fallos, restauracion y auditoria; gates revisados | F1-F6 |

F4 y F5 forman una sola puerta de activacion para entregas: no habilitar retiros
reales con descuento de cupo pero sin inventario consistente. La verificacion
sanitaria de profesionales y condiciones de operacion se revisan antes del
piloto real; una aprobacion interna no reemplaza a la autoridad competente.

Siguiente gate vigente: aceptar participacion y recorrer los paneles con cuentas
separadas. Respaldo de aplicacion, restauracion y migracion completados;
tipos y concurrencia ya pasan.
El borrador mensual anterior no se despliega con este nuevo piloto.

Inicio tecnico preparado: [backlog y matriz de pruebas F1](session-stability-kickoff.md).
La preparacion de este bloque no significa que los fallos ya esten corregidos.

## 6. Ramas y coordinacion

Flujo propuesto: feature -> PR con pruebas -> staging -> aceptacion entre roles
-> main -> smoke de produccion. Verificar primero el estado real de staging.
Un preview no aisla la base: configurar datos/entorno Supabase de prueba y
dominios Privy autorizados antes de mutaciones de QA.

| Rama propuesta | Responsabilidad |
|---|---|
| feat/session-consistency | F1, sesiones y recuperacion |
| feat/workspace-navigation | Navegacion y componentes comunes |
| feat/patient-care-home | Panel del paciente |
| feat/doctor-consultations | Jornada y atencion medica |
| feat/monthly-dispensing-quota | Cupos, permisos y ledger; rama local existente |
| feat/dispensary-workspace | Panel, inventario y entrega |
| feat/admin-operations | Revision, soporte y auditoria |

Las ramas propuestas no implican trabajo ya ejecutandose. Crear ramas cortas por
entrega, no cuatro divergencias permanentes. Usar worktrees separados cuando
haya trabajo paralelo. Un responsable tecnico coordina migraciones y contratos
API compartidos; revisar conflictos antes de integrar. Componentes por dominio,
sin seguir concentrando todos los flujos en un unico componente gigante.

## 7. Definicion de terminado y seguimiento

Cada PR registra: fase, alcance, responsable asignado, dependencias, migraciones,
pruebas ejecutadas con fecha, resultado, limitaciones, despliegue y reversibilidad.
Estados permitidos: planificado, en desarrollo, validado local, integrado en
staging, desplegado pendiente de aceptacion, cerrado con evidencia, bloqueado.
Actualizar este tablero al cerrar cada bloque; no sustituir evidencia por porcentajes.

Checklist de cierre funcional:

- Pruebas unitarias/SQL/API y browser segun riesgo; pruebas negativas por rol.
- Persistencia tras recarga, aislamiento de usuarios y idempotencia demostrados.
- Concurrencia con conexiones reales cuando se comparten cupo, slot o stock.
- Prueba desktop/movil sin errores de sesion ni contenido ficticio operativo.
- Migraciones revisadas, respaldo y plan de recuperacion; sin secretos en Git.
- Produccion validada aparte del build; dejar registro de lo no probado.
- Para uso real: revision clinica/legal, contratos de proveedores, retencion,
  seguridad, restauracion y respuesta a incidentes aprobados por responsables.

## 8. Decisiones abiertas y fuera del primer alcance

| Decision | Propuesta / condicion |
|---|---|
| Periodos del piloto | Confirmados: 30 dias desde emision y sin arrastre; no regla legal |
| Productos y unidades | Flor en mg inicialmente; otras presentaciones requieren reglas propias |
| Llamadas | Calendar central automatizado; acceso abierto limitado a simulaciones; privacidad real pendiente |
| Admin y soporte | Minimos privilegios; no acceso clinico universal |
| Cuentas de QA | Sinteticas aisladas para automatizacion; login real se prueba aparte |
| Stellar | Testnet y prueba minima; no mainnet ni historial medico publico |

Fuera del primer cierre: pagos, marketplace avanzado, marketing basado en
historiales, conversiones automaticas de productos y analitica comercial avanzada.
La automatizacion Calendar/Meet ya tiene una implementacion separada. No hay fecha fiable de entrega global hasta
medir F1-F3 y resolver dependencias; priorizar cierres pequenos demostrables.

## Referencias y mantenimiento

- [Agenda persistente y evidencia tecnica](privy-persistent-agenda.md).
- [Plan de cierre MVP anterior](mvp-functional-closure-plan.md): conservar como
  corte historico; el estado actualizado de expansion se sigue aqui.
- [Tablero historico de arquitectura](internal/trustleaf-master-delivery-board.md):
  contiene decisiones y restricciones de etapas anteriores, no estado actual.

Este documento registra evidencia; no demuestra por si solo despliegue remoto.
