# Trust Leaf: alcance, narrativa y plan maestro

Fecha de corte: 2026-09-08. Estado: piloto operativo integrado a main y desplegado
INACTIVO; migracion, activacion alojada y aceptacion con usuarios pendientes.
Este documento es el punto de entrada para el nuevo alcance. No certifica
cumplimiento sanitario ni autoriza datos clinicos reales, mainnet o despliegues.

## Tablero vigente: activacion y operacion diaria

Este tablero sustituye la secuencia de expansion del corte de septiembre 6.
Objetivo acordado: operacion diaria simulada, medico independiente, dispensario
de una sede con encargado y operadores, paciente con trazabilidad y admin con
supervision minima mas POV sintetico. Pagos y contabilidad quedan fuera.

| Fase | Implementado / evidencia local | Despliegue y aceptacion |
|---|---|---|
| 0 Consolidar base | Baseline de entrada: `20796f6` y main `b6186b2`; PR #16 integra ambos en `2477c44`, CI pasa sobre main; 25 migraciones remotas revisadas | Vercel `dpl_GkQNnu37QcJwndhjTFFJZ91Djb72` Ready en URL oficial; ambos flags false; ninguna migracion aplicada |
| 1 Activar actores/equipos | Alta/aprobacion/agenda existentes pasan SQL; nuevo consentimiento de piloto, organizacion, encargado/operador y retiro de acceso probados | Repetir login, solicitudes y equipos con Privy/Supabase alojados |
| 2 Agenda/consulta | Agenda existente reutilizada; inicio y cierre de consulta persistentes, independientes de abrir Meet | Meet e invitaciones tienen confirmacion del usuario previa a este cambio; regresion integrada pendiente |
| 3 Atencion/tratamiento | Nota privada versionada, cierre con/sin tratamiento, emision simulada y revocacion | Sin emision clinica real; pendiente aceptacion alojada |
| 4 Entregas/stock | Caso 10g A + 20g B y PostgreSQL 17 con conexiones independientes: cuota/stock compartidos, reintento concurrente, respuesta perdida, permisos, cuarentena y vencimiento pasan | No activar hasta respaldo verificado, migracion y revision alojada |
| 5 Paneles diarios | Browser + SQL local completa solicitud de cita, consulta, tratamiento, permisos y entregas; captura desktop/movil de 5 identidades, recarga e invalidacion de identidad | Login ficticio en QA; no sustituye recorrido real ni validacion de todos los estados |

Version integrada: `src/features/operations`, API `/api/operations-pilot` y
migracion `20260909010000_operations_pilot.sql`. Activacion requiere ambos flags
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

Pendiente verificable: integracion real y respaldo/restauracion de la aplicacion,
retencion/cifrado de datos clinicos y acceso privado a llamadas. Los datos del
piloto son ficticios; no afirmar que esta capa contiene una ficha clinica apta
para produccion. Detalles reproducibles en [runbook del piloto](operations-pilot-runbook.md).

La migracion mensual `20260906120000_monthly_dispensing_quota.sql` estaba sin
registrar al iniciar el trabajo. Se conserva intacta, no es dependencia del nuevo
piloto y NO debe entrar en un `db push` indiscriminado. No se aplicaron migraciones
remotas ni se reparo historial en esta entrega.

Revision remota del 2026-09-08: 25 versiones coinciden con la cadena revisada;
solo falta `20260909010000_operations_pilot.sql` (el borrador anterior se excluye).
El listado de respaldos de Supabase devuelve `backups:null` y `pitr_enabled:false`.
Se preparo un exportador cifrado con Windows DPAPI y restaurador aislado; su
ejecucion fue bloqueada por revision de seguridad y requiere aprobacion explicita
del destino `D:\00 CODEX - OPENIA\.backups\trustleaf`. No se exportaron filas.
El alcance es tablas/funciones de la aplicacion, no Auth, Storage, Vault ni una
copia completa del servicio. La clave DPAPI depende del usuario Windows actual.
Hasta cerrar ese punto, integrar codigo no significa habilitar el piloto.

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
| Cupos e inventario | Piloto implementado, pruebas SQL/browser y concurrencia PostgreSQL aprobadas | Codigo desplegado inactivo; respaldo, migracion y aceptacion pendientes; borrador anterior intacto |
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

Siguiente gate vigente: obtener aprobacion del respaldo privado cifrado, verificar
su restauracion y aplicar exclusivamente la migracion del piloto; despues activar
y recorrer los paneles con cuentas separadas. Tipos y concurrencia ya pasan.
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
