# Privacidad y preparacion de la demo

Fecha de corte: 2026-10-01, America/Santiago. Auditoria desde
`86e2016f1e7f7fe9a13386be5bb2505abfc22a4c`, rama
`audit/pilot-privacy-readiness`. No es un dictamen de cumplimiento.
La fuente unica de estados y responsables es el
[tablero](DISPENSARY_CLOSEOUT_SPRINT.md#demo-y-adopcion-30092026).

## Decision de esta entrega

LISTO PARA ENSAYO INTERNO CON LIMITACIONES; INCORPORACION EXTERNA PAUSADA.
Primera demo externa sin videollamada, grabacion ni generacion de eventos.
El aviso queda como borrador interno: integrarlo en Git no lo publica en la
interfaz ni acredita su aceptacion. No se invito, aprobo, llamo, entrego,
recibio, ajusto ni renovo permisos en produccion durante esta auditoria.

Antes de la primera invitacion: definir responsable/canal, revisar finalidades,
conservacion y proveedores, atender los hallazgos aplicables al despliegue y
aprobar/publicar el aviso en una entrega separada. Evaluacion humana y teclado
en celular real siguen pendientes; las pruebas del agente no los sustituyen.

## Base comprobada y metodo

- PR59 integrado, main `86e2016`; [CI main 36941802547 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36941802547).
- GitHub deployment 6797663287 success vincula ese SHA con el despliegue
  `trustleaf-55m7bmi0l-cabscryptocontacto-6028s-projects.vercel.app`.
  Vercel `dpl_8X4BVrQPz6vseBdq38sHWPbuCcJH` Ready y alias
  `www.trustleaf.org` contrastados por separado, no inferidos de la rama.
- Seis agentes revisaron seguridad, medico, paciente, dispensario, Admin y
  calidad/UX. Solo el coordinador integra documentos; un agente amplia pruebas.
  Revision de codigo, pruebas sinteticas y metadatos de proveedor de solo lectura.
- No se descargaron registros publicados ni secretos; no se recopilaron
  pantallas autenticadas para publicar. No se tomo control de la sesion Admin.
- [Resultados, reproducciones y limites](evidence/pilot-privacy-readiness/README.md).
  La concurrencia PG17 ya aprobada en PR59 se reutiliza; PGlite no la reemplaza.

## Inventario de datos y acceso actual

Finalidades siguientes describen el flujo tecnico; su base y proporcionalidad
deben aprobarse. Tablas privadas/RLS/funciones autorizadas no significan cifrado
aplicativo de todos los campos. UUID y hashes pueden permitir vinculacion.

| Categoria / finalidad | Datos y almacenamiento comprobable | Acceso / destinatarios | Brecha o limite |
| --- | --- | --- | --- |
| Identidad / autenticar | Subject y correos verificados Privy; actores, rol, estado y membresias Supabase | Privy; servidor verifica token y Supabase aplica permisos; Admin revisa cuentas | Sesion y cookies internas del SDK, plazos y contrato de cuenta requieren inventario del proveedor; no se declara que todo sea ficticio |
| Invitacion / incorporar | Referencia, hash SHA256 del secreto, HMAC del correo, destinatario y payload cifrados AES-256-GCM; cola/estado/historial privados Supabase | Servidor descifra para Resend y listado autorizado Admin/encargado; destinatario recibe correo y enlace | Cifrado aplicativo de estos campos, no anonimato; expiracion de siete dias no es borrado; claves y rotacion operativa por revisar |
| Solicitud / revisar encargado | Nombre, telefono, negocio, comuna, direccion, actividad, contacto opcional; JSON privado, versiones y decisiones | Solicitante y Admin autorizado; no se incluye formulario en correo de invitacion | Sin cifrado aplicativo por campo demostrado; resultado de operaciones idempotentes conserva copias del perfil, incluidas versiones previas |
| Equipo / acceso a organizacion | Subject, correo verificado, rol, membresia e invitacion de trabajador | Encargado y operador consultan integrantes de su propio equipo; servidor valida organizacion | Correo de miembros visible al operador; no afirmar privacidad exclusiva del encargado; retirada no borra historial |
| Perfil ficticio / ensayo de autorizacion | Nombre, correo y telefono de prueba; perfil propio y grants de tratamiento Supabase | Paciente propio; dispensario solo por permiso vigente y politica de actor de lectura compartida | Declaracion `syntheticOnly` no detecta datos reales; justificar compartir contactos y todos los periodos autorizados |
| Agenda / consulta ficticia | Reserva, fecha, paciente/medico, estado, notas versionadas y tratamiento Supabase | Participantes asignados segun estado; dispensario no recibe notas clinicas | Texto libre puede contener salud real; alta/aprobacion no valida receta o habilitacion sanitaria |
| Comprobante / trazabilidad | Referencias, cantidad, periodo, producto/lote/dispensario actuales y operador; entregas/historial Supabase | Propietario conserva recibos; organizacion conserva su historial operativo permitido aun sin grant | Referencia del operador no es anonima; los nombres actuales no son una copia inmutable al entregar; no hay borrado general |
| Catalogo / inventario ficticio | Producto, precio de referencia, lote, origen, motivo, recepcion/movimientos; comercio vinculado al inventario Supabase | Ambos roles ven existencias e historial de su organizacion; costos/contactos de proveedor solo encargado | Origen/motivo son texto libre compartido; evitar personas, contactos y costos privados en esos campos |
| Google existente / agenda | Correos reales medico/paciente, fechas, evento privado y referencias derivadas; refresh token OAuth cifrado al persistir, access token usado en memoria servidor | Cuenta Google organizadora central y Google; invitados reciben actualizaciones | Sin nuevas reservas/cancelaciones/worker en la demo. No llamar no elimina eventos previos ni evita por si solo `sendUpdates=all` |
| Diagnostico / soporte | Codigos, tiempos, referencias tecnicas; logs y artefactos CI/alojamiento | Administradores tecnicos/proveedores segun acceso de cuenta | No se verificaron logs historicos ni plazos; fragmento JSON y codigo upstream sin acotar reproducidos en aislamiento; ver hallazgos |

Fuentes de codigo: `api/_lib/dispensary-onboarding.ts`,
`api/_lib/team-invitations.ts`, `api/_lib/privy-identity.ts`,
`supabase/migrations/20260922010000_dispensary_onboarding.sql`,
`supabase/migrations/20260909030000_operator_invitations.sql`,
`supabase/migrations/20260915020000_pilot_patient_profiles.sql`,
`supabase/migrations/20261001010000_shared_patient_read_authorization.sql`,
`src/features/operations/OperationsWorkspace.tsx`, `src/features/commerce`,
`api/_lib/google-calendar-events.ts` y `api/_lib/google-meet-access.ts`.
Verificar nombres/rutas contra Git antes de usar el inventario para una entrega.

## Navegador, transporte y consentimiento

- Panel conectado: snapshots y borradores en memoria; fronteras de identidad
  desmontan/invalidan respuestas pendientes. Pruebas de sesion y entre pestanas
  sinteticas PASS; no garantizan ausencia de todos los datos del SDK/legado.
- `src/lib/sessionChangeBus.ts` guarda una marca opaca en localStorage para
  avisar cambio de sesion, no un perfil/token. `src/lib/dispensaryInvitation.ts`
  conserva el secreto de invitacion en sessionStorage con vigencia limitada;
  scripts del mismo origen pueden leerlo. No prometer ausencia total de secretos
  en almacenamiento del navegador. Un fragmento URL evita query HTTP, no oculta
  el enlace a quien lo recibe o copia.
- `MockupPortal` y caminos heredados tienen caches `trust_*` en localStorage.
  Su limpieza/segmentacion es un trabajo separado DEM-LEG-01; no usar legado
  Stellar/Firebase como recorrido soportado de esta demo.
- Handlers privados comprobados devuelven `no-store, private`; incorporacion
  varia por `privy-id-token`. No atribuir estos headers a todas las rutas,
  errores previos al handler o caches de terceros sin pruebas.
- `consent_at` se registra al aceptar y se actualiza al enviar la solicitud.
  `version` controla concurrencia del formulario, no version del aviso.
  No existe evidencia de aceptacion de `draft-2026-10-01` ni base para atribuirla
  retrospectivamente. Participacion, permiso 24h y consentimiento clinico son
  decisiones distintas. Cualquier registro nuevo requiere otro alcance.

## Proveedores: observado frente a pendiente

| Proveedor | Configuracion/documentacion comprobada | No comprobado en esta entrega |
| --- | --- | --- |
| Privy | Verificacion servidor y correo actual; [privacidad](https://www.privy.com/privacy) y [DPA publico](https://www.privy.com/data-processing-addendum) consultados | Contrato aplicable a esta cuenta/chile, region, cookies SDK, subproveedores, retencion y procedimiento de derechos; politica web no sustituye aviso de Trust Leaf |
| Supabase | CLI de solo lectura informa proyecto ACTIVE_HEALTHY en `us-east-1`; [regiones](https://supabase.com/docs/guides/platform/regions) y [respaldos](https://supabase.com/docs/guides/platform/backups) consultados | Plan, contrato/transferencias, Auth/Storage/Vault completos, plazos, claves y recuperacion integral; region primaria no prueba residencia de todos los proveedores |
| Resend | API de invitaciones/cola persistente, claves idempotentes y webhook firmado; [DPA](https://resend.com/legal/dpa), [subproveedores](https://resend.com/legal/subprocessors) y [terminos](https://resend.com/legal/terms-of-service) consultados | Contrato/region/plazos de cuenta y borrado de mensajes; correo es revelado al proveedor y destinatario autorizado, no permanece cifrado extremo a extremo |
| Vercel | Deployment/alias comprobados; funciones observadas `iad1`; [DPA](https://vercel.com/legal/dpa) consultado | Plan/contrato: el DPA consultado indica Pro/Enterprise, no afirmar que aplica a esta cuenta; logs, regiones de otros servicios y retencion |
| Google Calendar/Meet | Scopes `calendar.app.created` y `meetings.space.settings`; codigo solicita Meet OPEN; [semantica oficial](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces#AccessType) consultada | No se probo una sala remota ni revocacion de enlaces/copias. Excluido del guion; sin cambiar configuracion ni ejecutar OAuth/worker |

El respaldo previo restaurado corresponde a 49 tablas/262 filas de aplicacion,
no acredita recuperacion integral de Auth, Storage, Vault o datos en otros
proveedores. Esta auditoria no genero ni restauro un respaldo de produccion.

## Hallazgos y siguientes entregas

IDs/estados autoritativos en el tablero; severidad describe riesgo, no una fuga
publicada demostrada. No se corrigio producto dentro de esta auditoria.

- DEM-PRIV-01: responsable, canal, finalidades/base, conservacion y condiciones
  no definidos. Puerta externa bloqueada, aviso solo borrador; el enlace de
  privacidad actual del Footer no es un aviso operativo completo.
- DEM-PRIV-02: participacion sin aviso versionado; copias en journal, plazos y
  derechos requieren decision/revision. No imponer una implementacion de
  consentimiento por suposicion juridica.
- DEM-PRIV-03 / P2: Express `express.json()` y logger por defecto pueden registrar
  parte del cuerpo JSON invalido. Reproducido en loopback con marcador sintetico:
  HTTP400, handler no ejecutado, respuesta production sin marcador, stderr con
  marcador. No se contrasto una fuga en Vercel ni historiales reales; rama fix
  propia para contencion diagnostica y errores previos al handler.
- DEM-PRIV-04 / P2: bootstrap Supabase registra `code` upstream de tipo string
  sin acotarlo (`api/_lib/privy-supabase-rbac.ts:157`). Marcador sintetico alcanza
  console.error; respuesta al cliente saneada. Acotar diagnostico en otro PR;
  no se afirma que Supabase haya enviado datos personales en produccion.
- DEM-PRIV-05 / P2 funcional: JSON invalido de SQL/Privy se clasifica HTTP400 por
  `SyntaxError` en onboarding, aunque el origen sea proveedor. Dos reproducciones
  negativas aisladas; no hay payload privado reflejado. Separar error cliente
  de indisponibilidad upstream en rama propia, manteniendo reintento idempotente.
- DEM-PRIV-06 / pendiente de reproducir: snapshot compartido podria permanecer
  visible durante GET503 tras revocacion remota; inspeccion no demuestra bypass
  SQL ni fuga. Confirmar con fixture antes de definir correccion.
- DEM-QA-02 / prueba heredada: fixture `google-calendar-setup.test.ts` no incluye
  target de renovacion requerido por codigo vigente. FALLA aislada conocida,
  no fallo de configuracion remota. Corregir fixture/revisar en entrega separada;
  no declarar todas las pruebas Calendar aprobadas.

## Revision y transicion normativa

[BCN confirma vigencia general de Ley 21.719 el 01/12/2026](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13).
No atribuir automaticamente ese regimen futuro al corte 01/10; considerar
tambien [Ley 19.628](https://www.bcn.cl/leychile/Navegar?dt=open&idLey=19628).
La pagina dinamica de esta ultima no entrego texto completo en esta ronda:
vigencia referenciada y expediente previo, no una revision articulada integral.
Bases, obligaciones, excepciones, plazos y transferencias deben contrastarse
con profesional y texto oficial vigente antes de adoptar decisiones reales.

Entregables: [aviso interno](PILOT_PRIVACY_NOTICE_DRAFT.md),
[procedimiento propuesto](PILOT_PRIVACY_PROCEDURE.md) y
[guion sin llamadas](DEMO_ADOPTION_RUNBOOK.md#demo-sin-llamadas-01102026).
Ninguno constituye aprobacion juridica ni habilitacion asistencial/comercial.
