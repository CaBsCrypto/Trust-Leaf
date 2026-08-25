# Ceremonia seca y auditoría read-only — TrustRegistry + ReceiptLedgerV2

Estado: **ceremonia local verificada; deployment Testnet NO-GO**. Este runbook no
autoriza firmas, XDR, fondeo, deploy, inicialización ni otra submission. Sólo usa
fixtures sintéticos y conserva ambos flags de mutación en `false`.

Artefacto operativo machine-readable:
[`testnet-v2-deployment-manifest.local.json`](./testnet-v2-deployment-manifest.local.json).

## Resultado confirmado localmente

- El manifest fija los dos WASM actuales, su SHA-256, schema de eventos, IDL
  mínima, argumentos de `init` y orden de inicialización.
- `npm run smoke:testnet-v2:readonly` calcula de nuevo los hashes de los WASM y
  los compara con el manifest esperado usando un adapter local inyectable.
- `npm run test:testnet-v2-readonly-smoke` cubre los cuatro estados de credencial,
  los seis estados de receipt, vínculo registry→ledger, unknown, mismatch,
  timeout, payload inesperado/privacidad y cero submissions.
- La salida compartible contiene sólo estados, códigos y conteos. No contiene
  URL, contract/account/receipt/credential IDs, hashes, direcciones, XDR,
  firmas, secretos ni valores clínicos.

Esto no prueba RPC real, custodia real, deployment, validez clínica o legal.

## Roles y separación obligatoria

| Rol | Aprueba/ejecuta | Separación obligatoria |
|---|---|---|
| release owner | congela commit, manifest e interfaces | no opera claves ni submission |
| seguridad/custodia | valida provider, quorum, IAM y kill switch | no despliega ni aprueba su propia excepción |
| admin quorum | autoriza `init` y gestión de credenciales | mínimo dos custodios; no comparte signer con médico/dispensario |
| deployer | publica exactamente el WASM allowlisted | no queda como admin ni operador de negocio |
| submission operator | transporta sólo envelope previamente aprobado | no elige payload, signer, red ni IDs |
| doctor service | futuro actor técnico de fixtures | no puede actuar como admin/dispensario/deployer |
| dispensary service | futuro actor técnico de fixtures | no puede actuar como admin/médico/deployer |
| QA observador | ejecuta lecturas, checklist y evidencia sanitizada | no recibe acceso de firma |
| incident commander | decide pausa, abandono y teardown | no fuerza reintentos con estado `unknown` |

Una persona o workload no puede acumular `admin-quorum`, `deployer`,
`submission-operator`, `doctor-service` o `dispensary-service`. Cualquier
solapamiento es NO-GO.

## Ceremonia seca reproducible (sin red)

Responsables: release owner, seguridad y QA.

