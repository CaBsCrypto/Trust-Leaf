# Auditoría de permisos Firebase/Firestore

**Fecha:** 2026-08-22

**Base revisada:** `34c3bb2`

**Alcance:** análisis estático local; no se conectó a Firebase, no se usó emulador/cloud, no se modificaron reglas, datos, configuración ni producción.

## Veredicto

**NO-GO para persistencia profesional, clínica o farmacéutica.** Las reglas tienen un deny global útil y separan algunas escrituras administrativas, pero no expresan claims/RBAC para médico, dispensario y paciente. El cliente decide roles mediante `localStorage`, permite bypass en modo demo y degrada errores de Firestore a estado local. Por ello una pantalla puede mostrar éxito sin que exista escritura cloud autorizada.

No hay suite ejecutable de reglas con Firebase Emulator ni pruebas multiusuario allow/deny. Las pruebas actuales son gates estáticos y de seguridad Stellar; no verifican Firestore funcionalmente.

## Evidencia principal

| Hallazgo | Evidencia | Riesgo |
|---|---|---|
| Red de seguridad deny-by-default | `firestore.rules:4-7` niega toda ruta no cubierta | Positivo; bloquea colecciones omitidas, pero también hace que UI caiga a local |
| Único rol server-enforced es admin por documento | `firestore.rules:18-21`; `appAdministrators/{uid}` en `:27-33` | No existen claims/entitlements de médico, dispensario o paciente |
| Roles de aplicación son autoasignados en cliente | `trustAuth.ts:64-68,109-126`; `App.tsx:368-391` | Un usuario puede elegir `doctor`/`dispensary`; no prueba verificación profesional |
| Bypass demo habilita operación | `App.tsx:595-598` | Cualquier sesión local demo puede pasar `doctorCanOperate`/`dispensaryCanOperate` |
| Admin UI y reglas se contradicen | email hardcoded autoriza cliente en `trustAuth.ts:159-165`; reglas exigen documento admin en `firestore.rules:18-21` | La UI puede considerar admin a quien Firestore no autoriza; identidad basada en email en cliente no es control confiable |
| Solicitudes visibles a todo usuario autenticado | `firestore.rules:119,159` | Datos de solicitudes profesionales/dispensarios se listan sin ownership ni minimización |
| Solicitudes carecen de ownership | creación en `firestore.rules:115-118,155-158`; `uid` no es requerido/validado | Usuario autenticado puede crear múltiples solicitudes con IDs y datos arbitrarios válidos |
| Estados requeridos no existen | reglas aceptan `pending/needs_review/approved/rejected` (`:111-112,151-152`) | No hay semántica `verified` o `suspended`; `approved` se usa como sustituto ambiguo |
| Usuario puede elegir rol al crear perfil | `users` create `firestore.rules:37-45` valida solo `uid/name`; cliente envía `role` en `trustAuth.ts:118-126` | Campo extra `role` no está restringido, aunque tampoco es usado por rules; falsa sensación de RBAC |
| Lectura de perfiles demasiado amplia | `firestore.rules:43` permite `get` a cualquier autenticado | Enumeración dirigida si se conoce UID; expone campos de perfil/wallet |
| Prescripción modelada como propiedad del paciente | `firestore.rules:58-72` | Paciente crea su propia prescripción y cambia `status`; médico no puede emitir para otro paciente |
| Pickup controlado por paciente | `firestore.rules:74-89` | Paciente crea/actualiza/elimina retiro; dispensario no tiene autoridad ni separación de funciones |
| Ficha solo paciente, sin consentimiento delegado | `firestore.rules:171-182` | Médico no puede leer/escribir nota; no se aplica vínculo, consentimiento, propósito ni vigencia |
| Update de consentimiento no revalida documento | `firestore.rules:185-197` | Owner del recurso previo puede reemplazar campos sin `isValidConsent(request.resource.data)` ni lista de campos |
| Consentimiento usa wallet/rol declarado | `firestore.rules:187-192` | No vincula actor a Firebase UID verificado ni impone scopes conocidos/audience |
| Audit log es falsificable y legible globalmente | `firestore.rules:199-223`; cualquier autenticado crea/lee | Un actor puede atribuir rol/address/tx arbitrarios; no es auditoría confiable ni minimizada |
| Audit log admite mainnet y payload libre | reglas `:204-215`; `auditLogger.ts:39-49,65-76` | Contradice límite TESTNET; metadata/patientAddress/quantity pueden filtrar información |
| Auditoría falla abierta | `auditLogger.ts:53-61,78-81` | Operación continúa si no hay auth o Firestore falla; no sirve como control obligatorio |
| Agenda/notificaciones/inventario/miembros no tienen reglas | mutaciones en `trustData.ts:632-744,767-825`; no hay `match` correspondiente | Firestore las niega por el deny global; solo UI/local parece funcionar |
| Fallback local precede o absorbe fallo cloud | `trustData.ts:338-363,366-397,511-630,767-825` | Éxito visual/local aunque persistencia falle; no fail-closed |
| Inventario sintético aparece si cloud falla | `trustData.ts:632-658` | Puede confundirse stock fixture con stock persistido/real |
| Config Firebase está versionada | `firebase-applet-config.json:1-9`; import `firebase.ts:1-8` | API key web no es secreto por sí misma, pero exige reglas/App Check/cuotas correctas; no se debe tratar como credencial admin |
| Sin emulator test harness | `package.json:6-16,38-47`; búsqueda sin `@firebase/rules-unit-testing`, `connectFirestoreEmulator`, `assertSucceeds/assertFails` | Cero evidencia funcional de allow/deny por rol |

