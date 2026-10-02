# Aviso de privacidad del piloto: borrador para revision

Estado: BORRADOR INTERNO, NO APROBADO Y NO PUBLICADO COMO AVISO OPERATIVO.
Version editorial: draft-2026-10-01. Esta version no esta registrada como
aceptada por ningun usuario. No sustituye una revision juridica.

## 1. Responsable y contacto

- Responsable del tratamiento propuesto: fundador / Product Owner de Trust
  Leaf, quien indica operar solo (propuesta del 01/10/2026). Identificacion
  formal y revision profesional: [PENDIENTES]. No se ha informado una razon
  social; no inventar una ni dar por determinada la forma juridica del responsable.
- Identificacion y domicilio del responsable: [PENDIENTE].
- Canal propuesto para consultas, solicitudes e incidentes:
  `admin@trustleaf.org`. Recepcion, respuesta, acceso seguro y seguimiento:
  [PENDIENTES DE PROBAR Y APROBAR]. No se ha enviado un correo de prueba.
- Persona propuesta para atender solicitudes e incidentes: fundador / PO.
  Disponibilidad y reemplazo: [PENDIENTES].

No usar automaticamente el remitente de invitaciones como canal de privacidad.
Este canal es una propuesta explicita del PO, no una inferencia del remitente.
Una cuenta Privy Admin con ese correo no demuestra acceso al buzon ni atencion
de solicitudes. No se crea otro correo ni se configura reenvio en esta entrega.
Estos campos deben completarse y aprobarse antes de publicar el aviso o invitar
a participantes externos. No ofrecer un canal que nadie atienda.

## 2. Alcance del piloto

Trust Leaf se presenta como una prueba de interfaces y procesos administrativos.
Las cuentas autenticadas y los datos de contacto de los participantes pueden
ser reales. Los perfiles de pacientes, tratamientos, consultas, productos,
existencias y entregas de la demostracion deben ser ficticios.

La aprobacion administrativa habilita el piloto, no acredita un profesional o
establecimiento ni habilita atencion, prescripcion, dispensacion o cobros reales.
La primera demostracion externa no incluye llamadas ni grabaciones.

## 3. Datos y finalidades propuestas

| Categoria | Datos del flujo existente | Finalidad propuesta, pendiente de base y revision |
| --- | --- | --- |
| Cuenta y acceso | Identificador de Privy, correo verificado, rol y estado | Autenticar, aplicar permisos y gestionar participacion |
| Invitacion | Destinatario, vigencia, estado y resultado del envio | Invitar al destinatario indicado y seguir su incorporacion |
| Solicitud del encargado | Nombre, telefono, nombre comercial, comuna, direccion, actividad y correo de contacto opcional | Revisar y preparar su dispensario de pruebas |
| Equipo | Identidad, correo verificado, rol y membresia | Controlar acceso a la organizacion de pruebas |
| Perfil y autorizacion de paciente ficticio | Nombre, contacto de prueba, referencias y permiso del tratamiento | Ensayar la informacion compartida y su retirada |
| Operacion ficticia | Referencias de consultas, tratamientos, lotes, cantidades, comprobantes y responsable | Ensayar saldos, existencias e historial |
| Seguridad y soporte | Estados, marcas temporales y referencias tecnicas necesarias | Resolver fallos y revisar acciones autorizadas |

Las referencias se trataran como potencialmente identificables, no como datos
anonimos por ser UUID o hashes. Un campo llamado ficticio puede contener texto
real: no ingresar salud real, datos de otros pacientes, RUT ni documentos.

## 4. Acceso y proveedores

El solicitante y los administradores autorizados consultan la solicitud. Los
miembros del dispensario consultan lo permitido para su organizacion y rol.
Compartir el perfil ficticio y tratamiento con un dispensario requiere el
permiso vigente del paciente. Retirar ese permiso no elimina los comprobantes
operativos que cada parte puede consultar legitimamente dentro del piloto.

La implementacion utiliza Privy para identidad, Supabase para persistencia,
Resend para invitaciones y Vercel para servir la aplicacion y sus APIs. Las
integraciones de calendario existentes pueden enviar fechas y correos a Google,
aunque la demostracion externa excluya llamadas. Excluir la llamada no elimina
los eventos o datos ya guardados por Google.

El proyecto Supabase observado tiene region primaria `us-east-1`; se observaron
funciones Vercel en `iad1`. Eso no determina la ubicacion de todos los servicios.
Otros destinatarios/regiones, subproveedores, condiciones contractuales y
transferencias: [PENDIENTES DE VALIDACION EN EL EXPEDIENTE]. La documentacion
publica de un proveedor no demuestra por si sola la configuracion o contrato
de esta cuenta. No afirmar que todos los datos permanecen en Chile.

## 5. Conservacion y seguridad

Plazos por categoria, datos rechazados/cancelados, auditoria, colas, registros
del proveedor y respaldos: [PENDIENTES DE DEFINIR Y APROBAR]. La vigencia de
una invitacion o permiso no equivale a la eliminacion de sus datos.

El producto tiene controles de identidad, acceso y respuestas privadas. Los
correos y secretos de invitaciones se cifran en el servidor; esto no significa
que todos los perfiles y formularios tengan cifrado aplicativo por campo.
No prometer anonimato, cifrado de extremo a extremo ni borrado automatico sin
evidencia y mecanismos implementados.

## 6. Consultas, solicitudes y errores de ingreso

Una vez definido y probado el canal, se podran presentar solicitudes relacionadas
con los datos. Se comprobara la identidad sin pedir contrasenas, tokens, codigos
de acceso ni documentos innecesarios. Alcance, plazos y respuesta aplicables:
[PENDIENTES DE REVISION PROFESIONAL Y OPERATIVA].

El producto no ofrece todavia un portal general de exportacion o eliminacion.
No prometer la ejecucion inmediata de esas acciones ni borrar historiales para
resolver una solicitud sin revisar dependencias, obligaciones y permisos.

Si se ingresa informacion real de salud por error, detener la demostracion y
contactar al responsable por el canal que se defina; no reenviarla por chat ni
incluirla en capturas, PR o reportes publicos.

## 7. Participacion y decisiones pendientes

La aceptacion actual registra participacion en pruebas. No acredita aceptacion
de este borrador ni de un aviso versionado. El permiso de compartir datos de un
tratamiento tampoco sustituye el aviso de privacidad o un consentimiento clinico.

Antes de usar este texto: completar responsable/canal, resolver las condiciones
de proveedores y conservacion, revisar las finalidades y bases, aprobar el
procedimiento y comprobar su presentacion. Cualquier cambio de registro de
aceptacion requiere una entrega tecnica separada; no atribuir esta version a
consentimientos anteriores.

Expediente y decisiones: [Privacidad y preparacion](PILOT_PRIVACY_READINESS.md).
Procedimiento propuesto: [Solicitudes e incidentes](PILOT_PRIVACY_PROCEDURE.md).
