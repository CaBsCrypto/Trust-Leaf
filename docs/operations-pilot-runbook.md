# Piloto operativo: ejecucion y limites

Estado al 2026-09-08: PR #16 integrado a main (`2477c44`), respaldo restaurado
y migracion aplicada. Flags true y despliegue activo confirmados.
Aceptacion del recorrido con cuentas separadas pendiente.
Hoja de ruta unica: [TRUSTLEAF_MASTER_PLAN.md](TRUSTLEAF_MASTER_PLAN.md).

## Corte de entrega

- CI main [34191628264](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/34191628264)
  aprobado: tipos, SQL, conexiones PostgreSQL independientes y navegador sintetico.
- Vercel `dpl_GkQNnu37QcJwndhjTFFJZ91Djb72` Ready, alias oficial verificado.
- Cuatro accesos anonimos cargan y habilitan Privy sin errores JS; API sin sesion
  devuelve 401. Con header de prueba y piloto apagado devuelve 503 `PILOT_DISABLED`.
- Los resultados 401/503 anteriores corresponden al despliegue INACTIVO de referencia.
- Respaldo explicitamente autorizado: `application-20260908-025819.dpapi` en
  `D:\00 CODEX - OPENIA\.backups\trustleaf`, DPAPI CurrentUser, fuera de Git.
  Restauracion aislada: 18 tablas/68 registros. Limitaciones y hash en plan maestro.
- Supabase tiene 26 migraciones: solo se agrego `20260909010000` y su historial
  atomicamente. Las 13 tablas nuevas tienen RLS forzado; RPC solo service_role.
  No se crearon participantes ni entregas. El borrador mensual permanece excluido.
- Activacion Ready: `dpl_3LBmhuSrU8hrkMm7L5eGD6kJZGEd`, codigo main `8431b6e`.
  La URL oficial conserva 401 sin sesion y muestra "Supervision del piloto" a la
  sesion admin real, con "Aceptar y participar". No se acepto ese paso por el usuario.
- Siguiente orden: participacion explicita y recorrido con cuentas por actor.
  Matriz de resultados en el plan maestro. Nunca sustituir aceptacion por CI.

## Pruebas locales

1. Instalar las dependencias del proyecto y `npm ci --prefix tests/sql --ignore-scripts`.
2. Ejecutar `npm run qa:operations-pilot` y `node tests/sql/approval-flow.mjs`.
3. Ejecutar `npm run qa:operations-types`, `npm run lint` y `npm run build`.
   El lint global debe pasar; el chequeo delta no sustituye ese requisito.
4. Instalar dependencias de `tests/ui` y ejecutar desde la raiz:
   `node node_modules/vite/bin/vite.js --config tests/ui/vite-operations.config.mjs`.
5. Abrir `http://127.0.0.1:4321/?operations&role=doctor`; roles de fixture:
   `patient`, `dispensary`, `dispensaryB`, `operator`, `admin`, `otherDoctor`, `otherPatient`.
   Cada uno tiene contexto de navegador propio. Son identidades ficticias locales,
   no usuarios Privy. El servidor no lee claves ni envia correos.
6. Con Playwright instalado o `PLAYWRIGHT_MODULE` apuntando al paquete,
   ejecutar `node tests/ui/operations-browser.mjs`. Requiere Chrome o
   `PLAYWRIGHT_CHANNEL`. Reiniciar el servidor entre ejecuciones: la base es efimera.
   Capturas en `scratch/operations-qa` (excluido de Git/Vercel).

## Concurrencia real

PGlite no acredita conexiones independientes. El runner
`npm run test:operations-pilot-concurrency` exige `psql` y
`PILOT_TEST_DATABASE_URL` de una base VACIA llamada `trustleaf_pilot_test` en
localhost. Rechaza Supabase, hosts remotos, otros nombres y bases con tablas.
Aplica el esquema y compite por 20g + 20g contra 30g: solo una transaccion debe
confirmar; el stock total debe bajar 20g. Conserva la base para inspeccion.
Se ejecuta en CI con PostgreSQL 17 efimero, sin credenciales de produccion.
No destruye una base existente. La barrera observa ambas sesiones bloqueadas antes
de liberarlas, y cubre tambien stock compartido, reintentos identicos, permisos,
vencimientos, cuarentena y retiro del operador.

