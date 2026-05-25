# Trust Leaf Main Scrum Plan

Documento maestro para ordenar producto, arquitectura, web3, actores y salida a
mercado. Este archivo es la brujula principal antes de implementar cada sprint.

## North Star

Trust Leaf permite acceso seguro a cannabis medicinal con privacidad clinica,
recetas verificables y medicina trazable por lote.

La red debe demostrar tres cosas:

1. El paciente controla su informacion clinica.
2. Medicos y dispensarios son actores autorizados, no entradas abiertas.
3. La blockchain prueba estados, permisos, hashes y trazabilidad; no almacena
   historiales clinicos completos.

## Objetivo MVP

Construir un flujo grabable y creible donde:

1. medico y dispensario solicitan ingreso;
2. admin aprueba actores validos;
3. paciente crea identidad/wallet y comparte datos privados cuando corresponde;
4. medico emite receta verificable;
5. dispensario valida receta y registra entrega parcial;
6. paciente revisa historial, trazabilidad y permisos.

## Definicion de primer MVP funcional

El proyecto deja de ser prueba de concepto cuando el flujo medico-paciente
funciona de punta a punta:

1. medico aprobado configura disponibilidad;
2. paciente agenda una hora con ese medico;
3. la hora queda bloqueada en el calendario medico;
4. medico y paciente ven la consulta futura;
5. al iniciar la consulta queda registro de atencion;
6. paciente comparte ficha clinica/examenes con el medico;
7. medico genera resumen de consulta;
8. medico emite receta soulbound verificable;
9. paciente recibe receta en su cuenta;
10. paciente muestra QR al dispensario;
11. dispensario valida receta, vigencia y saldo;
12. dispensario entrega parcialmente y registra trazabilidad.

Nota critica: la ficha clinica completa no se sube a blockchain. Se guarda
privada/off-chain. On-chain se registran hashes, permisos, estados, receta
soulbound y eventos verificables.

## Regla de privacidad y seguridad

La decision de arquitectura es **DB cifrada + blockchain verificable**.
Blockchain protege integridad y auditoria, pero no debe usarse como base de
datos medica publica. La base de datos privada puede ser atacada, por eso los
datos clinicos deben guardarse cifrados y con llaves separadas del contenido.

Modelo de seguridad esperado:

1. Si alguien lee la blockchain, solo ve wallets, estados, hashes, vigencias,
   saldos y eventos; no ve diagnostico ni documentos.
2. Si alguien obtiene una copia de la DB, encuentra datos cifrados y metadata
   limitada; no debe poder leer fichas clinicas completas sin llaves.
3. Si un medico o dispensario pierde acceso, los permisos temporales se revocan
   y queda auditoria.
4. Si una autoridad legal requiere informacion, se revela el documento privado
   especifico mediante proceso controlado, y el hash on-chain prueba que no fue
   alterado.

Esta regla es obligatoria para todos los sprints: nunca optimizar la demo a
costa de publicar informacion clinica completa en Stellar/Soroban.

## Documentos anexos

- [Arquitectura de datos](./architecture-data-matrix.md): que va en DB privada,
  que va on-chain y que nunca debe publicarse.
- [Arquitectura Soroban MVP](./soroban-mvp.md): contratos, endpoints y orden
  tecnico de Stellar/Soroban.
- [Schema Supabase MVP](./supabase-mvp-schema.sql): tablas iniciales para
  solicitudes de medicos y dispensarios.
- [Scrum Medico + Admin](./medical-admin-scrum-plan.md): plan detallado para el
  primer sprint critico.
- [Flujo de demo grabable](./go-to-market/demo-recording-flow.md): orden de
  pantallas, clicks y mensajes para grabar el MVP.
- [Go-to-market kit](./go-to-market/README.md): one-pager, deck, negocio,
  finanzas y guion de video.

## Actores

### Paciente

Objetivo: acceder a cannabis medicinal de forma segura, controlar su historial
privado y usar recetas verificables sin exponer datos clinicos completos.

Rutas:

- `/paciente`
- `/paciente/recetas`
- `/paciente/dispensarios`
- `/paciente/retiros`
- `/paciente/historial`
- `/paciente/viajero`

Datos privados:

- perfil;
- wallet/passkey;
- sintomas;
- examenes;
- notas clinicas;
- permisos;
- receta completa off-chain.

