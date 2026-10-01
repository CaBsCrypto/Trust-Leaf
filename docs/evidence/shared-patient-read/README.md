# DEM-SEC-01: autorizacion de lectura compartida

Fecha: 2026-10-01. Rama `fix/shared-patient-read-authorization`.
Base: `803937757d39b448279be82951b6300cf1a431b3`, CI main
[36684088051 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36684088051).
GitHub deployment 6754004213 success y Vercel
`dpl_3zGcaUrauuQRSrFe1u9GUdv2JBj6` Ready/alias oficial reconfirmados.

## Alcance

Migracion incremental `20261001010000_shared_patient_read_authorization.sql`:
el RPC publico conserva firma y acciones. Su implementacion previa se mueve al
schema privado y se revoca para public/anon/authenticated/service_role.
Solo el snapshot de dispensario se intersecta con membresia actual, paciente
activo y vigente, grant y tratamiento vigentes. No se confia en identificadores
de paciente/organizacion enviados por el navegador.

Se retiran tratamiento, grant, perfil y recibos de otras organizaciones cuando
esa autorizacion no existe. Permanecen los recibos propios de la organizacion,
sin que ellos autoricen contactos o tratamiento. Se conservan las politicas
actuales del medico y del paciente y todas las acciones de escritura.
La politica de lectura con medico inactivo sigue separada; no se decide aqui.

## Reproduccion permanente

```powershell
node tests/sql/shared-patient-read.mjs --baseline
node tests/sql/shared-patient-read.mjs
```

PGlite efimero, red bloqueada, identidades UUID sinteticas. Baseline: 14 PASS y
5 fallos esperados (suspended/revoked/expired/valid_until pasado e igualdad).
Candidato: 19/19 PASS. La igualdad usa el reloj de una misma sentencia SQL,
no una espera temporal. Los perfiles y los recibos de un segundo paciente y de
una tercera organizacion permiten detectar un filtro excesivo o insuficiente.

Incluye grants revocados/vencidos, tratamiento revocado y ambos vencimientos,
recibos propios, entrada ajena manipulada, wrapper privado inaccesible,
anon/authenticated denegados y retirada del operador. Los cuatro estados del
medico conservan exactamente la politica baseline. Cada escenario de lectura
compara hashes de todas las tablas privadas, incluidas auditoria e idempotencia;
la lectura no crea, modifica ni elimina registros de negocio.

El runner PostgreSQL independiente incluye cuatro cambios de ciclo del paciente
confirmados en una conexion y leidos desde otra. Su ejecucion queda pendiente
de CI; demuestra retirada despues del commit, no cancelacion de lecturas ya
iniciadas. PGlite no acredita concurrencia entre conexiones.

## Gates y limites

Tipos globales: 0 diagnosticos. Delta de tipos: baseline/current/added 0.
Regresiones locales de operaciones, comercio, equipo, incorporaciones,
dispensary-lifecycle y bloqueo heredado aprobadas. Restaurador de respaldo
sintetico PASS; no equivale a restaurar la base publicada.
Build local PASS (advertencias preexistentes de anotaciones Privy y chunks).
Atenciones PASS: encargado/operador en 360/390/768/1024/1440, Chrome headless con
Playwright del runtime 1.62.1 y respuestas sinteticas locales. Notas medicas PASS:
navegacion, ambos cierres, errores, conflicto, respuesta perdida y retirada de
autorizacion en 320/390/768/1024/1440. Son viewports, no telefono fisico.
Revision final, inventario, CI y preview se registran al completarse.

La consulta remota de historial, solo `version,name`, recibio 401 Unauthorized
al iniciar el login role del CLI. No se ejecutaron exportaciones de datos,
respaldo remoto ni DDL. El usuario renueva la sesion del CLI localmente; no se
solicitan tokens o codigos en el chat. La publicacion permanece bloqueada hasta
comparar historial y funciones, generar respaldo DPAPI actualizado fuera de Git,
verificar restauracion aislada y aplicar exclusivamente esta migracion.

No se modificaron B, Browns, permisos, tratamientos, stock, saldo ni comprobantes
publicados. Borrador mensual excluido, SHA256:
`BDDBAAC808C90B672D5EE72A0F260B8BA23BEA21C2ECA12A2C226728B486BEC8`.
DEM-SEC-01 no se declara cerrado por pasar pruebas locales. Invitaciones externas
y renovacion B siguen pausadas. La QA del agente no acredita autonomia, teclado
movil real ni habilitacion clinica/comercial.
