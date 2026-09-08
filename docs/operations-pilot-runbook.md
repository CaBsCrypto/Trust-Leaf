# Piloto operativo: ejecucion y limites

Estado: implementacion local, flags de activacion deshabilitados por defecto.
Hoja de ruta unica: [TRUSTLEAF_MASTER_PLAN.md](TRUSTLEAF_MASTER_PLAN.md).

## Pruebas locales

1. Instalar las dependencias del proyecto y `npm ci --prefix tests/sql --ignore-scripts`.
2. Ejecutar `npm run qa:operations-pilot` y `node tests/sql/approval-flow.mjs`.
3. Ejecutar `npm run qa:operations-types`, `npm run lint` y `npm run build`.
   El chequeo delta informa deuda existente: NO convierte un lint fallido en verde.
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
No se ejecuta automaticamente en QA ni destruye una base existente.

## Integracion alojada

- Comparar HEAD/main/deployment y migraciones aplicadas. No reparar el historial
  ni incluir el borrador sin registrar `20260906120000_monthly_dispensing_quota.sql`.
- Probar primero en un proyecto/base aislados con respaldo y restauracion revisados.
  La nueva migracion es `20260909010000_operations_pilot.sql`; no depende del borrador.
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
- Pendientes antes de declarar cierre: lint global limpio, concurrencia real,
  prueba alojada de identidades, restauracion y aceptacion de cada POV.
- Pendientes antes de pacientes reales: base juridica sanitaria, verificacion de
  profesionales/establecimientos, cifrado y retencion de fichas, recuperacion y
  privacidad de llamadas. Ninguna pantalla del piloto emite una receta legal.
