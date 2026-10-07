# Consolidacion de evidencia: 2026-10-06

Entrega documental, sin APIs, migraciones, configuracion o permisos nuevos.
Fuente unica de resultados: [tablero](../../DISPENSARY_CLOSEOUT_SPRINT.md#consolidacion-06102026).

## Base verificable

- PR69 integrado: main0d56f3d21de61f324a31eb8ed4415a92890159aa.
- [CI37243688374 aprobado](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/37243688374).
- GitHub deployment6848233409 Production success,2026-10-04T23:26:18Z,
  asociado al SHA anterior. URL registrada:
  https://trustleaf-rolmskcuo-cabscryptocontacto-6028s-projects.vercel.app.
- HEAD publico de www.trustleaf.org/dispensario HTTP200 el06-10.
  Es disponibilidad del HTML publico, no evidencia de autorizacion, cache de
  API privada ni correspondencia del SHA efectivo del alias.
- PR62 OPEN/DRAFT, head45a45f133f3c18f2f18a21a08b45678dcd82a980.

## Metodo y limites

Recorrido del coordinador en navegador interno contra127.0.0.1:4331.
Identidades/contactos completamente sinteticos, mismos paneles del producto,
SQL PGlite y ejecutores existentes. No se publican screenshots autenticados,
tokens, fragmentos de arranque ni datos de B/Browns.

Las ejecuciones recientes fueron registradas en la sesion de herramientas:
test:local-demo, test:shared-patient-read, test:operations-pilot, lint y
tests/ui/shared-patient-read-failure.browser.mjs PASS. El primer intento de
test:local-demo encontro EPERM de procesos; repeticion autorizada PASS.
El primer lint fue interrumpido sin resultado; repeticion posterior PASS.
Esto no implica una compilacion nueva: se reutiliza build/CI de la misma base.

Concurrencia: tests/sql/operations-concurrency.mjs, Node22.22.1/PG18 en WSL,
cluster temporal independiente, loopback55436 y base vacia trustleaf_pilot_test.
Runner rechazo destinos remotos y comprobo transacciones esperando bloqueos.
PASS permisos, retirada, bloqueo de lote, cupo, stock, comercio, aceptacion,
aprobacion/cancelacion e idempotencia. Cluster detenido, base retenida para
revision. No afirmar que se ejecuto contra PostgreSQL hosted ni SQL de la demo.

[Reportes versionados previos](../local-four-actor-demo/README.md) mantienen
su propio alcance/fecha. La navegacion reciente del agente no acredita ensayo
humano, teclado fisico ni autenticacion Privy real.

## Correspondencia demo / producto

| Subsistema | Compartido | Diferencia / validacion restante |
| --- | --- | --- |
| React | OperationsWorkspace, AdminOnboarding, DispensaryOnboarding y gate de equipo existentes | Selector de actor y banner solo en entrada local; demo no importada por producto |
| API/SQL | Ejecutores, contratos y migraciones revisadas del piloto | PGlite temporal versus Supabase/PostgREST; configuracion remota se verifica aparte |
| Identidad | Reglas derivadas de actor/organizacion en SQL | Privy simulado en demo; prueba real historica no equivale a nuevo usuario |
| Correo | Acciones de invitacion y cola del ensayo | Captura en buzon local, sin Resend ni prueba del buzon admin |
| Agenda | Reserva y consulta explicita | Sin Calendar/Meet; no demostrar llamada ni alta profesional |
| Persistencia | Registros se mantienen al recargar/cambiar actor | Reinicio/reset local borra escenario; nube requiere evidencia propia |
| Seguridad | Guard, scopes, limpieza y permisos | Aplicacion local bloquea red; no certificacion OS ni privacy notice |

Los permisos del paciente y el saldo actual deben leerse antes de presentar.
No reutilizar10/20/90 como valores actuales si se reinicia o cambia el escenario.

## Brechas de privacidad (revision, no publicacion)

Documentos revisados: PILOT_PRIVACY_READINESS, PILOT_PRIVACY_NOTICE_DRAFT y
PILOT_PRIVACY_PROCEDURE. Permanecen pendientes: identidad formal del responsable,
canal operativo/ejercicio de solicitud e incidente, conservacion por categoria,
respaldos/logs/colas, condiciones aplicables de proveedores y aprobacion/publicacion.
admin@trustleaf.org es propuesta del PO, no buzon probado por esta entrega.
browns.studio no se transforma en razon social por mencionarlo. No introducir
RUT/domicilio/documentos aqui ni atribuir aceptacion a consentimientos antiguos.

No se emite dictamen legal ni se repite investigacion normativa en esta entrega.
