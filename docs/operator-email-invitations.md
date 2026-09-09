# Invitaciones de operadores por correo

## Alcance

Encargado invita por correo, trabajador verifica ese correo con Privy y acepta
en `/dispensario`. La invitacion autoriza solamente el rol de operador en esa
organizacion. No crea un establecimiento ni necesita otra aprobacion de admin.
Este cambio sigue limitado al piloto con datos ficticios.

## Implementacion

- API tipada `/api/team-invitations`: `list`, `create`, `resend`, `cancel`,
  `retry-send`, `inspect` y `accept`. Identidad siempre obtenida del token Privy.
- Para aceptar, se consulta el usuario actual en Privy y se comparan solo emails
  verificados. No se utiliza el email enviado por el cliente ni el cache del JWT.
- Correo cifrado con AES-256-GCM; huella HMAC para comparaciones sin texto plano.
  Secreto aleatorio de 256 bits, hash SHA-256 en la invitacion, vigencia de 7 dias.
- El enlace usa un fragmento; el navegador lo retira de la barra y conserva la
  invitacion en sessionStorage durante el login. No se coloca en query strings,
  logs, eventos publicos o mensajes clinicos. Abrir no acepta.
- La migracion `20260909030000_operator_invitations.sql` agrega tablas privadas
  para invitaciones, envios, idempotencia, webhooks y restriccion permanente de
  trabajador. Conserva miembros y marca operadores existentes como staff-only.
- Aceptacion atomica y serializada con altas/retiros: verifica encargado vigente,
  cuenta, vencimiento y membresia, crea/resuelve actor, incorpora al piloto,
  asigna operador y audita. No reactiva cuentas ni traslada miembros de otra org.
- `add-operator` por UUID queda prohibido en API y SQL, incluso con el flag apagado.
  El antiguo ejecutor queda privado; el wrapper mantiene los contratos clinicos.
  Un trabajador retirado no puede crear un dispensario ni ascender a encargado.
- Equipo muestra emails, roles, invitaciones y estado de envio. Las vistas se
  actualizan tras cambios, cada 15 segundos visibles y al recuperar foco/conexion.
  Cambiar de identidad desmonta y cancela solicitudes de la sesion anterior.

## Envios y recuperacion

La transaccion guarda primero la invitacion y el envio cifrado. La API intenta
despacharlo inmediatamente. Si el proceso termina antes, queda en cola y el
encargado usa **Reintentar envio**; no hay un cron nuevo ni envio periodico oculto.

Cada envio tiene una clave estable `team/<mail_ref>` y un lease. Reintentar una
respuesta perdida utiliza el mismo contenido y clave. Tras 23 horas desde el
primer intento se bloquea el reintento automatico de ese envio: se necesita
conciliacion con el proveedor o reenvio explicito. Reenviar crea una generacion
nueva e invalida el enlace anterior. Cancelar impide aceptar tambien los enlaces
de correos que ya llegaron. Los mensajes ya enviados no se pueden retirar.

Limites predeterminados: 20 invitaciones/envios distintos por organizacion y
3 por destinatario en ventana movil de 24 horas; minimo 60 segundos entre envios
al mismo destinatario y entre intentos del mismo envio. Un reintento idempotente
no crea otro correo. No se contrata ni aumenta automaticamente un plan de pago.

Webhook `/api/team-mail-webhook`: cuerpo crudo y firma Svix mediante SDK Resend.
Rechaza firmas falsas, deduplica eventos y no rebaja un estado entregado por un
evento enviado tardio. Si llega antes de registrar el resultado del envio,
responde 503 para que Resend reintente sin perder el evento.

La cuenta de Resend es compartida: cada invitacion lleva etiquetas estaticas
`app=trustleaf` y `category=operator_invitation`, sin datos personales. Despues
de verificar la firma, el webhook exige ambas y el remitente exacto. Los eventos
ajenos reciben 200 sin consultar ni escribir la base y sin registrar su payload.
El filtro no evita que Resend envie metadatos de otros proyectos al endpoint;
una cuenta independiente seria necesaria para aislar tambien ese transporte.

