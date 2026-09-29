# Sprint S1: cerrar la experiencia publicada del dispensario

Actualizado: 2026-09-29. Sprint de una semana de referencia, sin fecha final
comprometida hasta disponer de ambos participantes. Sin ejecucion automatica.
Fuente de estado: este tablero, enlazado desde el plan maestro y mapa de producto.

## Objetivo, responsables y reglas

### Sprint de proteccion de borradores: 27/09

Base de trabajo: `a9ddc67` (PR48). Rama inicial `fix/medical-note-guard`.
Coordinador integra; cuatro agentes revisan flujo medico, inventario, UX y calidad.
Una correccion funcional en curso; inventario se integra despues de medicina.
Pruebas sinteticas aisladas, sin escrituras de negocio publicadas.

| Trabajo | Estado | Evidencia / siguiente accion |
| --- | --- | --- |
| AUD-03 nota medica | Publicado | PR49 integrado en ab2f4b3; CI 36365590291 PASS, deployment 6700540461 success. Regresion aislada repetida: diez casos PASS |
| AUD-04 formularios de inventario | Publicado | PR50 a3656eb; candidato 4f37b1f, CI 36633030614 y preview PASS. Deployment 6745997363 success y alias oficial contrastado. Diez combinaciones rol/ancho y suites compartidas aprobadas |
| UX y calidad | Revision tecnica aprobada | Cuatro agentes, hallazgos y regresiones consolidados; conservar pruebas humanas pendientes |
| Admin oficial | Comprobado tecnicamente | Sesion Admin: invitacion aceptada, solicitud Browns aprobada y organizacion visibles; recarga conserva acceso. Sin envios ni decisiones nuevas |

La lectura de Admin anterior sustituye el pendiente historico de sesion de la
auditoria de abajo. No acredita autonomia humana ni incorporacion del primer cliente.
Detalle de reproduccion y gates: [Proteccion de notas](MEDICAL_NOTE_GUARD.md).
Inventario y matriz actual por actor: [Proteccion de inventario](INVENTORY_DRAFT_GUARD.md).

### Auditoria coordinada con cuatro agentes: 27/09

Base: `2e014430455cffe2c3a8cfef01c1182a2540bb6f` (PR44 integrado).
CI main `36307001486` success. GitHub deployment `6690086452` asocia ese SHA a
`trustleaf-o253jym0p-cabscryptocontacto-6028s-projects.vercel.app`; misma URL que
Vercel `dpl_9a9Ue1ApQMYKUYBSyUUTBQyqFEfL`, production Ready y alias oficial.
Solo documentacion cambio desde el baseline funcional `668d84f` hasta esa base.

Primera ronda: cuatro agentes independientes, solo lectura y pruebas sinteticas.
Coordinador: version, lecturas Browns, consolidacion y revision de resultados.
No se enviaron invitaciones ni se modificaron permisos o registros publicados.
No se afirma preparacion clinica, legal ni operacion autonoma.

#### Matriz unica de decision

Actualizacion de cierre tecnico: PR45 documental integrado (`0fe2758`).
AUD-01 corregido por PR46 (`7ccb908`), CI PR `36308719527` PASS.
Deployment GitHub `6690456559` success y Vercel `dpl_4FZRiVYqXBrE7VNA4kcYwTte7dm3`
Ready, URL `trustleaf-fjdloa0a9-cabscryptocontacto-6028s-projects.vercel.app`,
alias oficial comprobado. AUD-02 corregido por PR47 (`9291f2e`), CI PR
`36309391166` PASS y preview aprobado. Deployment `6690567724` success,
Vercel `dpl_Hf7waVNxgfC1UjgMS57gAHucdvet` Ready y alias oficial coinciden con
`trustleaf-9d2qgh6oj-cabscryptocontacto-6028s-projects.vercel.app`.
No interpretar los hallazgos historicos de abajo como correcciones pendientes
de codigo para AUD-01/02. No hay cambios de APIs, migraciones o datos publicados.