Interacciones web3:

- crea o conecta smart wallet;
- recibe receta verificable;
- autoriza permisos 402;
- muestra QR de receta para dispensarios autorizados;
- recibe alertas antes de vencimiento de receta;
- revisa hashes/trazabilidad;
- mantiene saldo de receta para retiros parciales.

Criterios de aceptacion:

- puede entrar sin mezclarse con rutas de medico/dispensario/admin;
- entiende estado de wallet;
- puede buscar medico validado;
- puede ver recetas;
- puede compartir y revocar datos clinicos;
- puede reservar hora con medico validado;
- puede ver consultas futuras y pasadas;
- puede presentar QR sin exponer ficha clinica;
- puede revisar trazabilidad de medicina adquirida.

### Medico

Objetivo: postular a la red, ser aprobado por admin, revisar evidencia
autorizada y emitir recetas verificables.

Rutas:

- `/medico`
- `/medico/operacion`

Datos privados:

- licencia/documentos de alta;
- especialidad;
- contacto;
- pacientes asignados;
- notas clinicas off-chain;
- consultas futuras y pasadas;
- horarios disponibles;
- agenda.

Interacciones web3:

- wallet queda registrada en `DoctorRegistry`;
- firma receta con wallet/passkey en version productiva;
- emite `Prescription` soulbound con hash clinico;
- solicita permisos 402 al paciente.

Criterios de aceptacion:

- no opera como medico live sin aprobacion;
- ve su estado de alta;
- entiende diferencia entre aprobacion DB y registro on-chain;
- puede revisar pacientes con consentimiento;
- puede crear, editar y cerrar disponibilidad horaria;
- puede ver agenda diaria/semanal;
- puede iniciar y cerrar consulta;
- puede generar resumen clinico off-chain;
- receta es una accion dentro del panel medico, no todo el panel.

### Dispensario

Objetivo: postular a la red, ser aprobado, operar inventario y registrar entregas
parciales sin acceder al historial clinico completo.

Rutas:

- `/dispensario`
- `/dispensario/operacion`
- `/dispensario/retiros`
- `/dispensario/historial`

Datos privados:

- documentos legales;
- direccion operativa;
- contacto responsable;
- inventario;
- precios;
- lotes y stock.

Interacciones web3:

- wallet queda registrada en `DispensaryRegistry`;
- valida receta vigente;
- consulta saldo disponible de la receta antes de entregar;
- revisa retiros previos asociados a esa receta, no todo el historial clinico;
- escanea QR del paciente como llave temporal de validacion;
- registra entrega en `DispenseRecord`;
- publica hash de producto/lote/cantidad, no diagnostico.

Criterios de aceptacion:

- no ve diagnostico completo;
- puede cargar inventario por producto/lote;
- valida receta y saldo disponible;
- ve retiros previos relevantes para la misma receta/tratamiento;
- valida QR sin acceder a ficha clinica;
- registra retiro parcial;
- paciente conserva cupo para futuros retiros.

### Admin

Objetivo: mantener la red confiable aprobando actores y preparando altas
on-chain.

Ruta:

- `/admin`

Datos privados:

- solicitudes de medicos;
- solicitudes de dispensarios;
- documentos de validacion;
- notas de revision;
- estados de aprobacion.

Interacciones web3:

- registra medicos en `DoctorRegistry`;
- registra dispensarios en `DispensaryRegistry`;
- monitorea `onchainStatus`;
- revisa transacciones y errores.

Criterios de aceptacion:

- puede aprobar, rechazar o pedir revision;
- distingue DB privada vs registro on-chain;
- ve actores live;
- no expone documentos sensibles;
- prepara flujo para auditoria futura.

### Agentes 402

Objetivo: validar informacion sensible sin exponer documentos completos.

Funciones:

- Compliance Agent: valida licencias y documentos de actores.
- Prescription Agent: valida receta, vigencia y consumo sin revelar diagnostico.
- Eligibility Agent: responde si el paciente puede acceder segun permisos y
  jurisdiccion.

Datos privados:

- documentos cifrados;
- notas clinicas;
- examenes;
- reglas de jurisdiccion;
- permisos temporales.

Interacciones web3:

- publica hash/estado de validacion cuando aporta valor;
- no publica documentos completos;
- no reemplaza consentimiento del paciente.