Estados: en cola, enviando, enviado, entregado al servidor receptor, demorado,
fallido, incierto, rechazado y cancelado. Ninguno acredita lectura del correo.

## Configuracion del proveedor

Estado comprobado el 2026-09-09:

- Dominio `trustleaf.org` Verified, plan gratuito, MX raiz de Zoho conservados.
- `RESEND_API_KEY` restringida a envios de ese dominio, `RESEND_WEBHOOK_SECRET`
  y `TEAM_INVITATION_ENCRYPTION_KEY` guardadas como secretos de Production en
  Vercel. Clave de cifrado independiente de 32 bytes, sin copias en archivos o Git.
- Webhook `2b8a80cc-1626-4851-aece-165d4be43369` creado para los seis eventos
  indicados abajo; Enabled despues de publicar y verificar el endpoint nuevo.
- Flag de invitaciones `true` en Production. Primero se desplego con `false` y
  se verifico el bloqueo antes de reconstruir el mismo commit para activarlo.
- La configuracion del dominio muestra "Enable tracking metrics": no hay
  subdominio de tracking configurado ni seguimiento de aperturas/clics activado.
  El webhook tampoco esta suscrito a eventos opened/clicked.
- TLS sigue Opportunistic, sin cambios. La entrega de correo real y recepcion de
  su webhook firmado siguen pendientes de la prueba autenticada.

Procedimiento de referencia (no recrear ni rotar los secretos ya guardados):

1. Crear o seleccionar la cuenta Resend gratuita. Confirmar los limites de la
   cuenta; actualmente se documentan 100 correos diarios y 3.000 mensuales.
2. Agregar `trustleaf.org` y publicar exactamente los DNS que entregue Resend.
   No sustituir los MX raiz de Zoho ni los registros Calendar/Meet. Si el proveedor
   usa un subdominio de retorno, verificar ese nombre exacto antes de agregar MX.
   No duplicar SPF en el mismo nombre; revisar la configuracion DNS existente.
3. Confirmar dominio verificado y desactivar seguimiento de aperturas y clics
   en la configuracion del dominio. Remitente y respuesta: `admin@trustleaf.org`.
4. Guardar solo en el servidor: `RESEND_API_KEY` restringida a envios del dominio,
   `RESEND_WEBHOOK_SECRET` y `TEAM_INVITATION_ENCRYPTION_KEY` (32 bytes aleatorios
   en hexadecimal, independiente de Calendar y de datos clinicos).
5. Registrar el webhook HTTPS para sent, delivered, delivery_delayed, failed,
   bounced y complained. Probar firma y un envio real controlado. No registrar
   el payload del webhook ni los enlaces en logs.