| Area / responsable | Evidencia actual | Resultado / limite | Siguiente accion |
| --- | --- | --- | --- |
| Incorporacion / Hume + coordinador | API 5/5, invitaciones 12/12, SQL, 15 pruebas de captura y navegador 390/1440 PASS; lectura Admin posterior comprobada | AUD-01 corregido y publicado por PR46 | Esperar destinatario y acompanar primera incorporacion |
| Medico-paciente / Pasteur | Operaciones 8/8, agenda 6/6 y SQL sintetico PASS | AUD-03 nota sin guardar; evidencia alojada anterior reutilizada, no sesion medica hoy | Reproduccion y correccion acotada; no prometer recorrido clinico cerrado |
| Dispensario / Locke + coordinador | AUD-02 reproducido en navegador antes del fix; ambos roles/cinco anchos PASS despues; CI PR47 PASS | Correccion publicada y alias contrastado. AUD-04 estatico | Mantener pendientes humanos separados |
| Calidad / McClintock | SHA/CI oficial comprobados, PostgreSQL independiente y PostgREST aprobados | Carreras revocacion/cuarentena vs entrega no cubiertas de forma independiente | Backlog de pruebas aisladas; no afirmar fallo sin reproduccion |
| Browns / coordinador | Lectura 27/09 05:52-05:53: encargado, lote 100 g, proveedor vacio sin error, formulario abierto/cerrado sin guardar | Persistencia y lectura comprobadas; ninguna escritura en esta auditoria | Mantener ensayo separado de B |
| Humano movil / PO | Recepcion 100 g encontrada en telefono fisico con indicaciones | Guiado parcial, no autonomia ni teclado completo | Evaluar tareas sin instrucciones y registrar dispositivo |
| Admin publicado / coordinador + PO | Sesion Admin, invitacion aceptada, solicitud Browns aprobada y organizacion; recarga conserva acceso | Comprobacion tecnica de lectura, sin nueva invitacion ni decision | Verificar destinatario antes de la incorporacion externa |
| Primer/segundo equipo / PO | No hay contactos suministrados | Pendiente, no defecto | Primero un encargado; segundo despues de observar su incorporacion |

#### Hallazgos y entregas separadas

- AUD-01 / P2 / entrada de encargado: `src/features/operations/team-api.ts:29`
  recupera invitacion de trabajador guardada y `src/App.tsx:657` la prioriza
  frente al enlace nuevo de encargado. Reproducido con funciones reales y
  almacenamiento sintetico, no navegador publicado. Mitigacion de ensayo:
  salir de invitacion anterior y reabrir enlace; no es correccion definitiva.
  Rama propuesta `fix/onboarding-invitation-entry`, prioridad primera.
- AUD-02 / P2 / borrador de entrega: `DispensaryAttention.tsx:67,83` no espera
  `mayLeave()`. Manejador de tratamiento reproducido con promesa pendiente y
  luego false: cambia seleccion antes de decidir. Paciente comparte patron
  por inspeccion; UI extremo a extremo pendiente. No evidencia de entrega
  involuntaria ni stock corrupto. Rama propuesta `fix/dispensary-draft-guard`.
- AUD-03 / P2 / borrador medico: `OperationsWorkspace.tsx:249` separa guardar
  nota y finalizar; cierre no envia texto sin guardar. Hallazgo de fuente,
  reproduccion navegador aislado pendiente: el agente termino por limite de uso,
  sin resultado de esa comprobacion. No se considera defecto UI reproducido.
  Antes de ensayo: guardar y
  verificar borrador antes de cerrar. Rama propuesta `fix/medical-note-guard`.
- AUD-04 / P2 / borrador de inventario: `OperationsWorkspace.tsx:287,370`
  formularios no registran dirty para guardia de navegacion. Hallazgo estatico
  pendiente de reproduccion, no defecto de persistencia guardada confirmado.
  Rama propuesta, solo tras reproducir: `fix/inventory-draft-guard`.

