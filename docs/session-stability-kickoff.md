# F1: inicio de estabilizacion

Fecha: 2026-09-06. Rama: `feat/session-consistency`.
Estado: primer arreglo de agenda validado en browser aislado; F1 sigue abierta.
Marco: [plan maestro](TRUSTLEAF_MASTER_PLAN.md).

## Objetivo del primer bloque

Conservar la agenda persistente entregada y conseguir que identidad, correo,
permisos visibles y resultado de operaciones sean coherentes al cambiar de
cuenta, recargar y usar varias pestanas. No cambiar cupos ni esquema clinico.

## Inspeccion inicial del codigo

- `src/components/ActiveTrustLeafPrivyProvider.tsx`: el bridge llama al SDK en
  cada getIdentityToken y refresca usuario antes del refresh de token. No hay
  coordinacion explicita de solicitudes simultaneas en este bridge.
- `src/components/PrivyAgenda.tsx`: publicar cambia la fecha y, tras guardar,
  incrementa revision; ambos cambios pueden activar lecturas. La cancelacion
  de fetch no cancela necesariamente una obtencion de token ya iniciada.
- El mismo componente conserva un comando pendiente para reintentos; preservar
  su operationId cuando la respuesta se pierda. Nunca reintentar una escritura
  automaticamente para corregir un error de lectura posterior.
- `src/App.tsx` mantiene session y professionalAccess por separado; el portal
  recibe email de session. Auditar la invalidacion de ambos al cambiar subject.
- El fixture browser actual prueba roles en contextos separados: no demuestra
  sincronizacion entre pestanas del mismo contexto ni comportamiento del SDK real.

Estos son puntos de investigacion, no causas finales confirmadas ni arreglos.

## Backlog ordenado

| ID | Trabajo | Criterio de cierre | Estado |
|---|---|---|---|
| F1-01 | Reproducir cambio de subject con respuesta anterior demorada | Ninguna respuesta antigua restaura correo, rol, filas o acciones del usuario anterior | Pendiente |
| F1-02 | Coordinar obtencion/refresco de identidad | Lectores concurrentes no producen una tormenta de refresh; invalidacion segura al salir | Pendiente |
| F1-03 | Separar escritura y refresco de agenda | Guardado confirmado sigue claro ante fallo de GET; recuperar solo lectura | Pendiente |
| F1-04 | Revisar restauracion local y cambio entre pestanas | Cuenta y permisos coinciden tras focus, logout, recarga y cambio de usuario | Pendiente |
| F1-05 | Regresion de cuatro roles y agenda | Autorizados operan, pendientes y roles ajenos reciben denegacion del servidor | Pendiente |
| F1-06 | Inventariar contenido demo operativo | Lista de componentes a migrar, sin borrar Firebase aun utilizado | Pendiente |

Primero reproducir F1-01/F1-03, despues implementar cambios pequenos y probarlos.
No ampliar esta rama a nuevas pantallas, receta, inventario o migraciones SQL.

## Matriz minima de pruebas nuevas

1. Doctor carga agenda; cambia a paciente antes de recibir la respuesta: descartar
   respuesta anterior y bloquear acciones de doctor durante la verificacion.
2. Logout mientras hay una lectura o escritura pendiente: no mostrar su resultado
   en la siguiente cuenta ni ofrecer reintentar su comando desde otra identidad.
3. Dos lectores requieren token simultaneamente: coordinacion y recuperacion de
   error sin conservar una promesa rechazada para siempre.
4. Publicacion exitosa seguida de GET fallido/rate limit: una sola escritura,
   mensaje de guardado y accion de actualizar; sin duplicar slot ni operationId.
5. Respuesta de POST perdida: reintento explicito reutiliza la misma clave;
   resultado definitivo 400/403/409 no ofrece reenvio ambiguo.
6. GET 401: refresco acotado; GET 403: no insistir intentando elevar privilegios.
7. Browser desktop/movil: correo correcto y estados sin solapamiento.
8. Dos pestanas con la misma sesion Privy real: cambiar cuenta y verificar ambas.
   Esta prueba requiere autenticacion humana; fixtures no sustituyen al proveedor.

## Evidencia y gates

Reutilizar `tests/ui/agenda-browser.mjs`, `tests/ui/agenda-sql-browser.mjs` y
`tests/sql/approval-flow.mjs`; ampliar los fixtures para respuestas demoradas y
cambios de identidad. Registrar comando, entorno, resultado y limitaciones.
La evidencia del primer arreglo figura al final; no implica validacion del SDK real.

Hay una migracion mensual local sin seguimiento que los runners SQL pueden
descubrir automaticamente. Ejecutar baseline en un worktree limpio o mediante
un conjunto explicito de migraciones comprometidas; no borrar el borrador ni
atribuir sus fallos a F1. Mantenerlo fuera del commit y del PR.

Salida de F1: revision del diff, pruebas con evidencia, preview con entorno de
prueba identificado y aceptacion manual de sesiones. Solo entonces promover;
no cerrar por build verde. Verificar staging y su aislamiento antes de usarlo.
No se necesita ningun secreto nuevo para preparar estas pruebas.

## Continuidad

Proxima accion: ampliar F1-01 a respuestas demoradas y sesion del portal completo;
coordinar token/refresh en F1-02 y probar Privy real entre pestanas.
Responsable de ejecucion: tarea actual; revision humana: propietario del proyecto.
No hay tareas paralelas ni procesos de validacion ejecutandose por este documento.

## Primer arreglo local: evidencia 2026-09-06

- `tests/ui/session-agenda-browser.mjs`: dos regresiones fallaron antes del cambio
  (comando pendiente persistia al cambiar identidad; lectura fallida sugeria
  operacion no confirmada). Ambas pasan despues del arreglo.
- `PrivyAgenda` reinicia su estado por subject/autenticacion/disponibilidad de
  sesion; cancela solicitudes al desmontar y comprueba cancelacion tras obtener
  token. Esto no revierte una escritura que el servidor ya haya recibido.
- Publicar mueve la fecha visible despues del guardado, junto con la revision,
  evitando disparar la lectura adicional anterior a la escritura.
- Un fallo de refresco conserva el guardado confirmado y pide actualizar, no
  reenviar el comando. Los reintentos explicitos conservan operationId.
- `tests/ui/agenda-browser.mjs`: PASS publicar, recargar, reservar, confirmacion
  del medico, cancelacion y recuperacion de respuesta perdida; desktop/movil.
- Entorno: Edge headless, React real con HTTP interceptado y cuentas ficticias.
  Servidor `vite-session.config.mjs`, loopback 4318, sin plugin SQL ni migraciones.
- Variables para ejecutar: PLAYWRIGHT_MODULE al paquete disponible,
  PLAYWRIGHT_CHANNEL=msedge, AGENDA_FIXTURE_URL=http://127.0.0.1:4318.
  Comandos: `node tests/ui/session-agenda-browser.mjs` y
  `node tests/ui/agenda-browser.mjs`.
- `git diff --check`: sin errores. No se ejecuto build completo, SDK Privy real,
  SQL alojado ni prueba entre pestanas reales. F1-02/F1-04 siguen pendientes.
- Sin deploy, merge, mutaciones de Supabase ni cambios en la migracion mensual.