## Modelo requerido versus estado actual

### Profesional médico

Estados objetivo: `pending -> verified -> suspended` (y rechazo/revocación explícita).

Actual: una solicitud puede ser `approved`, pero el permiso operativo se deriva en UI comparando email/nombre o aceptando modo demo (`App.tsx:583-598`). Las reglas no consultan solicitud, claim, vínculo `uid`, estado on-chain ni suspensión. `doctorApplications` exige datos de contacto/wallet y los muestra a cualquier autenticado.

**Conclusión:** UI/mock parcial; no autorización real.

### Dispensario

Estados objetivo: `pending -> verified -> suspended`, con miembros y funciones separadas.

Actual: mismo esquema `approved`; no hay claim ni organización/membership. `dispensaryInventory` y `dispensaryMembers` no tienen rules, aunque el cliente intenta escribirlos. Pickups pertenecen al paciente según reglas.

**Conclusión:** UI/mock parcial; persistencia cloud denegada o semánticamente incorrecta.

### Paciente

Estados objetivo independientes: identidad, consentimiento vigente/versionado, elegibilidad y `directory-enabled`.

Actual: no existen documentos/policies para identidad verificada, elegibilidad o habilitación de directorio. `users` es un perfil auto-creado; `consents` es patient-owned pero no controla lecturas de otras colecciones. La ruta/directorio usa listas aprobadas y fixtures, no un entitlement Firestore.

**Conclusión:** identidad de Firebase básica + estados locales; gates requeridos ausentes.

## Matriz allow/deny observada

Esta tabla describe las reglas actuales, no el comportamiento deseado.

| Recurso/acción | No auth | Paciente autenticado | Médico autenticado | Dispensario autenticado | Admin allowlist | Evaluación |
|---|---:|---:|---:|---:|---:|---|
| `users/{self}` get/create/update limitado | deny | allow | allow | allow | allow | Rol irrelevante; ownership solo por UID en write |
| `users/{other}` get | deny | allow | allow | allow | allow | Exceso de lectura |
| doctor/dispensary applications create | deny | allow | allow | allow | allow | Sin owner/rol; siempre `pending` |
| applications list/read | deny | allow | allow | allow | allow | Exposición transversal |
| applications review | deny | deny | deny | deny | allow | Positivo, pero admin se define por doc, no UI/email |
| prescriptions create para self | deny | allow | allow para sí mismo | allow para sí mismo | allow para sí mismo | No corresponde a emisión médico→paciente |
| prescriptions read/update | deny | owner paciente | owner UID | owner UID | solo si owner | Sin consentimiento/rol profesional |
| pickups create/update/delete | deny | owner declarado/self | para sí mismo | para sí mismo | para sí mismo | Autoridad incorrecta y delete permitido |
| clinicalRecords create/read/update/delete | deny | owner | solo sus propios registros | solo sus propios registros | solo propios | No acceso delegado; update/delete no valida schema |
| consents create/read/update | deny | owner | solo propios | solo propios | solo propios | Consent no concede permisos sobre otros recursos |
| audit_logs create/read | deny | allow/allow | allow/allow | allow/allow | allow/allow | Forjable y global |
| agenda/notifications/inventory/members | deny | deny | deny | deny | deny | Global deny; UI cae a local |

