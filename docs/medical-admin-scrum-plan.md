# Trust Leaf Scrum Plan: Medico + Admin

Este plan organiza el siguiente bloque de producto: convertir el alta de
medicos y la operacion admin en un flujo confiable, demostrable y listo para
evolucionar hacia produccion.

## Objetivo del bloque

Construir el primer flujo real de confianza de Trust Leaf:

1. El medico solicita ingreso.
2. Admin revisa la solicitud.
3. Admin aprueba, rechaza o pide revision.
4. El medico aprobado queda habilitado en el MVP.
5. La wallet del medico queda preparada para registrarse en `DoctorRegistry`.
6. El medico puede operar su panel y emitir recetas verificables.

El siguiente paso despues del alta es que el medico tenga un panel one-page de
trabajo: agenda, disponibilidad, pacientes, consultas, consentimiento y receta
en una sola experiencia simple.

## Product Owner View

La pregunta que debe responder esta etapa:

> Como Trust Leaf, podemos demostrar que solo medicos validados entran a la red
> y que su aprobacion puede conectarse con una prueba on-chain.

## Scrum Roles

- **Product Owner:** define qué significa "medico valido" y que debe verse en el demo.
- **Scrum Master:** ordena sprints, bloqueos, criterios de aceptacion y dependencias.
- **Engineering:** implementa persistencia, UI, reglas, integracion on-chain y pruebas.
- **Compliance/Medical Advisor:** revisa que licencia, documentos y copy no prometan mas de lo permitido.

## Epics

### Epic 1: Onboarding medico

Permitir que un medico postule con datos minimos y entienda que entra a una red
regulada.

Secciones:

- hero de registro medico;
- formulario de solicitud;
- estado de postulacion;
- explicacion de datos privados/off-chain;
- llamada a revisar admin;
- acceso al panel solo cuando corresponda.

Historias:

- Como medico, quiero enviar mi licencia, especialidad, contacto y wallet para solicitar alta.
- Como medico, quiero saber si mi solicitud esta pendiente, en revision, aprobada o rechazada.
- Como medico aprobado, quiero entrar al panel profesional.
- Como medico no aprobado, quiero entender que aun falta revision antes de emitir recetas.

Criterios de aceptacion:

- El formulario no permite enviar datos incompletos.
- La solicitud aparece inmediatamente en admin.
- El estado se mantiene al recargar el navegador en modo demo.
- La UI explica que documentos sensibles quedan off-chain.
- El boton de panel medico muestra advertencia si no hay aprobacion.

### Epic 2: Admin medico

Permitir que admin revise solicitudes y mantenga una red medica confiable.

Secciones:

- resumen de solicitudes pendientes;
- listado de solicitudes;
- detalle de medico;
- acciones: aprobar, rechazar, pedir revision;
- estado DB privada;
- estado on-chain;
- lista de medicos live;
- alta manual para preparar demos.

Historias:

- Como admin, quiero ver todas las solicitudes medicas.
- Como admin, quiero aprobar un medico valido.
- Como admin, quiero rechazar un medico invalido.
- Como admin, quiero pedir revision si faltan documentos.
- Como admin, quiero ver si el medico ya esta registrado on-chain.

Criterios de aceptacion:

- Cada solicitud muestra licencia, especialidad, contacto y wallet.
- Admin puede cambiar estado sin perder datos.
- Un medico aprobado aparece en "medicos live".
- La tarjeta muestra `onchainStatus`: pendiente, registrado o error.
- La pantalla deja claro que la aprobacion DB no es lo mismo que alta on-chain.

### Epic 3: DoctorRegistry on-chain

Conectar la aprobacion admin con Stellar/Soroban.

Secciones:

- boton "Registrar en DoctorRegistry";
- confirmacion de wallet;
- llamada a backend;
- resultado de transaccion;
- `onchainStatus`;
- hash/tx visible para demo.

Historias:

- Como admin, quiero registrar la wallet de un medico aprobado en DoctorRegistry.
- Como admin, quiero ver si la transaccion fue exitosa o fallo.
- Como medico, quiero saber si mi wallet ya esta autorizada on-chain.

Criterios de aceptacion:

- Solo medicos aprobados pueden intentar registro on-chain.
- Si falta secret/admin signer, la UI muestra "pendiente de configuracion".
- Si la transaccion pasa, `onchainStatus = registered`.
- Si falla, `onchainStatus = failed` y se muestra razon entendible.
- No se suben documentos clinicos ni licencias completas a Stellar.

### Epic 4: Panel medico operativo

Transformar el panel medico en una herramienta de trabajo, no solo una pantalla de receta.

Secciones:

- agenda / disponibilidad;
- CRUD de horarios disponibles;
- reservas futuras;
- consultas pasadas;
- pacientes asignados;
- solicitudes de acceso a historial;
- documentos compartidos por paciente;
- resumen de consulta;
- emision de receta;
- historial de recetas emitidas;
- estado de signer/wallet.

Historias:

- Como medico, quiero definir horarios disponibles.
- Como medico, quiero editar o eliminar horarios disponibles.
- Como medico, quiero que una reserva bloquee automaticamente ese horario.
- Como medico, quiero ver mis consultas futuras y pasadas.
- Como medico, quiero iniciar una consulta y dejar registro de que comenzo.
- Como medico, quiero guardar un resumen de consulta.
- Como medico, quiero ver pacientes que compartieron informacion conmigo.
- Como medico, quiero solicitar acceso a historial clinico.
- Como medico, quiero emitir una receta solo cuando tengo evidencia suficiente.
- Como medico, quiero ver mis recetas emitidas.

