# Browns: ensayo y presentacion del nucleo

Fecha: 2026-09-26. Browns es ensayo propio por decision del Product Owner.
El dispensario externo tendra cuenta y organizacion propias posteriormente.
Este documento es el guion; el tablero de seguimiento sigue en
[Sprint S1](DISPENSARY_CLOSEOUT_SPRINT.md).

## Estado y dependencias

| Paso | Estado | Evidencia requerida |
| --- | --- | --- |
| Integrar PR40 documental | Hecho | 58d1dd3; verify y Vercel aprobados en 43581f7 |
| Acceso encargado Browns | Pendiente de inicio de sesion | Organizacion, rol y persistencia tras recarga |
| Inventario inicial de Browns | Pendiente | Leer catalogo, lotes, equipo y comprobantes antes de crear |
| Operador propio | Pendiente de inventario | Reutilizar miembro correcto o pedir correo separado e invitacion explicita |
| Paciente exclusivo | Pendiente | Cuenta separada, tratamiento ficticio por medico, permiso expreso |
| Comprobante del ensayo | Pendiente | Reutilizar uno de Browns o acordar una entrega ficticia unica |
| Ensayo desktop y telefono | Pendiente | Rol, dispositivo fisico, version, resultado y ayuda por tarea |
| Presentacion externa | No preparada aun | Todas las puertas anteriores y ausencia de defectos criticos |

No deducir la cuenta encargada por su correo ni crear otra organizacion si el
acceso falla. Resolver primero identidad, solicitud y membresia. Nunca mover
miembros de B. No pedir contrasenas ni codigos en el chat.

## Preparacion desde paneles

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