Criterios de aceptacion:

- cada validacion nombra que dato se valida;
- cada permiso nombra actor receptor;
- todo acceso sensible es temporal y revocable;
- Stellar recibe prueba, no contenido clinico.

## Mapa de datos

### DB privada

Usar Supabase como proveedor recomendado para avanzar el MVP, manteniendo
Firebase como fallback compatible. La UI accede a datos desde una capa
swappable (`trustDataStore`) para permitir migracion futura.

Guarda:

- usuarios y perfiles;
- solicitudes de medicos;
- solicitudes de dispensarios;
- documentos privados;
- historial clinico;
- examenes;
- permisos 402;
- inventario;
- precios;
- metadata administrativa;
- detalle clinico de recetas.
- horarios medicos;
- reservas de consulta;
- resumen de consulta;
- alertas de vencimiento.

### Blockchain

Usar Stellar/Soroban como capa de prueba verificable.

Guarda:

- wallets de medicos autorizados;
- wallets de dispensarios autorizados;
- receta verificable con hash;
- token/receta soulbound no transferible;
- vigencia y estado de receta;
- fecha de expiracion;
- registros de entrega;
- hash de producto/lote;
- cantidad dispensada;
- eventos auditables.

### Nunca on-chain

- diagnostico completo;
- notas clinicas completas;
- imagenes de examenes;
- documentos legales completos;
- informacion personal completa;
- seed phrases o secretos de wallet.

## Mapa web3

### Patient Smart Account

Responsabilidad:

- identidad operativa del paciente;
- firma con passkey;
- respaldo con Freighter;
- recepcion de receta verificable.

Estado:

- MVP tiene capa transicional;
- produccion debe evitar seed phrase como experiencia principal.

### DoctorRegistry

Responsabilidad:

- autorizar que wallets medicas puedan emitir recetas.

Flujo esperado:

1. medico solicita alta;
2. admin aprueba;
3. admin registra wallet on-chain;
4. `onchainStatus = registered`;
5. medico puede emitir receta verificable.

### DispensaryRegistry

Responsabilidad:

- autorizar que wallets de dispensarios puedan validar y registrar entregas.

Flujo esperado:

1. dispensario solicita alta;
2. admin aprueba;
3. admin registra wallet on-chain;
4. `onchainStatus = registered`;
5. dispensario puede registrar entregas.

### Prescription

Responsabilidad:

- representar una receta verificable soulbound vinculada a paciente y medico.

Debe probar:

- paciente;
- medico autorizado;
- hash del tratamiento;
- vigencia;
- estado.
- fecha de expiracion;
- saldo autorizado;
- consumo acumulado.

Pendiente critico:

- soportar saldo parcial por gramos o periodo, para que una receta no se queme
  en una sola transaccion.
- exponer a dispensarios autorizados el saldo restante y retiros previos de la
  receta activa, sin revelar diagnostico ni ficha clinica completa.
- emitir alerta 15 y 10 dias antes del vencimiento para que el paciente pueda
  renovar con el mismo medico u otro medico validado.

### DispenseRecord

Responsabilidad:

- registrar cada entrega de medicina.

Debe probar:

- receta;
- dispensario autorizado;
- producto/lote hasheado;
- cantidad entregada;
- fecha/evento.

Tambien debe permitir reconstruir el consumo acumulado de una receta:

- cantidad autorizada total;
- cantidad retirada previamente;
- cantidad solicitada en la entrega actual;
- saldo restante despues de la entrega.

## Backlog por epicas

### Epic A: Paciente

- Registro y wallet/passkey.
- Busqueda de medicos.
- Reserva de hora medica.
- Consultas futuras y pasadas.
- Historial clinico privado.
- Galeria de examenes.
- Consentimiento temporal.
- Recetas.
- QR de receta para dispensario.
- Alertas de vencimiento.
- Dispensarios autorizados.
- Retiros parciales.
- Trazabilidad.

### Epic B: Medico

- Solicitud de alta.
- Estado de revision.
- Panel profesional.
- Agenda.
- CRUD de disponibilidad horaria.
- Reservas de pacientes.
- Inicio/cierre de consulta.
- Pacientes.
- Solicitud de acceso 402.
- Revision de documentos autorizados.
- Resumen de consulta.
- Emision de receta.
- Historial de recetas emitidas.

