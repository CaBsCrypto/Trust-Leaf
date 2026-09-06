# Trust Leaf: alcance, narrativa y plan maestro

Fecha de corte: 2026-09-06. Estado: propuesta de producto y ejecucion.
Este documento es el punto de entrada para el nuevo alcance. No certifica
cumplimiento sanitario ni autoriza datos clinicos reales, mainnet o despliegues.

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
| Cupos mensuales e inventario | Borrador SQL local en preparacion | Sin aplicar, sin UI y sin validacion funcional completa |
| Consulta, receta y retiro integral | Pendientes de integracion end-to-end | No declarar operativos por existir componentes |
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

Relacionar cita, medico, paciente, estado de atencion y expediente privado.
Primer alcance propuesto: enlace Meet unico por cita, cargado por el profesional,
visible solo a sus participantes; sin datos clinicos en el titulo ni grabacion
por defecto. Abrir el enlace no marca la consulta como realizada.
Automatizar Calendar/Meet requiere autorizacion OAuth separada: ingresar con
Google en Privy no concede ese acceso. Referencia para la futura integracion:
[Google Calendar: crear eventos](https://developers.google.com/workspace/calendar/api/guides/create-events).

### Receta, cupo y retiros

- Definir cantidad por periodo y duracion: 30 g por mes durante tres meses no
  implica 90 g disponibles al inicio.
- Ejemplo de aceptacion: A entrega 10 g; B consulta el saldo autorizado y puede
  entregar hasta 20 g en ese mismo periodo, nunca otros 30 g.
- Propuesta pendiente de confirmar: periodos anclados al inicio de la receta,
  sin arrastre de saldo. Resolver fines de mes, zona horaria y vencimiento.
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
el historial. Precisar reglas de devolucion y anulacion antes de implementarlas.

### Privacidad y prueba en cadena

Ficha y receta detalladas permanecen privadas, con minimizacion, cifrado,
retencion y accesos auditables. Una wallet o un hash publico pueden permitir
correlaciones: no publicar un historial sanitario individual, aunque no lleve nombre.
Stellar sera una capa verificable minima, separada del detalle clinico; su diseno
debe superar revision de privacidad antes de emitir credenciales vinculables.
Analitica futura agregada; no reutilizacion de historiales para campanas sin
evaluar finalidad y base juridica. La evaluacion legal/sanitaria sigue pendiente.

## 5. Fases, dependencias y criterios de cierre

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

Primer bloque ejecutable: F1. Reproducir sesion cruzada y refresco tras escritura,
corregir y validar; despues establecer la navegacion compartida de F2.
El borrador mensual no se despliega mientras faltan decisiones y pruebas.

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
| Periodos mensuales | Aniversario de inicio y sin arrastre; confirmar antes de F4 |
| Productos y unidades | Flor en mg inicialmente; otras presentaciones requieren reglas propias |
| Llamadas | Link privado por cita primero; OAuth automatizado despues |
| Admin y soporte | Minimos privilegios; no acceso clinico universal |
| Cuentas de QA | Sinteticas aisladas para automatizacion; login real se prueba aparte |
| Stellar | Testnet y prueba minima; no mainnet ni historial medico publico |

Fuera del primer cierre: pagos, marketplace avanzado, marketing basado en
historiales, conversiones automaticas de productos, automatizacion integral de
Meet y analitica comercial avanzada. No hay fecha fiable de entrega global hasta
medir F1-F3 y resolver dependencias; priorizar cierres pequenos demostrables.

## Referencias y mantenimiento

- [Agenda persistente y evidencia tecnica](privy-persistent-agenda.md).
- [Plan de cierre MVP anterior](mvp-functional-closure-plan.md): conservar como
  corte historico; el estado actualizado de expansion se sigue aqui.
- [Tablero historico de arquitectura](internal/trustleaf-master-delivery-board.md):
  contiene decisiones y restricciones de etapas anteriores, no estado actual.

Este documento no modifica codigo ni aplica la migracion mensual local.