Referencias: [limites](https://resend.com/docs/knowledge-base/account-quotas-and-limits),
[idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys),
[firmas](https://resend.com/docs/webhooks/verify-webhooks-requests),
[eventos](https://resend.com/docs/webhooks/event-types),
[etiquetas](https://resend.com/docs/dashboard/emails/tags),
[cuenta compartida](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants).

## Publicacion y recuperacion

- Exigir tipos, build, API/SQL, PostgreSQL independiente, restauracion ficticia y
  navegador aprobados en CI. Revisar la diferencia antes de integrar a main.
- Con el flag deshabilitado, comparar historial remoto y respaldar/restaurar la
  aplicacion mediante el procedimiento cifrado existente fuera de Git. Un respaldo
  anterior no cubre operaciones recientes. Verificar version/hash de referencia.
- Aplicar exclusivamente `20260909030000_operator_invitations.sql`. No ejecutar
  un db push general: el borrador mensual permanece fuera de esta entrega.
- Publicar primero con invitaciones deshabilitadas, confirmar que el nuevo endpoint
  exige firma y habilitar el webhook existente. Validar entrega firmada antes de
  permitir invitaciones; no crear otro webhook ni regenerar su secreto.
- Publicar, confirmar commit y activar `TRUSTLEAF_TEAM_INVITATIONS_ENABLED=true`
  solo con proveedor, dominio y webhook comprobados. Tambien requiere el piloto
  operativo habilitado. Los limites se configuran en variables de servidor.
- Ante fallo apagar ese flag: bloquea crear, aceptar, reenviar y despachar;
  mantiene consulta/cancelacion autorizadas y procesa webhooks existentes.
  No borra historial, no restaura el alta por UUID ni vuelve a Firebase.
- Conservar la clave de cifrado en custodia segura; perderla impide recuperar los
  destinatarios y mensajes pendientes. No rotarla sin migracion de cifrado.

## Evidencia y validacion oficial

Publicacion comprobada el 2026-09-09:

- [PR 23](https://github.com/CaBsCrypto/Trust-Leaf/pull/23) fusionado a `main`
  como `d8728a42283161d0054b181199f5c0f6827b6320`. Checks del ultimo head
  `5fcfa4a` aprobados y [CI de main](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/34323880970)
  terminado con success.
- Respaldo `D:\00 CODEX - OPENIA\.backups\trustleaf\application-20260909-042136.dpapi`,
  SHA256 `39A36E553C0C65C49B9D8BBF25566D0C64F9501B49433149B8E37C9AB2F46F28`.
  Restauracion aislada verificada: 31 tablas y 163 filas. Cifrado Windows DPAPI
  CurrentUser; requiere el perfil Windows original. Alcance de aplicacion, no
  incluye Auth, Storage, Vault ni configuracion del proveedor.
- Solo `20260909030000_operator_invitations.sql` aplicada con su registro de
  historial en la misma transaccion. Historial remoto: 28 versiones; 7 actores,
  2 membresias y 2 entregas conservados, 0 invitaciones al finalizar migracion.
  Cinco tablas nuevas con RLS forzado y sin SELECT directo; RPC solo service_role,
  ejecutor privado anterior sin permiso de ejecucion service_role.
  Borrador mensual sin modificar ni aplicar.
- Despliegue deshabilitado `dpl_6tLq1hFvLYQv3LKak2osxyLZaLeF`: GET sin sesion
  401, POST de creacion con token ficticio 503 TEAM_DISABLED, webhook sin firma
  400 SIGNATURE_INVALID, GET del webhook 405. Respuestas no-store, private.
- Despliegue habilitado `dpl_FaK6mBf6873YhSQCw6fHhH6nCARB` Ready, mismo commit,
  aliases `trustleaf.org` y `www.trustleaf.org`. GET sin sesion 401 AUTH_REQUIRED;
  POST con token ficticio ahora 401, sin enviar correo ni escribir solicitudes.
  Webhook sin firma 400 SIGNATURE_INVALID; API de operaciones sin sesion 401.
  Todas esas respuestas conservan no-store, private; APIs de actor usan
  Vary: privy-id-token. No acredita todavia una aceptacion o entrega real.

Ejecutables: `npm run test:team-invitations`, `npm run qa:operations-pilot`,
`npm run test:operations-pilot-concurrency`, `npm run lint`, `npm run build`,
`node tests/sql/application-backup-test.mjs` y `tests/ui/operations-browser.mjs`.
CI emplea PostgreSQL 17 y conexiones independientes. Localmente se ha ejecutado
PostgreSQL 18 en WSL con autenticacion Unix existente, sin crear usuarios con
password para este fixture. La base debe llamarse `trustleaf_pilot_test`, estar
vacia y ser local; el runner no borra bases.

Pruebas: nuevo/existente, correo equivocado, consentimiento, duplicados, respuesta
perdida, cuenta suspendida/vencida, otro rol/org, revocacion del encargado,
expiracion, cancelacion, rotacion, cuotas, leases, firma y orden de webhooks,
restricciones/retirada y regresion de entregas/inventario. Capturas sinteticas
en `scratch/operations-qa`, fuera de Git.

Pendiente en sitio oficial: encargado B invita al correo acordado; trabajador
acepta con Privy real y ambos ven la membresia; comprobar entrega del correo,
restricciones y retirada con dispositivos separados. La identidad ya aprobada
se conserva. El saldo anterior del paciente sigue en cero: una entrega exitosa
del operador requiere otro tratamiento ficticio por el flujo medico, nunca
reiniciar el saldo anterior. Nada de esto habilita atencion o entregas reales.