### Epic C: Dispensario

- Solicitud de alta.
- Estado de revision.
- Inventario por lote.
- Validacion de receta.
- Saldo disponible.
- Retiros previos por receta/tratamiento.
- Registro de entrega parcial.
- Historial de entregas.
- Trazabilidad para paciente.

### Epic D: Admin

- Revision de medicos.
- Revision de dispensarios.
- Alta manual para demo.
- Aprobacion/rechazo/revision.
- Alta on-chain de actores.
- Monitoreo de estados.
- Auditoria basica.

### Epic E: Web3

- Smart wallet paciente.
- DoctorRegistry.
- DispensaryRegistry.
- Prescription con saldo parcial.
- Prescription soulbound no transferible.
- Vencimiento y renovacion de receta.
- DispenseRecord.
- Consulta de consumo acumulado por receta.
- QR como acceso temporal a validacion.
- Eventos indexables.
- Errores legibles para UI.

### Epic F: Privacidad / Agentes 402

- Consentimiento paciente-medico.
- Permisos por alcance.
- Ventanas 24h.
- Revocacion.
- Hash de integridad.
- Validacion de documentos sin publicar contenido.

## Sprint plan priorizado

### Sprint 1: Medico + admin grabable

Objetivo: demostrar que solo medicos validados entran a la red.

#### Mini Sprint 1A: Puerta medico/admin

Objetivo: cerrar la primera puerta funcional del MVP.

Alcance:

- `/medico` permite solicitar alta con licencia, especialidad, contacto y wallet;
- `/admin` revisa la solicitud y puede aprobar, rechazar o pedir revision;
- `/medico/operacion` queda bloqueado si no existe medico aprobado;
- medico aprobado entra al panel profesional;
- la UI indica que el registro on-chain real sera en **Stellar Testnet**.

Criterio de aceptacion:

1. medico sin aprobacion no puede operar;
2. admin aprueba al medico;
3. medico aprobado entra al panel;
4. estado on-chain queda como pendiente para DoctorRegistry Testnet;
5. ninguna ficha clinica se publica en blockchain.

#### Mini Sprint 1B: Registro DoctorRegistry Testnet

Objetivo: conectar aprobacion admin con alta on-chain real en testnet.

Alcance:

- boton admin "Registrar en DoctorRegistry Testnet";
- firma con cuenta admin de testnet;
- estado `onchainStatus` pasa de `pending` a `registered` o `failed`;
- medico ve si su wallet ya esta autorizada on-chain.

Variable requerida:

- `STELLAR_ADMIN_SECRET`: secret key de la cuenta admin de Stellar Testnet.
  Nunca usar mainnet para este sprint.

#### Mini Sprint 1B-pre: Auth + admin real minimo

Objetivo: evitar que `/admin` sea una ruta abierta antes de tocar registros
on-chain.

Alcance:

- Firebase Auth con email/password para admin;
- documento `appAdministrators/{uid}` como allowlist;
- `/admin` bloqueado si el usuario no esta autenticado o no tiene allowlist;
- fallback demo local visible y separado de uso productivo;
- Firestore guarda solicitudes solo cuando hay usuario autenticado y reglas lo
  permiten.

Setup requerido:

1. Crear usuario admin en Firebase Auth.
2. Copiar su `uid`.
3. Crear documento `appAdministrators/{uid}` en Firestore.
4. Confirmar que `/admin` muestra sesion verificada.
5. Mantener modo demo solo para grabaciones o pruebas locales.

Entregables:

- `/medico` con solicitud clara;
- estado de postulacion;
- `/admin` con revision medica;
- aprobar, rechazar y pedir revision;
- medicos live;
- `onchainStatus` pendiente;
- advertencia si medico intenta operar sin aprobacion.

Demo:

1. medico solicita alta;
2. admin revisa;
3. admin aprueba;
4. medico aparece live;
5. medico entra al panel.

### Sprint 2: Panel medico one-page + agenda

Objetivo: transformar el panel medico en una herramienta real de trabajo, simple
y visual.

#### Mini Sprint 2A: Agenda medica editable

Objetivo: que el medico pueda administrar disponibilidad sin salir de su panel.

Alcance:

- panel medico muestra disponibilidad editable;
- medico agrega bloques de fecha/hora;
- medico alterna un bloque entre disponible y reservado;
- medico elimina bloques;
- paciente agenda usando horarios disponibles;
- al confirmar la reserva, el horario queda reservado en el calendario medico.

Criterio de aceptacion:

1. medico aprobado entra al panel;
2. crea un bloque horario;
3. paciente ve el bloque disponible;
4. paciente reserva;
5. medico ve la consulta como futura/reservada.

#### Mini Sprint 2B: Consulta y resumen clinico

Objetivo: que una reserva pueda convertirse en una consulta atendida antes de
emitir receta.

Alcance:

- medico inicia una consulta reservada;
- sistema muestra que hay consulta en curso;
- paciente comparte datos clinicos de ejemplo por ventana temporal;
- medico redacta resumen clinico off-chain;
- medico cierra consulta;
- resumen pasa como nota base para la receta verificable.

Criterio de aceptacion:

1. consulta reservada tiene boton iniciar;
2. consulta iniciada muestra datos autorizados;
3. medico edita resumen;
4. cerrar consulta cambia estado;
5. receta usa el resumen sin publicar ficha completa on-chain.

#### Mini Sprint 2C: Receta como cierre formal

Objetivo: que la receta sea el resultado final de una consulta cerrada, no un
formulario aislado.

Alcance:

- receta se emite solo despues de cerrar consulta;
- medico define formatos autorizados: flores, aceites, cremas o extractos;
- medico define vigencia y cupo en gramos;
- resumen clinico queda off-chain y genera hash;
- UI muestra comprobante/QR conceptual para paciente y dispensario;
- dispensario valida estado, vigencia, formatos y saldo sin ver ficha completa.

Criterio de aceptacion:

1. boton de emitir queda bloqueado si no hay consulta cerrada;
2. receta muestra categorias autorizadas;
3. receta muestra cupo y vigencia;
4. paciente obtiene comprobante para presentar;
5. dispensario recibe solo lo necesario para validar.

Entregables:

- agenda diaria/semanal;
- CRUD de disponibilidad;
- reservas futuras;
- pacientes vinculados;
- estado de consentimiento del paciente;
- boton iniciar consulta;
- resumen de consulta;
- emision de receta como accion final dentro del mismo panel.

Demo:

1. medico crea horario disponible;
2. paciente agenda hora;
3. horario queda bloqueado;
4. medico ve consulta futura;
5. medico inicia consulta;
6. medico emite receta.

### Sprint 3: Paciente agenda y comparte ficha

Objetivo: que el paciente sea dueño de su ficha y habilite al medico cuando
corresponda.

Entregables:

- busqueda de medicos;
- reserva de hora;
- ficha clinica privada;
- subida de examenes;
- permiso 402 para medico especifico;
- consultas futuras y pasadas.

Demo:

1. paciente elige medico;
2. reserva hora;
3. comparte ficha/examenes;
4. medico ve solo datos autorizados.

### Sprint 4: Receta soulbound verificable

Objetivo: emitir una receta on-chain no transferible, validable por paciente,
medico y dispensario.

Entregables:

- receta soulbound asociada a paciente;
- copia visible para medico y paciente;
- vencimiento por 3, 6 o 12 meses;
- alertas 15 y 10 dias antes del vencimiento;
- QR de validacion;
- hash de resumen clinico, no ficha completa.

Demo:

1. medico cierra consulta;
2. emite receta soulbound;
3. paciente recibe receta;
4. paciente ve QR y vencimiento.

### Sprint 5: Dispensario + admin simetrico

Objetivo: repetir el mismo modelo de confianza para dispensarios.

Entregables:

- `/dispensario` con solicitud clara;
- inventario como promesa principal;
- admin revisa dispensarios;
- dispensarios live;
- `onchainStatus` pendiente.

Demo:

1. dispensario solicita alta;
2. admin aprueba;
3. dispensario carga inventario;
4. queda listo para validar receta.

### Sprint 6: Consentimiento paciente-medico avanzado

Objetivo: hacer visible la privacidad como feature central.

Entregables:

- medico solicita acceso;
- paciente autoriza 24h;
- paciente revoca;
- medico ve solo datos autorizados;
- UI muestra hash/estado 402 conceptual.

Demo:

