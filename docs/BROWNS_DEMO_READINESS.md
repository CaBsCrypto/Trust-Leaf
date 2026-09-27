# Browns: ensayo y presentacion del nucleo

Fecha: 2026-09-26. Browns es ensayo propio por decision del Product Owner.
El dispensario externo tendra cuenta y organizacion propias posteriormente.
Actualizacion de alcance 27/09: preparar dos incorporaciones externas secuenciales.
Reutilizar evidencia de B; no exigir cuentas nuevas ni repetir entregas en Browns
para este bloque. Operador/paciente exclusivos se aplazan, no se dan por probados.
Este documento es el guion; el tablero de seguimiento sigue en
[Sprint S1](DISPENSARY_CLOSEOUT_SPRINT.md).

## Estado y dependencias

Actualizacion humana 27/09: el usuario confirmo encontrar el movimiento de
recepcion de 100 g en celular fisico. Requirio indicaciones para localizar
Historial/Movimientos: prueba guiada, no autonomia. No acredita teclado, todos
los flujos moviles ni uso del operador. Modelo/navegador no registrados.

| Paso | Estado | Evidencia requerida |
| --- | --- | --- |
| Integrar PR40 documental | Hecho | 58d1dd3; verify y Vercel aprobados en 43581f7 |
| Acceso encargado Browns | Comprobado 27/09 | Ingreso del usuario; Browns / Encargado conservados tras recarga |
| Inventario inicial de Browns | Comprobado | Un producto, lote, recepcion y movimiento de 100 g; persistencia |
| Operador propio | Aplazado, no bloquea esta incorporacion | Reutilizar evidencia de B sin trasladar membresias |
| Paciente exclusivo | Aplazado, no bloquea esta incorporacion | Evidencia de B separada; no afirmar atencion completa en Browns |
| Comprobante del ensayo | Recepcion Browns comprobada; entrega Browns no realizada | Recibo de entrega de B se presenta como otro escenario |
| Ensayo desktop y telefono | Parcial guiado | Agente en navegador; usuario encuentra movimiento en celular fisico; autonomia pendiente |
| Incorporacion externa acompanada | Decision en auditoria | Ver matriz unica del sprint; no depende de cuentas nuevas en Browns |

No deducir la cuenta encargada por su correo ni crear otra organizacion si el
acceso falla. Resolver primero identidad, solicitud y membresia. Nunca mover
miembros de B. No pedir contrasenas ni codigos en el chat.

### Evidencia del 27/09, 03:38 Chile

Usuario completo el ingreso. El agente observo Browns, rol Encargado e indicador
Piloto simulado; recarga conserva identidad, organizacion y rol. Jornada muestra
0 pacientes autorizados, 0 g disponibles, 0 entregas hoy, 1 miembro activo y
preparacion 1/4. Catalogo finaliza lectura sin error y muestra pagina vacia;
Nuevo producto esta habilitado. No se crearon registros ni se enviaron invitaciones.
Esto comprueba acceso, no autonomia humana ni uso en telefono real. Falta leer
Inventario, Historial y Equipo: cero entregas hoy no prueba ausencia de historico,
y cero stock disponible no prueba ausencia de lotes bloqueados o agotados.

Lecturas posteriores del 27/09: Inventario con Todos seleccionado muestra
No hay lotes registrados; formulario Recibir lote plegado. Historial/Entregas
muestra No hay entregas registradas, y Movimientos de stock muestra No hay
movimientos registrados. Equipo muestra solo al encargado y ninguna invitacion.
Navegacion a Inventario/Historial y cambio a Movimientos comprobados con Enter
en controles semanticos; clics automatizados no siempre cambiaron la vista.
No inferir fallo general de navegacion ni autonomia humana. Sin escrituras.
Estado historico previo a la recepcion: Proveedores y Recepciones comerciales,
filtros con datos y telefono real no estaban comprobados. El resultado posterior
y la confirmacion movil sustituyen ese estado. Operador/paciente propios fueron
aplazados explicitamente; no son requisitos del bloque de incorporacion actual.

## Preparacion desde paneles

### Resultado ejecutado 27/09, 03:50-03:52 Chile

Con sesion del encargado Browns, catalogo vacio comprobado antes de guardar:

- Producto Flor Demo Browns - no real, codigo DEMO-BRW-001, presentacion Gramos,
  exclusivamente para pruebas; reposicion 20 g, precio sin informar.
- Producto: b65e9426-0ae0-492f-9338-a977ac3134e6.
- Una recepcion comercial vinculada de 100 g, lote BRW-DEMO-001; origen Ensayo
  ficticio Browns, sin proveedor ni costo, vencimiento 31/12/2026 12:00 Chile.
- Recepcion: 38546c47-ace9-449e-a20d-2dd3fcb08f6f. Respuesta Guardado y una fila
  en Recepciones. No se repitio el envio ni se uso recepcion legacy adicional.
- Recarga: Browns/Encargado, 100 g disponibles, preparacion 2/4 y cero entregas.
- Inventario: un lote Disponible, vencimiento correcto. Buscar BRW-DEMO-001
  encuentra el lote. Ver historial del lote aplica su filtro; Movimientos muestra
  una recepcion de 100 g. Entregas sigue vacio. Busqueda inexistente muestra
  No hay movimientos para estos filtros; limpiar filtros recupera la vista.
