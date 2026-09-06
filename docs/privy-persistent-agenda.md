# Agenda persistente con Privy

## Alcance

- El portal medico y la vista Medicos del paciente usan `PrivyAgenda` cuando Privy esta habilitado. La agenda antigua queda solo para el modo heredado/demo.
- La API `/api/agenda` verifica el token Privy y el rol activo en servidor. Solo el servidor puede ejecutar `trustleaf_privy_agenda`; el SQL vuelve a verificar rol y vigencia.
- Medico: publicar un horario futuro, listar sus horarios/citas y retirarlos o cancelar una cita.
- Paciente: listar horarios disponibles, reservar, consultar sus citas y cancelar. La cancelacion del paciente libera el horario; la del medico lo retira.
- La fecha/hora se captura en la zona del navegador (visible), se transmite como ISO con UTC y se almacena como timestamptz.
- Ventana visible de siete dias, consultas SQL limitadas a 31 dias/200 filas. Un exceso devuelve error; no se ocultan filas silenciosamente.
- Solo referencias opacas y horarios. No se publican correos, datos clinicos ni el expediente profesional. El paciente distingue medicos por referencia hasta contar con un perfil publico aprobado.

## Integridad

- Locks transaccionales por medico, paciente y operacion; version esperada para cambios de estado.
- Indice unico parcial: como maximo una reserva confirmada por horario. Las canceladas se conservan.
- Reintentos manuales conservan operationId e intencion. No se repiten escrituras automaticamente. Si se pierde la pagina tras una respuesta incierta, consultar el estado antes de repetir.
- Se rechazan solapes de horarios de un medico y de citas confirmadas de un paciente.
- Los escritores SQL antiguos de agenda pierden execute para authenticated, para que no omitan esos controles.

## Validacion

- `npm run qa:synthetic-actors`: incluye autorizacion HTTP, categorias de error y ausencia de reintentos de escritura.
- `npm test --prefix tests/sql`: aplica todas las migraciones a PostgreSQL aislado/PGlite; prueba reservas competidoras, reenvio, permisos, cancelacion y nueva reserva. PGlite serializa las consultas; no sustituye una prueba multiconexion en PostgreSQL alojado.
- `npm install --prefix tests/sql`, `npm install --prefix tests/ui` y `npm run dev --prefix tests/ui`: fixture local en 127.0.0.1:4317 con PostgreSQL efimero, sin credenciales reales ni acceso a produccion. `?role=doctor` y `?role=patient` seleccionan identidades ficticias en ese entorno aislado.
- `node tests/ui/agenda-browser.mjs`: componente React real con HTTP simulado. Requiere Playwright; admite PLAYWRIGHT_MODULE y PLAYWRIGHT_CHANNEL. Capturas en scratch/agenda-qa.
- `node tests/ui/agenda-sql-browser.mjs`: navegador y HTTP locales contra las migraciones SQL reales, con identidades ficticias. Verifica publicacion, persistencia al recargar, reserva compartida y cancelacion; no valida tokens reales de Privy.

## Despliegue y comprobacion real pendiente

Aplicar `20260906090000_privy_persistent_agenda.sql` antes de publicar el frontend. No borrar historial ni marcar migraciones como aplicadas sin ejecutarlas.

1. Medico aprobado entra en /medico y publica un horario de prueba futuro.
2. Paciente activo entra en /paciente, abre Medicos y reserva ese horario.
3. Recargar ambas sesiones: la referencia de reserva debe coincidir.
4. Otro paciente no ve detalles de esa cita ni puede reservar el mismo bloque.
5. Cancelar desde paciente libera el horario; desde medico lo retira.

La agenda no implica que consulta clinica, videollamada, receta, pagos o retiros esten conectados. Esos recorridos siguen fuera de este incremento.