> Las columnas de rol son equivalentes porque las reglas no usan custom claims ni perfil de rol. “Admin” solo cambia acciones que llaman `isAdmin()`.

## Matriz objetivo mínima para pruebas de emulador

Todas las combinaciones no enumeradas deben ser `deny`.

| Caso | Patient | Doctor pending | Doctor verified | Doctor suspended | Dispensary pending | Dispensary verified | Dispensary suspended | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| leer/editar perfil propio mínimo | allow | allow | allow | allow | allow | allow | allow | soporte acotado |
| cambiar su propio rol/estado profesional | deny | deny | deny | deny | deny | deny | deny | transición validada |
| administrar disponibilidad propia | deny | deny | allow | deny | deny | deny | deny | soporte acotado |
| reservar slot elegible | allow con consentimiento/eligibilidad | deny | deny | deny | deny | deny | deny | soporte acotado |
| leer ficha resumida vinculada | self | deny | allow con relación+consent+scope+TTL | deny | deny | deny | deny | acceso excepcional auditado |
| escribir nota append-only | deny | deny | allow en episodio asignado | deny | deny | deny | deny | corrección versionada, no overwrite |
| ver directorio | allow solo `directory-enabled` | opcional | opcional | deny | deny | allow propia | deny | allow |
| verificar QR mínimo | deny | deny | deny | deny | deny | allow con audience+nonce | deny | soporte acotado |
| registrar parcial idempotente | deny | deny | deny | deny | deny | allow con versión/saldo | deny | reconciliación |
| suspender profesional/dispensario | deny | deny | deny | deny | deny | deny | deny | allow con motivo/auditoría |

## Contradicciones funcionales concretas

1. **UI “operativa” vs cloud deny:** agenda, alertas, inventario y miembros se actualizan primero/localmente o devuelven fixtures, mientras Firestore rechaza.
2. **Aprobación vs verificación:** UI filtra `approved`; el flujo requerido habla de `verified/suspended`. No existe migración ni transición suspendida.
3. **Rol de sesión vs identidad autenticada:** `trust_leaf_session` decide rutas/operación; `auth.currentUser` decide si intentar Firestore. No existe unión verificable entre ambos.
4. **Consentimiento nominal vs enforcement:** hay documentos `consents`, pero ninguna regla clínica los consulta.
5. **Auditoría inmutable nominal vs autenticidad:** no se puede editar un log, pero cualquier autenticado puede crear uno falso y leer todos.
6. **Delete UI vs rules:** `App.tsx:355-359` intenta borrar `users`, pero `firestore.rules:36-56` no concede delete.
7. **Schema ficha vs writer:** rules requieren `recordType/privatePayloadRef` (`firestore.rules:173-177`), mientras UI/data usa objetos libres (`trustData.ts:616-630`); el auditor médico ya lo identifica en `tests/medical-flow-capabilities-audit.mjs:54-73`.
8. **Testnet-only vs schema audit:** `.env.example:1-25` es fail-closed para mutaciones Stellar, pero Firestore `audit_logs.network` acepta `mainnet` (`firestore.rules:214`).

## Secretos y configuración

- No se detectó secreto Firebase Admin en los archivos revisados. `firebase-applet-config.json` es configuración web pública; su presencia no autoriza operaciones privilegiadas.
- Los secretos Stellar y relayer figuran vacíos en `.env.example:15-25`, correctamente fuera de variables `VITE_*`.
- El mayor riesgo no es la API key pública sino reglas excesivas, ausencia de App Check/rate controls documentados y logs libres.
- No se inspeccionaron valores de `.env` locales ni consola cloud para evitar exponer secretos/estado real. Esto queda **no verificable ambientalmente**.