1. Confirmar rama candidata, árbol limpio y commit exacto.
2. Confirmar literalmente:
   `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y
   `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`.
3. Ejecutar las suites de contratos V2 y el preflight de custodia.
4. Recompilar ambos WASM con toolchain fijado; comparar SHA-256 contra el
   manifest. No copiar el hash desde stdout a un comando posterior.
5. Extraer la IDL desde cada WASM y cotejar métodos/argumentos del manifest.
6. Ejecutar `npm run test:testnet-v2-readonly-smoke`.
7. Ejecutar `npm run smoke:testnet-v2:readonly`; archivar sólo su reporte
   sanitizado.
8. QA independiente cambia uno a la vez: hash, schema, registry link, estado,
   fixture inexistente, payload extra y timeout. Todos deben fallar cerrados.
9. Registrar PASS/FAIL y códigos estables; no registrar stdout de provider/CLI.

Si el WASM cambia, el manifest deja de ser válido: requiere nuevo build, nueva
IDL, nueva revisión y nueva aprobación del paquete.

## Orden futuro de deployment e inicialización

Bloqueado hasta aprobación explícita del paquete de deployment:

1. desplegar `TrustRegistry` desde el hash aprobado;
2. inicializarlo una sola vez con el admin quorum aprobado;
3. comprobar read-only `get_admin` y ausencia de credenciales inesperadas;
4. desplegar `ReceiptLedgerV2` desde el segundo hash aprobado;
5. inicializarlo con el mismo admin quorum y la referencia exacta del registry;
6. comprobar read-only `get_registry` y exigir coincidencia exacta;
7. cerrar la ventana; no emitir credenciales ni receipts;
8. ejecutar el smoke post-deploy read-only con el adapter RPC revisado;
9. reconciliar eventos/ledger final antes de solicitar la autorización separada
   del smoke mutante sintético.

No se puede invertir 4↔5 ni inicializar V2 sin haber validado el registry. No se
reutilizan referencias del ReceiptLedger v1.

## Smoke post-deploy estrictamente read-only

El contrato de adapter está en
`api/_lib/testnet-v2-readonly-smoke.ts`. Por defecto sólo existe el adapter de
fixtures locales. El futuro adapter RPC debe entrar en una rama separada y cumplir:

- allowlist exacta de Testnet, RPC, ambos contract IDs y ambos hashes WASM;
- invocar sólo los métodos de lectura listados en el manifest;
- rechazar cualquier schema distinto de 1 (registry) o 2 (ledger V2);
- verificar `get_registry` antes de leer receipts;
- límites de timeout y respuesta; `unknown` nunca equivale a ausencia o activo;
- no construir, firmar, simular ni enviar transacciones; no aceptar XDR;
- no imprimir refs, URLs, hashes, IDs o errores crudos;
- no retornar campos fuera del contrato mínimo; un campo inesperado falla como
  `UNSAFE_ADAPTER_PAYLOAD`.

Hasta implementar y revisar ese adapter, el comando demuestra sólo la ceremonia
local, no lectura de Testnet. El literal `rpc-readonly` del puerto es una
capacidad futura del contrato de tipos: **no hay una conexión RPC live ni un
adapter RPC V2 conectado en este paquete**.

## Auditoría E2E por rol

| Paso | Actor responsable | Evidencia técnica mínima | Lectura esperada | Fallo obligatorio |
|---|---|---|---|---|
| validar médico | admin quorum | credencial actor v1 | doctor `active` | admin no aprobado/credencial desconocida |
| suspender médico | admin quorum | versión incrementada | doctor `suspended`; cadena bloqueada | versión obsoleta/replay alterado |
| validar dispensario | admin quorum | credencial actor v1 | dispensario `active` | rol cruzado |
| expirar dispensario | admin quorum | evento versionado | dispensario `expired`; partial bloqueado | expiry no transcurrido |
| elegibilidad | doctor activo | credencial opaca v1 | elegibilidad `active` | médico suspendido |
| revocar elegibilidad | médico emisor | versión incrementada | `revoked`; receipt bloqueado | otro médico/admin operativo |
| emitir/activar receipt | médico activo | evento V2 y vínculo de dos credenciales | `issued`→`active` | registry/hash/link mismatch |
| partial/dispensed | dispensario activo con grant | eventos V2 versionados | `partial`→`dispensed` | grant/credencial/version faltante |
| revocar receipt | médico emisor | evento V2 versionado | `revoked` | rol cruzado/terminal previo |
| audit admin | admin read-only | conteos/códigos y cadena de autorización | estado mínimo consistente | PHI/campo inesperado |

La ejecución mutante de esta tabla necesita una segunda autorización. La auditoría
read-only nunca prueba dispensación clínica, elegibilidad médica real ni receta
legalmente válida.

## Gate visual obligatorio por rol

Antes de autorizar el smoke mutante, cada fila anterior debe tener un escenario
visible local con estado mínimo, sin PHI, y un espacio de cotejo read-only para la
evidencia Testnet futura. Escenarios mínimos:

- admin: validar/suspender médico, validar/expirar dispensario y audit técnico;
- médico: crear/revocar elegibilidad, emitir/activar/revocar receipt;
- paciente sintético: consultar `issued/active/partial/dispensed/revoked/expired`;
- dispensario: ver grant y registrar visualmente partial/dispensed sólo como
  fixture hasta la autorización mutante.

QA Browser debe cubrir desktop y móvil, navegación por teclado/foco visible y
`prefers-reduced-motion`. Para cada escenario captura sólo ruta, viewport,
resultado visible y código técnico sanitizado. Nunca capturar IDs, nombres,
diagnóstico, dosis, gramaje, saldo, dirección, secreto o XDR. Un enlace futuro a
explorador debe estar rotulado como evidencia técnica Testnet, no validez clínica.

Guion humano compacto:

1. abrir cada vista por rol con fixture sintético;
2. verificar estado y control inactivo/activo esperado;
3. recorrer con teclado y repetir en viewport móvil + reduced motion;
4. cotejar el código sanitizado con el reporte read-only;
5. confirmar ausencia de PHI y claims legales;
6. marcar PASS/NO-GO sin ejecutar acciones de red.

Evidencia local integrada al 2026-08-25: QA Browser cubrió 12/12 escenarios en
desktop y cuatro checkpoints móviles, sin overflow, errores de consola, PII/PHI
ni enlaces V2 prematuros; foco visible PASS. La regla reduced-motion está cargada
y probada por la suite, pero queda pendiente una pasada humana con la preferencia
del sistema activada. Este pendiente mantiene el gate visual en **NO-GO** para el
deployment; la existencia del smoke de backend no lo sustituye.

## Kill switch, rollback y teardown

El kill switch requiere cierre en tres capas: flags de aplicación, policy del
provider y permiso del submission operator. Si cualquiera no puede comprobarse,
no se abre la ventana.

Ante timeout, resultado `unknown`, mismatch de hash/schema/link, auth inesperada,
salida sensible o evento no reconciliado:

1. detener inmediatamente firma/submission y revocar la sesión temporal;
2. mantener ambos flags en `false` y bloquear nuevos intents;
3. no reintentar con otro operation ID;
4. reconciliar sólo mediante lecturas allowlisted;
5. conservar Testnet público como evidencia; no intentar borrar historia;
6. retirar los IDs nuevos de configuración local si el deploy fue defectuoso;
7. si la instancia es inválida, abandonarla y exigir nuevo manifest/aprobación;
8. archivar evidencia sanitizada y abrir incidente/postmortem.

Teardown normal: cerrar flags/policies, retirar accesos temporales, confirmar cero
submissions pendientes/unknown, ejecutar smoke read-only final, conservar hashes y
códigos, y revocar fixtures técnicos sólo bajo la autorización mutante vigente.

## Decisiones humanas mínimas

La selección previa de provider/IdP, sus alternativas y la configuración no
secreta requerida se congelan en el
[ADR de custodia e identidad](adr-testnet-v2-custody-and-idp.md) y su
[checklist de decisión](testnet-v2-provider-decision-checklist.md). Ese ADR no
autoriza provisión: exige PoC Ed25519/JWKS, owners y pruebas de rotación/outage.

Para reducir rondas sin eliminar separación de duties se necesitan **dos
aprobaciones**:

1. **Paquete de deployment**: elegir provider KMS/HSM y admin M-de-N; asignar
   workloads separados; aprobar RPC/passphrase allowlisted, commit, toolchain,
   hashes/IDL, args de `init`, fee cap, ventana, observabilidad, kill switch y
   responsables. Esta única decisión autoriza deploy+init de los dos contratos,
   no operaciones de negocio.
2. **Paquete de smoke mutante sintético**: después de que el read-only post-deploy
   sea PASS, aprobar fixtures opacos, secuencia exacta, límites, responsables y
   teardown. Sin esta segunda aprobación no se emiten credenciales ni receipts.

Antes de la decisión 1 todavía faltan configuración real de provider/IAM/quorum,
adapter RPC read-only, referencias finales de contratos (obtenidas al desplegar),
la pasada humana reduced-motion y cierre de revisión independiente del paquete. Un solo
pendiente mantiene el estado **NO-GO**.
