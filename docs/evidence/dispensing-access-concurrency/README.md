# Entregas frente a cambios de acceso simultaneos

Fecha: 2026-10-01. Rama: `test/dispensing-access-concurrency`.
Alcance: pruebas y documentacion; no correccion funcional, migracion ni escritura
en produccion. No se reprodujo un defecto del producto en estos escenarios.

## Base y estado

Base `2071c4005fd413d33d8b1e801f0d5d6a5e07d87a`, PR58 documental integrado.
CI de main [36828485700](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36828485700)
PASS, comprobado separado del candidato PR58. Deployment GitHub 6778347396
asocia esa base al despliegue Vercel `dpl_BVGBprWsVexHeRi4frDPjWL5xjyj`, Ready,
con alias oficiales comprobados durante el cierre anterior. Esta ejecucion local
no acredita un nuevo despliegue ni repite navegacion autenticada.

Estado de la entrega al corte: validacion local aprobada; revision y CI/preview
del ultimo commit requeridos antes de integrar. Estado de integracion y checks
actualizados en [PR59](https://github.com/CaBsCrypto/Trust-Leaf/pull/59).
El codigo funcional no cambia respecto de esa base.

## Metodo

`npm run test:operations-pilot-concurrency` incorpora
`tests/sql/dispensing-access-races.mjs` al final del runner existente. Se mantiene
su fixture para la comprobacion PostgREST posterior de CI.

- Solo admite base vacia `trustleaf_pilot_test` en localhost. El mensual se excluye.
- Las mutaciones usan los exports RPC publicos actuales bajo `service_role`.
- Primera conexion: RPC dentro de `READ COMMITTED`, sin confirmar aun.
- Segunda conexion: marcador con PID completo antes de la RPC competidora.
  Se leen unicamente lineas terminadas, incluso si un chunk divide el PID.
  Una tercera observa la base, los PIDs exactos y
  `pg_blocking_pids`; debe estar bloqueada por la primera antes de su COMMIT.
- Las carreras nuevas usan timeouts de conexion, sentencia, lock y watchdogs
  de proceso para holder, follower y observador; sus procesos se recogen con `close`.
  El sondeo de 25 ms observa un estado de PostgreSQL; no decide quien gana.
- Se fuerza cada precedencia con fixtures independientes. Los rechazos requieren
  el error de negocio y SQLSTATE, no timeout, deadlock ni error de transporte.

Cada fixture contiene un recibo previo de 500 mg, un lote de 100000 mg y un cupo
de 30000 mg. La nueva entrega ensayada es de 1000 mg. El recibo anterior, su
movimiento y sus proyecciones propias deben conservarse en ambos ordenes.
Antes de competir se exige su ID/cantidad en las filas y ambas proyecciones,
stock 99500 mg y uso 500 mg: la conservacion no puede pasar sin esa semilla.

## Resultados

| Caso | Resultado de la competidora | Estado durable |
| --- | --- | --- |
| Revocacion primero, encargado | `PILOT_GRANT_REQUIRED / 42501` | Sin entrega nueva; stock 99500 mg, uso 500 mg, grant ausente |
| Entrega primero, encargado | Revocacion exitosa | Una entrega nueva; stock 98500 mg, uso 1500 mg, grant ausente |
| Revocacion primero, operador | `PILOT_GRANT_REQUIRED / 42501` | Sin entrega nueva; stock 99500 mg, uso 500 mg, grant ausente |
| Entrega primero, operador | Revocacion exitosa | Una entrega nueva; stock 98500 mg, uso 1500 mg, grant ausente |
| Retirada primero | `PILOT_FORBIDDEN / 42501` | Sin entrega nueva; membresia ausente y snapshot operativo vacio |
| Entrega primero, retirada despues | Retirada exitosa | Una entrega nueva; membresia ausente y recibos propios conservados |
| Bloqueo del lote primero | `PILOT_STOCK_OR_QUOTA_CONFLICT / PT409` | Sin entrega nueva; lote bloqueado, stock 99500 mg |
| Entrega primero, bloqueo con version anterior | `PILOT_VERSION_CONFLICT / PT409` | Una entrega nueva; el bloqueo antiguo no aparenta exito |

En el ultimo caso, una accion explicita nueva con version actual aplica el
bloqueo sin alterar movimientos, entregas, tratamiento ni periodos. Todos los
casos rechazan entregas nuevas posteriores. Un intento fallido no deja journal
de exito. Replay del ID y payload ya confirmados recupera el mismo recibo, sin
descuento ni auditoria adicional; cambiar el payload de ese ID genera conflicto.
La recuperacion del journal SQL no reactiva una membresia ni permite otra entrega.

Se comparan filas completas de tratamientos, periodos y recibos previos; conteos
de movimientos, stock, consumo, version, journal y audit. Paciente y organizacion
conservan sus recibos; el operador retirado pierde listas protegidas y mantiene
el contrato existente de membership compuesto con campos nulos.

## Ejecuciones y revisiones

Tres ejecuciones consecutivas completas de la version final: **8/8 carreras
nuevas PASS por ejecucion**, ademas de la suite previa (cupo, stock, reintentos,
comercio, equipo, incorporacion y cuatro retiradas de lectura post-commit).

Runtime local: WSL Ubuntu, Node 22.22.1, PostgreSQL 18.6. Tres clusters nuevos
en 127.0.0.1:55441/55442/55443; todos detenidos al terminar, sin borrar sus datos.
No se uso el cluster local existente en 5432 ni Supabase remoto.
CI configura PostgreSQL 17: su resultado es una comprobacion adicional pendiente,
no se atribuye la version 17 a estas ejecuciones locales.

Logs locales fuera de Git: `review-artifacts/dispensing-access-concurrency-20261001/verified-run-{1,2,3}.log`.
Los tres tienen SHA256 `813FE0046D1B57352A61582956FAA520E208630BBA499EF59042F2D3C0DA940C`.
[Resumen sintetico de una ejecucion](postgresql-local.txt).

Regresiones locales: tipos y compilacion PASS; API operaciones 8/8, comercio
5/5, onboarding 15/15 entrada + 5/5 API + SQL PASS, operaciones SQL PASS y lectura
compartida 19/19 PASS. PGlite no sustituye las pruebas multiconexion anteriores.
Build conserva advertencias de dependencias/anotaciones y tamano de chunks; no
son errores nuevos de esta entrega.

Seis misiones: Seguridad revisa locks/rechecks/replay; Dispensario contrasta
stock/version/journal y compatibilidad PostgREST; Calidad revisa atribucion de
locks y cleanup; Medico ejecuta operaciones SQL; Paciente ejecuta lectura
compartida y revisa recibos previos; Admin ejecuta incorporacion y conserva su
puerta de privacidad/contacto. El coordinador es el unico editor, controla Git y
consolida resultados. Las revisiones de agente no equivalen a aprobacion humana.
La revision de Calidad del primer candidato `cc21095` exigio mejorar framing,
atribucion por PID, limites de procesos y precondiciones del recibo; se corrigieron
en este candidato. CI 36940213121 PASS y preview del primer candidato no se
atribuyen automaticamente al ultimo commit: este requiere sus propios checks.

## Limites y siguiente puerta

Esto cierra cobertura de `revoke-grant`, retirada de operador y bloqueo de lote
frente a una entrega bajo `READ COMMITTED`; no todas las combinaciones de lifecycle,
caducidad o aislamiento. Revocacion del tratamiento, politica de medico inactivo,
UI Stellar heredada y mensajes confusos mantienen su alcance separado.

No demuestra gateway alojado, autonomia humana ni teclado/celular fisico.
Privacidad minima, revision de Meet, destinatario compatible y acompanamiento
siguen pendientes antes de invitar a un equipo externo. No habilita actividad
clinica/comercial real. B y Browns no se modifican.
Mensual fuera del commit, SHA256
`BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8` intacto.