Decision inicial de la ronda, anterior a PR46/47: LISTO CON LIMITACIONES para presentacion y ensayo
acompanados, NO aprobacion incondicional para incorporar externamente. Antes
del envio externo: cerrar AUD-01, verificar sesion Admin y destinatario.
Decision especifica de incorporacion externa: BLOQUEADA hasta completar esas
tres condiciones. Responsable tecnico: coordinador para AUD-01 y lectura Admin;
Product Owner para iniciar sesion y confirmar destinatario. No se enviara correo
como parte de esta auditoria.
AUD-02/03 excluyen declarar jornada completa validada; requieren regresiones y
correcciones propias. Ningun critico de aislamiento o escalamiento demostrado.
No confundir ausencia de hallazgo con garantia de seguridad completa.
Correcciones no se incluyen en este PR documental; una rama funcional a la vez,
tipos/build/regresion/CI/preview antes de integrar y revalidar.

#### Decision historica de auditoria (27/09)

Este bloque conserva la decision previa a las reproducciones y PR49/50.
El estado vigente de AUD-03/04 y Admin es el tablero de proteccion de borradores
al inicio; no leer los pendientes historicos siguientes como defectos actuales.

LISTO CON LIMITACIONES para presentar el nucleo y preparar incorporacion
acompanada con datos ficticios. El envio externo queda retenido hasta comprobar
Admin autenticado y destinatario compatible. Version oficial de PR47 comprobada.
Responsable tecnico: coordinador; inicio de sesion y destinatario: Product Owner.
No se enviaron invitaciones durante la auditoria.

AUD-03 y AUD-04 permanecen como hallazgos de fuente pendientes de reproduccion;
no afirmar perdida de datos guardados. En cualquier ensayo medico, guardar y
verificar nota antes de finalizar. No ofrecer recorrido clinico completo como
validado. Pruebas humanas de autonomia, teclado movil y carreras concurrentes
faltantes continuan abiertas. No hay defecto critico confirmado de aislamiento.

Evidencia detallada: [AUD-01](INVITATION_ENTRY_FIX.md) y
[AUD-02](DISPENSARY_DRAFT_GUARD_FIX.md). Brownsonchain sigue como encargado de
Browns en lectura 27/09 06:27, 100 g visibles. No se cambio la sesion a Admin.

### Estado vigente: 27/09, Browns preparado

P-01 cerrado para el ensayo propio: Browns/Encargado comprobados tras ingreso
y recarga. P-02 en Validacion: producto DEMO-BRW-001, lote BRW-DEMO-001, una
recepcion y movimiento de 100 g persistentes, sin entrega. El usuario confirmo
en celular fisico que encontro el movimiento de 100 g tras indicaciones del
agente: evidencia guiada parcial de J05/J06, no autonomia ni todos los casos U2.
No se conoce modelo de telefono/navegador; no inferirlos del viewport interno.
Se reutiliza evidencia de B, sin exigir cuentas nuevas para este bloque.
Pendientes: autonomia, resto de escenarios en dispositivo real, Admin actual
y correos de los dos encargados externos. S1 no cerrado.
Detalle del ensayo: [Browns](BROWNS_DEMO_READINESS.md). La matriz vigente se mantiene
en este tablero. Las entradas fechadas de abajo
son historicas, no el estado actual de acceso de Browns.

### Evidencia historica: 26/09, preparacion de presentacion

Esta entrada sustituye los bloqueos historicos de navegacion indicados abajo.
El usuario navego manualmente por Inventario, Historial y Gestion/Equipo como
operador de B; el agente contrasto las pantallas. NAV-01 no es un defecto del
producto confirmado ni una correccion publicada: causa del control automatizado
sin determinar. Los clics de cierre de sesion tampoco cambiaron la vista en esta
sesion; se solicito accion manual, sin declarar al usuario desconectado.