Criterios de aceptacion:

- El medico ve un panel de trabajo antes de emitir receta.
- La receta es una accion dentro del panel, no todo el panel.
- La agenda permite crear, editar y cerrar disponibilidad.
- Una reserva de paciente bloquea el horario correspondiente.
- Cada consulta tiene estado: futura, en curso, finalizada.
- El resumen de consulta queda off-chain y puede generar hash verificable.
- El medico no ve datos clinicos si el paciente no autorizo acceso.
- La UI muestra claramente qué datos vienen de consentimiento privado.

### Epic 5: Consentimiento paciente-medico

Permitir que el paciente comparta historial y examenes con un medico especifico.

Secciones:

- solicitud de acceso del medico;
- aprobacion del paciente;
- ventana temporal 24h;
- revocacion;
- hash/estado verificable;
- galeria de examenes compartidos.

Historias:

- Como medico, quiero pedir acceso a sintomas/examenes de un paciente.
- Como paciente, quiero aprobar acceso temporal a un medico especifico.
- Como paciente, quiero revocar acceso.
- Como medico, quiero ver solo los datos autorizados.

Criterios de aceptacion:

- El permiso nombra al medico receptor.
- El paciente ve duracion y alcance del permiso.
- Revocar cambia el estado visual.
- La informacion clinica completa no se publica on-chain.

## Sprint Plan

### Sprint 1: Flujo medico/admin completo en demo

Objetivo: que el flujo se pueda grabar sin blockchain real.

Entregables:

- mejorar pagina `/medico`;
- bloquear/advertir panel si no hay aprobacion;
- mejorar `/admin` para revisar solicitudes;
- mostrar DB privada vs on-chain pendiente;
- mantener fallback local.

Demo:

1. medico solicita alta;
2. admin ve solicitud;
3. admin pide revision o aprueba;
4. medico aprobado entra al panel;
5. admin ve medico live.

### Sprint 2: Preparacion Firebase/Auth

Objetivo: pasar de demo local a persistencia real.

Entregables:

- definir roles de auth;
- crear admin allowlist;
- guardar solicitudes en Firebase con reglas seguras;
- mantener fallback local solo para demo.

Demo:

1. solicitud persiste en Firebase;
2. admin autenticado puede revisar;
3. usuario no admin no puede leer solicitudes.

### Sprint 3: DoctorRegistry

Objetivo: conectar aprobacion admin con contrato.

Entregables:

- endpoint backend `register-doctor`;
- boton admin para registrar wallet;
- actualizar `onchainStatus`;
- mostrar tx/hash.

Demo:

1. admin aprueba medico;
2. admin registra en DoctorRegistry;
3. UI muestra "Registrado on-chain";
4. medico entra con estado autorizado.

### Sprint 4: Panel medico real

Objetivo: que el medico tenga un espacio de trabajo completo.

Entregables:

- agenda;
- CRUD de disponibilidad;
- reservas futuras y pasadas;
- bloqueo automatico de horario reservado;
- pacientes;
- solicitud de acceso 402;
- documentos compartidos;
- inicio/cierre de consulta;
- resumen de consulta;
- receta como accion final.

Demo:

1. medico define horario;
2. paciente agenda una hora;
3. horario queda bloqueado;
4. medico inicia consulta;
5. paciente comparte historial;
6. medico revisa evidencia;
7. medico guarda resumen;
8. medico emite receta.

## Backlog priorizado

1. Mejorar `/medico` con estado de aprobacion y secciones claras.
2. Mejorar `/admin` con detalle de solicitud y estados DB/on-chain.
3. Bloquear o advertir entrada a `/medico/operacion` sin aprobacion.
4. Agregar boton "Pedir revision" ya visible en admin.
5. Preparar endpoint `register-doctor`.
6. Agregar `onchainStatus` real.
7. Crear auth/admin real.
8. Crear consentimiento paciente-medico.
9. Agregar agenda medica.
10. Convertir receta en una feature dentro del panel medico.
11. Bloquear horarios reservados.
12. Agregar historial de consultas futuras/pasadas.
13. Agregar resumen de consulta off-chain + hash verificable.

## Definition of Done

Una historia esta lista cuando:

- funciona en demo local;
- no rompe `npm run lint`;
- no rompe `npm run build`;
- deja claro que datos clinicos/documentos quedan off-chain;
- no mezcla rutas de paciente, medico, dispensario y admin;
- tiene copy entendible para grabar video;
- mantiene preparado el puente a blockchain sin fingir que ya esta productivo.

## Riesgos

- Confundir aprobacion admin con registro on-chain.
- Exponer datos medicos en UI equivocada.
- Hacer el panel medico solo como formulario de receta.
- Depender de Firebase Auth antes de que el demo este estable.
- Prometer operacion clinica real antes de auditoria/compliance.

## Recomendacion inmediata

Ejecutar Sprint 1 antes de conectar mas infraestructura. El flujo medico/admin
debe sentirse completo y grabable primero. Luego conectamos Firebase real y
DoctorRegistry.