- B intacto; ninguna entrega, ajuste, invitacion o cambio de permisos efectuado.

### Evidencia del ensayo (historica; matriz vigente en el sprint)

La decision y los pendientes actuales se mantienen solo en
[la matriz del sprint](DISPENSARY_CLOSEOUT_SPRINT.md). Esta tabla conserva el
corte del ensayo; no sustituye la auditoria de version posterior.

| Flujo | Version / evidencia | Resultado | Pendiente |
| --- | --- | --- | --- |
| Acceso Browns | Oficial, 27/09; ingreso usuario y recarga agente | Comprobado | Autonomia y celular real |
| Producto/recepcion/lote | Oficial, referencias anteriores | Comprobado desde panel y persistente | Dispositivo fisico |
| Historial/busqueda | Oficial, lote y movimiento anteriores | Comprobado por agente | Combinaciones de fecha y evaluacion humana |
| Operador/paciente B | Evidencia historica del sprint, sin nuevas escrituras | Reutilizada, no repetida hoy | Negativos reales aun pendientes no se cierran |
| Comercio | Local 27/09: 5 tests API y SQL commerce aprobados | Roles, aislamiento, rollback, replay, archivo, vinculacion | Concurrencia independiente se contrasta con CI |
| Invitaciones | Local 27/09: 12 tests y SQL aprobados | Identidad, rechazo, cancelacion, rotacion, limites, webhooks | Recepcion real y negativos publicados separados |
| Incorporaciones | Local 27/09: 5 tests y SQL aprobados | Borrador, versiones, correcciones, rechazo, aprobacion | Sesion Admin no inspeccionada hoy |
| CI main | 58d1dd3, run 36221358001 success | Workflow incluye PostgreSQL independiente y navegador sintetico | No sustituye uso humano |
| Produccion | dpl_Bt2DKQGNUee8dHMXfFPNDAfkzEq7 Ready, alias oficial 27/09 | Despliegue identificado | CLI no expuso SHA; no inferir correspondencia exacta |
| Dos equipos externos | Sin invitaciones enviadas | Pendiente | Nombre/correo del primero, luego segundo |

El guion inicial que sigue conserva referencia; no exige completar operador y
paciente propios en esta entrega. Presentacion combina preparacion en Browns y
evidencia de atencion de B, identificando ambos escenarios explicitamente.

1. Entrar como encargado y registrar la organizacion visible. Recargar y confirmar.
2. Consultar catalogo, inventario, equipo e historial. Anotar lo reutilizable.
3. Si faltan, preparar producto ficticio y lote desde controles autorizados;
   acordar cantidades y vencimiento antes de guardar. No inventar costos reales.
4. Reutilizar operador propio o solicitar un correo distinto a B. Obtener
   confirmacion de acceso al enviar la invitacion; el trabajador acepta.
5. Solicitar cuenta de paciente exclusiva si falta. Medico emite tratamiento
   ficticio desde su flujo; paciente concede permiso explicitamente.
6. Si no hay comprobante, acordar lote/cantidad y una entrega ficticia del ensayo.
   Registrar saldo y stock antes/despues. No ejecutarla como prueba de solo lectura.

## Guion de 20 minutos

| Minutos | Tarea | Resultado observable |
| --- | --- | --- |
| 0-3 | Encargado identifica espacio y pendientes | Cuenta, organizacion, rol y piloto claros |
| 3-8 | Operador encuentra paciente y prepara revision | Explica saldo y lote; no confirma otra entrega |
| 8-12 | Consulta lote e historial | Recupera comprobante y relaciona cantidades |
| 12-16 | Encargado muestra catalogo y equipo | Distingue sus permisos de los del operador |
| 16-20 | Recoger diferencias con su trabajo | Observaciones y prioridades, no promesas de modulos |

Repetir tareas en telefono real y computador con sesiones separadas. Primero
enunciar tarea sin indicar botones. Registrar ayuda, teclado, controles tapados,
recarga y persistencia. Una simulacion responsive no acredita celular fisico.

## Registro y puertas de salida

Por tarea: fecha, version publicada, rol, dispositivo, esperado, observado, ayuda,
resultado, evidencia y defecto. No guardar datos personales ni secretos aqui.
Corregir solo defectos reproducidos impeditivos con regresion, tipos, build,
CI y preview. No cerrar autonomia mediante acciones del agente.

Listo para presentar: acceso persistente, escenario sintetico reproducible,
comprobante recuperable, ensayo humano en ambos dispositivos y ningun defecto
critico abierto. Hoy esas condiciones no estan completas.

## Reunion externa y limites

Preguntar recepcion de existencias, atencion, responsables, excepciones,
comprobantes y herramientas a reemplazar. Registrar frecuencia y prioridad.
Compras, Caja y Conteos no estan disponibles y no se mostraran como operativos.
Tras la reunion, Admin invita al encargado real; formulario y revision antes
de habilitar su propia organizacion. No copiar datos ni miembros del ensayo.

Sin APIs, migraciones ni cambios de permisos previstos. B, historiales y borrador
mensual intactos. Autenticacion real y datos clinicos/inventario ficticios:
ni ensayo ni incorporacion habilitan atencion o dispensacion reales.