- Inventario: lote Piloto-B-20260908, 60 g disponibles. Historial por lote conserva
  filtro; entregas de 20 g, 10 g y 10 g, movimientos +100/-20/-10/-10 g.
- Comprobante existente 3150a49a-a8b2-4e19-a46b-a453adb7c15f recuperado, sin entrega.
- Alternar movimientos y limpiar filtros funciono manualmente. No se atribuye
  cobertura completa a todas las combinaciones de busqueda y fecha.
- Operador: Catalogo/Recepciones consultables, sin Proveedores ni creacion;
  Equipo muestra encargado y operador sin controles de administracion.
- Recarga conserva identidad y membresia, vuelve a Pacientes. El usuario necesito
  indicaciones para volver a Gestion: oportunidad de continuidad, no autonomia.
- A las 02:36 Chile, operador de B y cero pacientes con permiso vigente. No se
  renovo permiso ni se releyo stock en esa comprobacion.

U1-U4 siguen pendientes de autonomia y celular real. J05/J06/J07 tienen evidencia
guiada parcial del operador, no aprobacion de uso independiente ni prueba de
escrituras denegadas. B no recibio entregas, ajustes ni cambios de equipo.

Decision del usuario: Browns es ensayo propio, no el primer dispensario externo.
P-01 pasa a En curso: verificar su encargado con una sesion real. P-02 preparado
como guion en [Browns: ensayo y presentacion](BROWNS_DEMO_READINESS.md); ejecucion
depende de P-01, cuentas separadas, datos y prueba fisica. No se cierra S1.

PR #40 fusionado como 58d1dd3 tras verify/Vercel aprobados en 43581f7. Solo docs.

### Estado del cierre: 26/09, 01:10 Chile

Operador autenticado de B confirmado tras recarga; panel muestra un paciente con
10 g disponibles y permiso vigente en ese momento. No se renovo el permiso.
No se comprobó stock de nuevo en esta sesion: 60 g sigue siendo evidencia del 25/09.

NAV-01 (fallo de flujo observado, causa pendiente): al pulsar Inventario,
Historial o Gestion desde Pacientes, permanece Pacientes seleccionado. Repetido
tras recargar y con locator semantico del navegador. No hay error visible ni
errores de consola capturados. No se ha demostrado si es fallo de aplicacion,
sesion o automatizacion; se solicito contraste manual al usuario antes de
proponer un cambio funcional. Responsable: facilitador tecnico. J05/J06/J08
del operador permanecen pendientes; no inferir denegacion del servidor.

Evidencia adicional del 25/09, operador: revision de 10 g sin confirmar, volver
con lote/cantidad conservados, cancelar descarte manteniendo preparacion y foco,
descartar y regresar al listado con 10 g disponibles. Inventario mostraba 60 g
sin controles de recepcion/ajuste. Estas observaciones no sustituyen permisos
directos ni autonomia humana. No se realizaron nuevas entregas.

Cierre NO aprobado. Pendientes: contraste NAV-01, filtros/historial/Gestion del
operador, celular real, autonomia y acceso de Browns. No ampliar el alcance ni
forzar datos para completar casos. Si se reproduce un defecto de codigo,
correccion separada con regresion, CI y preview antes de publicar.

### Evidencia incremental: 25/09, 02:09 Chile

Comprobacion del agente en navegador interno sobre version publicada d101469;
no acredita autonomia humana ni telefono fisico. Sustituye el bloqueo inicial B1
solo para encargado. Operador y evaluaciones U1-U4 permanecen pendientes.

- Encargado B autenticado; Jornada confirma 60 g, dos miembros y un paciente
  autorizado. Tras recarga conserva organizacion/rol, valores y cero entregas hoy.