## Integracion alojada

- Comparar HEAD/main/deployment y migraciones aplicadas. No reparar el historial
  ni incluir el borrador sin registrar `20260906120000_monthly_dispensing_quota.sql`.
- Probar primero en un proyecto/base aislados con respaldo y restauracion revisados.
  La nueva migracion es `20260909010000_operations_pilot.sql`; no depende del borrador.
- Si no hay respaldo restaurable en Supabase, obtener aprobacion explicita antes
  de exportar datos privados. `scripts/backup-operations-application.ps1` guarda
  solo un archivo DPAPI CurrentUser fuera del repositorio y lo restaura en memoria
  con `tests/sql/verify-application-backup.mjs`. Es un respaldo logico de aplicacion,
  no de Auth/Storage/Vault; su llave depende del usuario de Windows.
- `node tests/sql/application-backup-test.mjs` prueba el restaurador con datos
  ficticios. Nunca subir respaldos de produccion a CI ni usarlo como prueba real.
- Habilitar `TRUSTLEAF_OPERATIONS_PILOT_ENABLED=true` exclusivamente en servidor
  y `VITE_OPERATIONS_PILOT_ENABLED=true` en el build del entorno elegido.
- Supabase y Privy conservan sus claves privadas existentes; no hay token ficticio
  ni bypass de login habilitable en el bundle de produccion.
- Repetir solicitud/aprobacion con usuarios separados; aceptar el piloto en cada
  cuenta. El paciente debe participar antes de iniciar una consulta vinculada.
- Un dispensario crea su organizacion. Otro usuario dispensario aprobado comparte
  su referencia en Equipo; el encargado lo agrega como operador. El operador no
  recibe permisos de encargado por asociarse, y la remocion bloquea nuevas entregas.
- Publicar/reservar en Agenda; iniciar consulta, guardar nota ficticia y finalizar
  con o sin tratamiento. No se cambia la cita a completada por abrir Meet.
- Para el caso de tratamiento: 30g, tres periodos; recibir stock en A y B; el
  paciente autoriza cada organizacion por 24h; entregar 10g y 20g, revisar saldo e
  historial y revocar el permiso. Intentar mas cantidad y acciones entre roles.
- Verificar tambien vencimiento, cuarentena, operador retirado, sesion expirada,
  error de lectura tras escritura y reintento de respuesta perdida.

## Recuperacion, privacidad y pendientes

- Deshabilitar primero el flag del servidor para detener operaciones nuevas.
  No eliminar las tablas, notas, entregas ni movimientos como rollback.
- Con flag UI activo y API deshabilitada se muestra indisponibilidad; no se cambia
  silenciosamente a Firebase ni a un almacen en memoria.
- Operaciones criticas: UUID idempotente, digest de intencion, version de recursos,
  locks por paciente y lote, descuento de stock/saldo en una transaccion.
- Notas y entregas no tienen endpoints de edicion/eliminacion. Stock se corrige
  con movimientos y motivo; no devuelve cupo ni borra comprobantes.
- Los borradores de notas son privados del medico. El paciente accede al historial
  de notas de su atencion una vez finalizada, no mientras se esta redactando.
- API privada sin cache; refrescos cada 15s, al volver a foco y al reconectar.
  No afirmar sincronizacion instantanea basada en Realtime.
- La supervison admin no devuelve notas ni tratamientos. Dispensarios ven datos
  minimos autorizados; tras revocacion conservan solo sus propios comprobantes.
- Tipos, concurrencia PostgreSQL y respaldo/restauracion de aplicacion ya pasaron.
  Pendientes antes de declarar cierre: recorrido alojado completo y aceptacion de
  cada POV. La recuperacion completa del servicio sigue siendo un gate de uso real.
- Pendientes antes de pacientes reales: base juridica sanitaria, verificacion de
  profesionales/establecimientos, cifrado y retencion de fichas, recuperacion y
  privacidad de llamadas. Ninguna pantalla del piloto emite una receta legal.