## Cobertura de pruebas actual

| Evidencia | Estado | Límite |
|---|---|---|
| `audit:medical-flow` | estático; reconoce colecciones bloqueadas | busca strings, no ejecuta rules |
| `test:pilot-safety` | funcional para config Stellar local | no cubre Firebase/Auth/Firestore |
| `test:critical-static` | estático para rutas/copy/gates | no prueba permisos multiusuario |
| Firebase Emulator | ausente | no hay allow/deny real |
| Cloud integration | no ejecutada y no autorizada | estado de Auth providers, App Check, índices y rules desplegadas desconocido |

**Fallo funcional comprobado por diseño:** las reglas carecen de RBAC profesional y niegan colecciones usadas por UI.

**Desconocido ambiental:** qué versión de rules está desplegada, providers habilitados, claims reales, App Check, índices, proyecto activo y configuración del emulador.

## Backlog de remediación priorizado

### P0 — antes de conectar tres participantes

1. Definir un modelo de autorización neutral con `uid`, rol, organización, estado `pending|verified|suspended`, versión y scopes; deny por defecto.
2. Elegir autoridad server-side para claims/entitlements. El cliente nunca crea/cambia rol, estado o verificación.
3. Separar colecciones públicas mínimas de solicitudes privadas; owner solo lee su solicitud y admin revisa.
4. Eliminar fallback silencioso de todo flujo que se presente persistido: devolver `demo-local`, `pending`, `failed` o `unknown` explícito.
5. Diseñar paciente con gates independientes y versionados: identity, consent, eligibility, directory-enabled. Ninguno se infiere de otro.
6. Rehacer prescriptions/pickups como propuestas/receipts sintéticos con roles correctos, idempotencia, no-delete y estado append-only.
7. Rehacer audit logs desde backend/Admin SDK confiable; cliente no escribe; payload allowlisted, TESTNET-only, sin PII/PHI.

### P0 — suite obligatoria de Emulator

Crear sin cloud real una suite con identidades: una por cada rol/estado, actor ajeno, sin auth y admin. Debe cubrir:

- allow/deny de cada fila de la matriz objetivo;
- creación con campos extra, cambio de owner/rol/status, escalation y cross-tenant reads;
- transición pending→verified→suspended solo por autoridad;
- consentimiento expirado/revocado/scope incorrecto;
- reserva concurrente/doble, QR replay y parcial con versión vieja;
- query/list security (no basta probar `get`);
- audit append-only auténtico y rechazo de cliente;
- campos/tamaños/timestamps, server timestamps, PII forbidden scan;
- colecciones desconocidas siempre deny.

El comando debe fijar project ID de emulador, comprobar `FIRESTORE_EMULATOR_HOST`, abortar si apunta a cloud y limpiar solo el proyecto efímero.

### P1 — integración sintética

1. Adaptadores separados `InMemory` y `FirestoreEmulator`; mismos contract tests.
2. Transacciones para slot/consumo parcial/idempotencia; outbox para Stellar TESTNET.
3. Cifrado de payload fuera de Firestore visible al cliente; referencias opacas y KMS no simulado como listo.
4. App Check/rate limiting/abuse model y observabilidad redactada.
5. E2E multiusuario en dos sesiones, incluyendo suspensión inmediata y pérdida de permisos.

### Gates posteriores

No usar datos reales ni presentar cumplimiento hasta revisión legal chilena, clínica, farmacéutica, privacidad/DPIA, threat model, pentest, restore drill, retención/borrado y aprobación de arquitectura de identidad/custodia.

## Recomendación inmediata

No parchear reglas colección por colección sobre el esquema actual. Primero congelar el modelo de identidades/estados y escribir la matriz de Emulator como especificación ejecutable; después implementar rules y adaptadores hasta hacerla pasar. Durante esa fase, mantener todas las capacidades mutantes como `demo-local` explícito y no mostrar confirmación cloud si Firestore falla.