- Paciente: tratamiento de prueba 4119236d con 30 g asignados, 20 g retirados y
  10 g disponibles. Con confirmacion explicita del usuario se concedio permiso
  a B hasta 26/09 02:02 Chile. No se modificaron tratamiento, saldo o stock.
- Atenciones: seleccion explicita y revision de 10 g desde Piloto-B-20260908;
  saldo hipotetico 0 g, SIN confirmar entrega. Luego se observo listado limpio.
- Busqueda por referencia, apertura y retorno conservan texto y foco en paciente.
- Inventario -> historial aplica filtro de lote y muestra comprobante existente
  3150a49a-a8b2-4e19-a46b-a453adb7c15f de 10 g. Responsable se muestra por UUID:
  oportunidad de legibilidad, sin afirmar identidad nominal desde esa referencia.
- Gestion: Catalogo y Proveedores terminan carga con pagina vacia, no error;
  formularios no abiertos. Equipo muestra un encargado y un operador, dos
  invitaciones aceptadas historicas no equivalen a dos membresias activas.
- No se enviaron invitaciones, retiraron miembros ni guardaron operaciones.
  Descarte/cancelacion de preparacion fue guiado al usuario: falta evidencia
  detallada para dar por aprobados todos los pasos J04.
- Pendiente: filtros combinados/movimientos J06, operador, dispositivo fisico y
  autonomia. El permiso es temporal; comprobar nuevamente antes de otra sesion.

Objetivo de uso, no resultado aprobado: encargado y operador encuentran paciente, explican saldo, localizan lote y
recuperan comprobante desde computador y celular, sin ayuda de navegacion.

- Product Owner (usuario): prioridad, aprobacion y coordinacion del dispensario.
- Facilitador tecnico (agente, funcion Scrum Master): tablero, bloqueos,
  implementacion, evidencias y revision; no sustituye evaluacion humana.
- Encargado y operador: realizan tareas y contrastan su operacion real.
- Flujo: Backlog -> Preparado -> En curso -> Validacion -> Cerrado. Bloqueado
  es una condicion explicita, no cierre. Maximo una entrega funcional En curso.
- Inicio de sesion: objetivo/bloqueos; cierre: evidencia, pendientes y siguiente
  accion. Revision y retrospectiva al terminar el sprint, no solo al publicar.
- Prioridad: seguridad/datos, fallo de flujo, friccion frecuente, visual, oportunidades.

## Fases y puertas de salida

| Fase | Salida requerida | Estado |
| --- | --- | --- |
| 0 Consolidar | Version, evidencia y pendientes coherentes | Cerrado en esta documentacion |
| 1 Validar jornada | Ambos roles recorren tareas; ayuda y defectos registrados | Validacion; bloqueada por sesiones |
| 2 Resolver fricciones | Defectos relevantes corregidos y tareas repetidas | Backlog; depende de observaciones |
| 3 Presentacion | Acceso primer encargado, datos separados y feedback registrado | Backlog |
| 4 Ampliar suite | Objetivo y reglas aprobados por modulo | Backlog; no construir por suposicion |

## Base historica PR42 y limites del recorrido original

- Producto: https://www.trustleaf.org/dispensario; laboratorio local 4330 excluido.
- Main `d101469e51888f6a33bc8c007267beba265d81a3`, PR #42 fusionado.
- CI https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36072522968 aprobado
  sobre `668d84f41f9f20aebca3b394670e2630755735c8`; preview aprobada.
- Vercel `dpl_d6Amae2MsKf8prLTEYno8ix2Ah9R`, production Ready y alias oficial
  reconfirmados el 25/09. Capturas sinteticas: `docs/evidence/desk-connected`.
- Ambos roles y 360/390/768/1024/1440 px probados tecnicamente. No equivale a
  dispositivo fisico, teclado movil ni usuario trabajando sin ayuda.
- Sesion oficial observada: Admin, sin acceso de dispensario. No es un defecto
  demostrado. Cuenta de encargado/operador, stock, saldo y permiso: sin comprobar.