1. paciente abre historial;
2. autoriza a medico especifico;
3. medico revisa datos;
4. paciente revoca.

### Sprint 7: Receta verificable completa

Objetivo: conectar evaluacion medica con receta verificable.

Entregables:

- receta como accion dentro del panel medico;
- detalle privado off-chain;
- hash on-chain;
- receta visible para paciente;
- dispensario puede validarla.

Demo:

1. medico revisa evidencia autorizada;
2. emite receta;
3. paciente la ve;
4. dispensario valida vigencia.

### Sprint 8: Entregas parciales y trazabilidad

Objetivo: resolver el problema de que una receta no debe quemarse en un retiro.

Entregables:

- saldo por receta;
- cantidad disponible;
- retiros previos visibles para dispensario autorizado;
- retiro parcial;
- registro de lote/cantidad;
- historial y modal de trazabilidad.

Demo:

1. paciente compra 2g de 30g;
2. dispensario registra entrega;
3. otro dispensario autorizado ve que ya hubo retiro previo;
4. sistema calcula saldo restante;
5. paciente ve historial y trazabilidad.

### Sprint 9: Firebase/Auth real

Objetivo: reemplazar fallback local por persistencia segura.

Entregables:

- auth paciente;
- auth medico;
- auth admin;
- admin allowlist;
- reglas Firestore probadas;
- fallback local solo como modo demo.

Demo:

1. solicitud persiste en Firebase;
2. admin autenticado revisa;
3. usuario no admin no accede.

### Sprint 10: Registro on-chain de actores

Objetivo: conectar aprobacion admin con contratos reales.

Entregables:

- endpoint `register-doctor`;
- endpoint `register-dispensary`;
- botones admin;
- transaccion visible;
- `onchainStatus` real.

Demo:

1. admin aprueba actor;
2. admin registra wallet;
3. UI muestra tx;
4. actor queda autorizado on-chain.

### Sprint 11: Hardening para piloto

Objetivo: preparar Trust Leaf para pilotos reales.

Entregables:

- auditoria de reglas;
- auditoria smart contracts;
- manejo de errores;
- logs;
- terminos/compliance;
- documentacion de piloto;
- guion de demo actualizado.

## Criterios de aceptacion globales

Cada sprint debe cumplir:

- `npm run lint` pasa;
- `npm run build` pasa;
- rutas de actores no se mezclan;
- paciente puede entrar de forma simple;
- medicos y dispensarios requieren aprobacion;
- ningun dato clinico completo se publica on-chain;
- los datos clinicos privados quedan modelados como cifrados off-chain, con
  llaves separadas del almacenamiento;
- DB privada y blockchain tienen responsabilidades claras;
- UI puede grabarse en video sin explicar demasiado;
- texto no promete cumplimiento legal universal;
- fallback local no se confunde con produccion.

## Dependencias

- Firebase Auth para pasar de demo a persistencia real.
- Admin allowlist o custom claims para proteger revision.
- Stellar signer/admin para registrar actores.
- Contratos con soporte de saldo parcial.
- Storage cifrado para examenes y documentos.
- Reglas legales por jurisdiccion antes de piloto real.

## Riesgos

- Convertir blockchain en base de datos medica.
- Exponer diagnosticos o documentos completos.
- Permitir que medicos no aprobados operen.
- Hacer el panel medico solo como formulario de receta.
- No bloquear horarios al reservar consulta.
- Subir ficha clinica completa on-chain.
- Emitir receta transferible en vez de soulbound.
- No alertar vencimiento de receta.
- Quemar recetas en un solo retiro.
- Permitir que un dispensario vea mas historial del necesario.
- Mezclar rutas de paciente, medico y dispensario.
- Prometer interoperabilidad global antes de validacion legal.

## Decision actual

El foco inmediato es **Sprint 1: Medico + admin grabable**.

La siguiente implementacion debe mejorar:

1. estado de aprobacion medico;
2. advertencia/bloqueo antes de operar;
3. detalle admin de solicitud;
4. diferencia visual entre DB privada y on-chain pendiente;
5. panel medico como espacio de trabajo, no solo emision de receta.

Despues de Sprint 1, el foco cambia a **Sprint 2: Panel medico one-page +
agenda**, porque ese es el primer paso real para pasar de prueba de concepto a
MVP funcional.
