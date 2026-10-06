# Trust Leaf: cerrar la demo y preparar la adopcion

Fecha: 2026-09-30, America/Santiago. Rama documental:
`audit/demo-adoption-readiness`. No habilita atencion ni dispensacion reales.

La fuente unica de estado, responsables, resultados y bloqueos es el
[tablero de cierre](DISPENSARY_CLOSEOUT_SPRINT.md#demo-y-adopcion-30092026).
Este documento describe la ejecucion; no mantiene otra matriz de aprobaciones.

## Presentacion del escenario existente 06/10/2026

Guion de20-30 minutos, sin videollamada ni nuevas operaciones. Confirmar banner
local, identidad y datos actuales antes de iniciar. No usar cuentas reales.

| Minutos | Actor | Demostracion |
| --- | --- | --- |
| 0-4 | Admin | Invitacion aceptada, solicitud ficticia aprobada; distinguir aprobacion de acceso efectivo |
| 4-8 | Encargado | Demo Horizonte, catalogo, recepcion100 g existente y equipo; stock actual90 g |
| 8-13 | Medico y paciente | Reserva, consulta finalizada, nota ficticia y tratamiento30 g/un periodo; no receta real |
| 13-19 | Operador | Buscar Camila Demo, explicar30/10/20 g; revisar1 g, hipotetico19 g, volver sin confirmar |
| 19-24 | Paciente y dispensario | Mismo comprobante10 g, producto/lote; no crear otra entrega |
| 24-30 | Equipo invitado | Recoger diferencias con su trabajo; Compras/Caja/Conteos son futuros |

Si el permiso24 h vencio, no renovarlo automaticamente. Solicitar decision
explicita para el ensayo; hasta entonces mostrar inventario/historial propio.
El ensayo no valida cuentas Privy reales ni acepta condiciones externas.

### Recuperacion tras reinicio

No reiniciar el proceso4331 ni usar Reiniciar escenario para preparar esta
presentacion si conserva los datos. Reinicio elimina SQL efimero. Si ocurre,
usar `npm run demo:local -- 4331` y el enlace de
arranque local sin copiar su fragmento al chat o Git. Seguir una sola vez el
guion de tests/local-demo/README.md con participacion sintetica explicita:
incorporacion, operador, producto, unica recepcion100 g, reserva/consulta,
tratamiento30 g/un periodo, permiso y unica entrega10 g. Comprobar20/90 y
comprobante antes de presentar; no copiar B/Browns ni manipular la base.

### Registro de observaciones

| Tarea | Rol/dispositivo | Resultado | Ayuda necesaria | Friccion reproducible | Prioridad / siguiente accion |
| --- | --- | --- | --- | --- | --- |
| Encontrar paciente y explicar saldo | Pendiente humano | Pendiente | No medida | No determinada | Evaluacion acompanada |
| Revisar sin entregar y volver | Pendiente humano | Pendiente | No medida | No determinada | Evaluacion acompanada |
| Encontrar lote y comprobante | Pendiente humano | Pendiente | No medida | No determinada | Evaluacion acompanada |

Registrar respuestas, no inferir autonomia del recorrido del agente. Celular
fisico y teclado real siguen pendientes por disponibilidad. Una correccion
reproducida se separa en fix/PR; no ampliar el alcance comercial por suposicion.

## Ensayo local del ciclo completo: 04/10/2026

Esta alternativa usa exclusivamente interfaces existentes y SQL efimero local.
No necesita cambiar de cuenta real, introducir codigos Privy ni renovar B.
[Arranque reproducible y guion de20-30 minutos](../tests/local-demo/README.md).
Admin, medico, paciente, encargado y operador son identidades simuladas;
la pantalla siempre indica datos sinteticos. Nunca introducir contactos reales.

Orden: invitacion/buzon local -> solicitud -> aprobacion -> operador -> catalogo
-> recepcion100 g -> reserva -> consulta explicita y nota -> tratamiento30 g
en un periodo -> autorizacion -> entrega local10 g -> comprobante compartido.
Saldo20 g/stock90 g; la revision posterior1 g no se confirma ni cambia registros.
Las escrituras de este guion ocurren solo en PGlite y no acreditan autenticacion,
habilitacion profesional, concurrencia PostgreSQL o autonomia humana.

Recarga/cambio de actor conservan registros mientras vive el proceso. Reiniciar
el escenario o el proceso los elimina expresamente. Invitar no llama Resend;
Calendar/Meet/Firebase/Stellar y conexiones externas estan bloqueados. El ensayo
no usa referencias ni pacientes de B/Browns. No hay Compras, Caja o Conteos.
La matriz unica mantiene el resultado tecnico; realizar despues el ensayo contigo
y registrar ayudas. Celular fisico y teclado real permanecen aparte.

El guion publicado historico siguiente conserva su fecha y restricciones. PR62
no se convierte en aviso aprobado/publicado; incorporacion externa sigue pausada.

## Demo sin llamadas: 01/10/2026

Base comprobada main `86e2016`, PR59 integrado y CI main 36941802547 PASS;
despliegue oficial contrastado en el [expediente](PILOT_PRIVACY_READINESS.md).
Esta actualizacion prevalece sobre las instrucciones historicas siguientes.
DEMO EXTERNA PAUSADA hasta completar privacidad minima y aprobacion del aviso.
No se presenta un borrador editorial como aviso publicado ni aceptado.

Guion seguro, para ensayo interno y posterior presentacion autorizada:

1. Identidad y organizacion: cuenta/rol correcto tras entrar y recargar. En
   material compartido, ocultar correos, nombres reales y contactos. Dos pestanas
   no son sesiones independientes. Usuario introduce codigos directamente.
2. Admin: leer invitacion, solicitud y decision existentes; explicar que
   aprobar no acredita establecimiento/profesional ni sustituye acceso efectivo.
   No enviar, reenviar, aprobar o corregir para obtener evidencia de la demo.
3. Medico/paciente: registros ficticios existentes de consulta, tratamiento y
   comprobante; explicar saldo. No crear/cancelar reserva, iniciar/cerrar consulta,
   guardar nota, abrir Meet, OAuth o procesar Calendar. Reserva/cancelacion puede
   enviar correo real aun sin videollamada; no incluir esas acciones en el guion.
4. B: comprobar permiso vigente antes de mostrar Atenciones. Vigencia 02/10
   02:33 es una observacion previa, no garantia actual. Si falta, no renovar por
   cuenta del paciente: continuar Inventario/Historial o solicitar confirmacion
   separada en otro recorrido. Revisar 1 g sin confirmar solo si el cupo actual
   lo permite; volver a editar/cancelar descarte y recuperar recibo existente.
5. Browns: preparacion separada del encargado, catalogo/recepcion de 100 g y
   lote existentes, Equipo segun rol. No sugerir que ese lote alimenta la entrega
   de B ni que Browns tiene operador/paciente propios ya comprobados. Sin guardar.
6. Cierre: preguntar donde se pierde contexto y registrar ayudas sin payloads
   privados. Compras, Caja, Conteos y uso clinico/comercial real quedan fuera.

Prueba humana disponible: sin indicar botones, localizar un lote y recuperar
su comprobante; luego explicar saldo/revision si hay permiso. Registrar rol,
version, navegador/dispositivo, autonomia o ayuda y observaciones de teclado/
barra inferior. Celular fisico pendiente si no hay participante; no convertir
capturas responsive ni tareas del agente en aprobacion humana.

[Aviso borrador](PILOT_PRIVACY_NOTICE_DRAFT.md) y
[procedimiento propuesto](PILOT_PRIVACY_PROCEDURE.md) requieren responsable,
canal probado, conservacion, proveedores y revision/aprobacion. Excluir llamada
no borra eventos Google existentes ni verifica revocacion de enlaces antiguos.

## Objetivo y decisiones

Demostrar Admin -> medico -> paciente -> dispensario -> comprobante con registros
existentes, y probar las escrituras completas en aislamiento. Reutilizar B y
Browns como escenarios distintos. No completar artificialmente una jornada de
Browns trasladando cuentas, pacientes, tratamientos o inventario de B.

Product Owner: usuario. Coordinador tecnico/Scrum Master: agente principal.
Ocho agentes por oleadas segun capacidad; maximo una correccion funcional en curso.
Solo el coordinador controla sesiones autenticadas, integra documentacion y PR.
La primera ronda de agentes es lectura y pruebas sinteticas; no modifica
produccion ni archivos compartidos.

1. Admin/incorporacion: invitacion, solicitud, decisiones y acceso efectivo.
2. Medico: alta existente, agenda, consulta explicita, notas y tratamiento simulado.
3. Paciente: reserva, perfil ficticio, permiso, saldo y comprobantes.
4. Dispensario: ambos roles, catalogo, recepcion, inventario, atencion e historial.
5. Seguridad: aislamiento, revocacion, retirada y autorizacion directa en servidor.
6. UX: foco, navegacion, borradores, estados y evaluacion humana.
7. Calidad: SHA, CI, despliegue, regresiones e independencia de conexiones SQL.
8. Preparacion regulatoria: expediente y preguntas para profesionales; no certifica.

Cada informe indica escenario, SHA, naturaleza de evidencia, resultado,
archivo/linea o prueba, severidad, reproduccion y siguiente accion. No comprobado
no equivale a defecto ni a aprobado. Reutilizar resultados del mismo codigo;
repetir lo afectado por diferencias posteriores, no todas las suites por rutina.

## Sprints y puertas

| Sprint | Entrega | Salida |
| --- | --- | --- |
| 0 Base | Version, CI, despliegue y documentos reconciliados | Referencia comprobable y matriz unica |
| 1 Ciclo tecnico | Lecturas publicadas y escrituras sinteticas aisladas | Coherencia y escenarios criticos aprobados |
| 2 Experiencia | Tareas humanas y correcciones reproducidas | Demo sin defectos criticos conocidos; ayudas visibles |
| 3 Presentacion | Guion e incorporacion acompanada del primer equipo | Presentacion realizada y acceso propio comprobado |
| 4 Viabilidad | Revision juridica/clinica independiente y backlog de adecuacion | Decision escrita sobre alcance habilitable |

Hasta una semana por sprint como referencia; no hay fecha comprometida ni
ejecucion automatica. La privacidad de cuentas y contactos reales se revisa
antes de una invitacion externa. La segunda incorporacion espera los problemas
relevantes observados en la primera. Los sprints futuros no se cierran por
terminar una auditoria automatizada.

## Recorrido publicado, sin nuevas operaciones

- Puerta actual: DEM-SEC-01/02 cerrados/publicados. Las invitaciones externas
  siguen pausadas por privacidad; renovar B requiere confirmacion especifica
  del paciente en un recorrido autorizado, no durante esta auditoria.
- Paciente `crwom01@gmail.com`: solicitar confirmacion especifica antes de
  compartir perfil ficticio, tratamiento `4119236d` y entregas con B durante
  24 horas. No incluir notas clinicas. Comprobar permiso y recarga. No autorizar
  Browns ni el tratamiento revocado. Si no se autoriza, Atenciones queda pendiente.
- Operador `digitalmoneychile8@gmail.com`: confirmar organizacion/rol, buscar
  paciente, contrastar saldo vigente, seleccionar lote utilizable y revisar
  1 g sin confirmar. Con saldo inicial 10 g, el hipotetico es 9 g; si cambia,
  registrar el actual y no forzar esa cifra. Volver a editar y cancelar descarte.
- Consultar Inventario e Historial: stock actual, lote, Entregas/Movimientos,
  busqueda, filtros y limpieza. Recuperar comprobante
  `3150a49a-a8b2-4e19-a46b-a453adb7c15f`, sin otra entrega. Recargar.
- Encargado `dgtlmoney8@gmail.com`: contrastar registros, abrir recepcion y ajuste
  sin enviar, consultar Equipo sin invitaciones o retiradas. Cancelar descartes
  debe conservar preparaciones; un cambio de identidad retira datos protegidos.
- Browns: reutilizar preparacion comprobada el 27/09; confirmar lectura con su
  encargado cuando este disponible. Producto DEMO-BRW-001, lote BRW-DEMO-001,
  recepcion unica de 100 g. No crear duplicados, proveedor o entrega para una lectura.
- Admin `admin@trustleaf.org`: reutilizar lectura 29/09 si version compatible;
  comprobar solo faltantes de miembros, solicitud, decision y acceso efectivo.
- Medico: reutilizar reserva y nota leidas el 29/09 y relacion tratamiento/recibo;
  no iniciar/cerrar consultas ni guardar notas en produccion para esta validacion.

Usuarios introducen codigos Privy directamente, nunca en chat. Dos pestanas no
aislan identidades: cerrar sesion antes de cambiar en el mismo navegador, o usar
perfiles/dispositivos separados. Confirmar identidad tras entrar y recargar.

## Pruebas aisladas y correcciones

Ejecutar alta/aprobacion, reserva/cancelacion, notas, cierre con/sin tratamiento,
entregas, recepcion, ajustes, revocacion, retirada, enlaces invalidos y respuestas
perdidas con datos sinteticos. No cargar secretos de produccion ni enviar correo
real. Interceptar APIs externas en navegador. PGlite no prueba concurrencia:
contrastar carreras con PostgreSQL y conexiones independientes.

Ambos roles: 360/390/768/1024/1440 px, teclado, foco, nombres largos, errores,
reconexion y borradores. Registrar por separado viewport y telefono fisico.
Una tarea hecha por el agente o completada con instrucciones no acredita
autonomia. No sustituir un escenario sin datos por una escritura publicada.

Defecto confirmado -> rama `fix/...` independiente -> regresion -> tipos/build ->
revision -> CI/preview del ultimo commit -> integracion -> lectura publicada.
No mezclar correcciones funcionales en el PR documental. Cualquier API/migracion
nueva requiere decision separada y, para migrar, respaldo restaurable verificado.

Primera entrega tecnica de sprint 1: PR53 ya integrado en 6671c5e. Recupera el
runner de inventario, no modifica el producto; causa y ejecuciones repetidas en
[evidencia de CI](evidence/inventory-qa-sync/README.md). PR52 se actualiza desde
main y debe aprobar sus propios checks del ultimo head antes de integrar.
El coordinador y seis agentes conservaron los controles de aislamiento,
borradores, democion e idempotencia. La matriz unica registra resultados y limites.
Actualizacion: PR52 integrado en 637e17c. DEM-SEC-02 cerrado por PR54 en 65aaeb8,
CI/preview del candidato aprobados y retirada 410/405/no-store comprobada en el
dominio oficial. [Evidencia y limites](evidence/legacy-private-route-block/README.md).
Actualizacion 01/10: DEM-SEC-01 cerrado por PR56 y PR59 integra concurrencia
en 86e2016 con PG17 CI PASS. No levantar invitaciones por ello; DEM-LEG-01 conserva los problemas de
fallback/cache del portal Stellar como trabajo independiente.

## Presentacion y colaboracion humana

Guion de 20 minutos: identidad y acceso (3), medico/paciente con reserva y saldo
(5), operador con revision sin entrega (5), inventario/comprobante (4), Browns
como preparacion del encargado y permisos de equipo (3). Mostrar claramente el
cambio de escenario B/Browns y separar el ensayo sintetico de la evidencia publicada.

Antes del guion, pedir tareas sin indicar botones: encontrar paciente, explicar
saldo, revisar cantidad, localizar lote y recuperar comprobante. Registrar
dispositivo/navegador, ayudas, errores y acciones tapadas por teclado/barra.
Participantes evaluan ambas funciones; agente no aprueba uso humano por ellos.

Antes de invitar externamente: DEM-SEC-01 y DEM-SEC-02 cerrados con evidencia,
privacidad minima revisada, destinatario compatible,
nombre/correo suministrados y envio confirmado desde Admin. Solicitante completa
datos y Admin revisa; comprobar una organizacion y membresia tras nueva sesion.
La invitacion real no forma parte de las pruebas aisladas. Compras/Caja/Conteos
e invitaciones medicas no son capacidades prometidas de esta demo.

## Puerta de uso real

Preparar expediente para abogado sanitario chileno y responsable clinico: modelo
de actividad, prestador/custodio, profesionales, telemedicina/Meet, consentimiento,
ficha y receta, firma, productos y establecimientos, privacidad/proveedores,
transferencias, retencion, restauracion e incidentes. Fuentes y brechas en
[preparacion legal](chile-legal-readiness.md), que no certifica cumplimiento.

La aprobacion en Admin no acredita habilitacion sanitaria. Mantener tratamientos,
perfiles e inventario ficticios y no publicar datos clinicos en Stellar. El
resultado tecnico permite decidir demo/incorporacion acompanada, no prescripcion
o dispensacion reales. Una revision profesional pendiente sigue siendo bloqueo
para la transicion real, aunque todos los tests pasen.