- No confirmar entregas, recepciones, ajustes, cuarentenas, invitaciones ni retiro
  de miembros en este recorrido. No reiniciar saldos ni modificar tratamientos.
- Sin APIs, contratos, permisos o migraciones nuevas. B, Browns y borrador mensual
  intactos. Autenticacion real; contenido clinico/inventario exclusivamente ficticio.

## Tablero unico

| ID / actor | Problema y resultado esperado | Estado / responsable | Aceptacion, dependencia y evidencia |
| --- | --- | --- | --- |
| S1-01 / todos | Docs decian pendiente aunque PR42 publicado; base univoca | Cerrado / facilitador | Version/CI/Vercel contrastados; base anterior y E7 en mapa |
| S1-02 / ambos roles | Falta evaluar uso real del nuevo marco | Validacion, BLOQUEADO / facilitador + participantes | Todos los casos siguientes sin ayuda; requiere sesiones y permiso; evidencia humana pendiente |
| S1-03 / ambos roles | Fricciones aun no observadas; resolver solo hallazgos | Backlog / facilitador | Hallazgo reproducible, regresion, CI/preview y repeticion humana; depende S1-02 |
| S1-04 / encargado | Gestion conserva funciones pero falta evaluar claridad | Preparado / facilitador + encargado | Encontrar catalogo, proveedores/equipo y volver, sin guardar; sesion requerida |
| S1-05 / PO | Falta decision de cierre y siguiente prioridad | Backlog / PO + facilitador | Revision con resultados, bloqueos y retrospectiva; depende S1-02/03/04 |
| P-01 / encargado de ensayo | Acceso de Browns | Cerrado / PO + encargado | Ingreso y recarga del 27/09, Browns/Encargado; sin mover miembros de B |
| P-02 / dispensario | Preparar presentacion basada en funciones disponibles | Validacion / PO + facilitador | Browns con 100 g, movil guiado; autonomia y escenarios restantes pendientes |
| SEP-01 / equipo | Negativos de invitaciones y otros pendientes historicos | Backlog separado / facilitador | Reconciliar evidencia por caso antes de pruebas; S1 no los declara cerrados |

Bloqueo B1 historico (superado para Browns encargado): se necesitaba sesion de encargado u operador. Usar perfiles o dispositivos
separados; dos pestanas comunes no aislan identidad. Solicitud de acceso enviada
al usuario el 25/09, sin pedir contrasenas ni codigos. No cerrar Admin sin indicacion.
Bloqueo B2 condicional: permiso/tratamiento no aptos. Solo el paciente renueva
explicitamente si puede; de lo contrario detener ese caso y seguir lecturas permitidas.

## Protocolo de prueba y evidencia

Primero enunciar la tarea, sin indicar botones. El participante ejecuta; el agente
puede verificar tecnicamente despues, pero no adjudicarse autonomia humana.
Registrar ayuda literalmente. Con ayuda, el caso queda observado y requiere
revision/repeticion, no aprobado por autonomia.

| Caso | Tarea / resultado esperado |
| --- | --- |
| J01 | Identificar cuenta, rol, organizacion y piloto; leer saldo/stock actuales sin asumir valores |
| J02 | Encontrar paciente por nombre/referencia, elegir tratamiento y explicar disponible, asignado y retirado |
| J03 | Identificar lote utilizable y por que uno bloqueado no permite seleccion; revisar cantidad valida SIN confirmar |
| J04 | Volver, cancelar descarte y conservar preparacion; descartarla explicitamente; conservar busqueda al regresar |
| J05 | Encontrar lote en Inventario, abrir su historial y recuperar comprobante existente; explicar producto, cantidad y responsable |
| J06 | Alternar entregas/movimientos, combinar/limpiar filtros; error de lectura nunca se interpreta como cero |
| J07 | Recargar, volver a entrar y comprobar datos/permisos; operador sin gestion administrativa; no probar escrituras denegadas en vivo |
| J08 | Encargado localiza Gestion/catalogo/proveedores/equipo; formularios inicialmente plegados, abrir/cerrar sin guardar |

