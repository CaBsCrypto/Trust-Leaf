# Trust Leaf: cerrar la demo y preparar la adopcion

Fecha: 2026-09-30, America/Santiago. Rama documental:
`audit/demo-adoption-readiness`. No habilita atencion ni dispensacion reales.

La fuente unica de estado, responsables, resultados y bloqueos es el
[tablero de cierre](DISPENSARY_CLOSEOUT_SPRINT.md#demo-y-adopcion-30092026).
Este documento describe la ejecucion; no mantiene otra matriz de aprobaciones.

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

- Puerta previa: mientras DEM-SEC-01 permanezca abierto, no renovar el permiso
  de B, aunque exista confirmacion del paciente. Las invitaciones externas
  tambien requieren cerrar DEM-SEC-02 (frontera heredada).
  Retomar esos pasos solo tras correccion revisada, publicada y comprobada.
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
Siguiente: DEM-SEC-01 con su entrega de lectura compartida revisada. No levantar
invitaciones ni renovar el permiso de B; DEM-LEG-01 conserva los problemas de
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