J01-J07: cada rol en escritorio y celular real. J08: encargado en ambos.
Casos sin datos de ejemplo quedan pendientes; no generar movimientos para cubrirlos.
Errores y revocaciones provocadas se reproducen en entorno aislado; no retirar
permisos publicados solo para obtener evidencia. Comprobar foco y teclado movil.

| Sesion | Rol / dispositivo | Casos | Resultado |
| --- | --- | --- | --- |
| U1 | Encargado / escritorio | J01-J08 | Acceso y pruebas del agente observados; autonomia pendiente |
| U2 | Encargado / celular real | J01-J08 | Recepcion 100 g encontrada con guia; resto y autonomia pendientes |
| U3 | Operador / escritorio | J01-J07 | B con evidencia guiada; autonomia pendiente |
| U4 | Operador / celular real | J01-J07 | Pendiente |

Por caso registrar: fecha, version, rol, dispositivo/navegador/ancho, esperado,
observado, ayuda, resultado (aprobado/fallido/pendiente), evidencia y defecto ID.
No incluir tokens, contactos o capturas clinicas reales. Referencias completas
solo cuando sean de prueba y necesarias; capturas sanitizadas.

## Defectos, oportunidades y cierre

No hay un defecto nuevo confirmado por esta consolidacion. Registro inicial:

| ID | Problema / actor | Frecuencia | Beneficio | Riesgo / esfuerzo | Decision |
| --- | --- | --- | --- | --- | --- |
| O1 Gestion | Posible dificultad para encontrar herramientas / encargado | Por medir | Menos ayuda | UI compartida / por estimar | Observar S1-04 |
| O2 Compras | Pedidos/recepciones parciales / encargado | Por confirmar | Pendientes trazables | Stock/concurrencia / alto preliminar | Descubrimiento con dispensario |
| O3 Documento/Caja | Cobro opcional y conciliacion / ambos | Por confirmar | Separar entrega y cobro | Dinero/roles / alto preliminar | Confirmar venta/aporte/membresia |
| O4 Conteos | Diferencias fisicas / encargado | Por confirmar | Ajustes explicables | Bloqueos/stock / alto preliminar | Acordar excepciones |
| O5 Reportes | Informacion para decisiones / encargado | Por confirmar | Control diario | Privacidad/datos faltantes / por estimar | Depende de modulos y preguntas reales |

Defecto nuevo: ID, caso, severidad, reproduccion, evidencia, responsable y prueba
de regresion. Critico de seguridad/datos detiene escenario; una desactivacion de
capacidad requiere procedimiento seguro, nunca borrar historial ni volver a Firebase.
Toda correccion: tipos, build, regresiones, CI/preview y verificacion posterior.

Presentacion inicial: preparar -> localizar autorizado -> explicar saldo -> revisar
sin ejecutar -> encontrar lote y comprobante -> explicar equipo. No presentar
Compras/Caja/Conteos como operativos. Preguntar herramientas actuales, tareas
frecuentes, excepciones, roles, formatos y modelo economico; no asumir respuestas.

Revision actual: consolidacion tecnica completada; sesiones de ambos roles
observadas, prueba humana pendiente. Ninguna funcion nueva ni entrega registrada.
Siguiente accion: contrastar NAV-01 y completar lecturas del operador; luego
evaluacion humana sin tutorial inicial. El unico cambio de acceso fue el permiso
temporal del paciente, autorizado explicitamente y documentado el 25/09.
Cierre S1 solo con ambas evaluaciones, defectos relevantes resueltos, evidencia
actualizada y siguiente prioridad aprobada. Retrospectiva: que funciono, donde
hubo ayuda y un cambio concreto al proceso para la proxima iteracion.
