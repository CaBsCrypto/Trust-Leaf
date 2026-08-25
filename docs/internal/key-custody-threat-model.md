# Threat model de claves y custodia para Stellar Testnet

Estado: **diseño interno; NO-GO para provisión, firma, deploy o submission**.
Alcance: próxima demostración exclusivamente sintética de `TrustRegistry` y
`ReceiptLedgerV2` en Stellar Testnet. Este documento no autoriza crear, exportar,
copiar, mover, revelar ni almacenar claves privadas, ni habilitar flags de mutación.

## 1. Hechos verificados y límites actuales

### Implementado localmente

- `api/_lib/signer-custody.ts` define un `CustodyProvider` que firma un digest
  dentro del proveedor y no entrega material privado al orquestador.
- La política local exige alias allowlisted, versión fijada y
  `submissionEnabled: false`; falta, rotación inesperada o versión incorrecta
  deniegan la solicitud.
- La auditoría del puerto no contiene digest, payload, firma, token ni material
  del proveedor. La suite `npm run test:server-auth-custody` verifica estas
  negativas con fixtures sintéticos.
- `inspectAuthCustodyReadiness` entrega sólo booleanos y códigos de bloqueo.
  También falla si encuentra cualquiera de los campos legacy de secretos inline.
  La suite es `npm run test:auth-custody-readiness`.
- `KeyCustodyPort` en el almacén cifrado sólo tiene una implementación in-memory
  con KEK sintética. Ese puerto de cifrado de datos es distinto del firmante
  Stellar y no es un KMS real.
- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false`,
  `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false` y
  `TRUSTLEAF_PILOT_RUNTIME=disabled` continúan siendo condiciones obligatorias.

### Pendiente o bloqueado

- No se ha seleccionado ni conectado un KMS/HSM, identidad de workload, política
  IAM, servicio de firma, multisig o almacenamiento durable de auditoría.
- No se consultaron alias locales, direcciones, saldos ni material de claves para
  producir este documento. Su existencia y correspondencia con roles no están
  confirmadas.
- El camino legacy `api/_lib/stellar.ts` todavía acepta secretos inline, crea
  keypairs en proceso y firma directamente. Aunque las mutaciones están cerradas,
  ese camino **no es elegible** para el próximo deploy y debe permanecer aislado.
- No están ejecutados los drills de rotación, revocación, pérdida, compromiso,
  quorum incompleto ni indisponibilidad del proveedor.
- No se ha demostrado que un proveedor concreto soporte el algoritmo, formato de
  firma y autorización Soroban requeridos por Stellar. Esto exige un PoC sintético
  independiente antes de elegir proveedor.

## 2. Dominios criptográficos separados

Ninguna clave o identidad puede reutilizarse entre estos dominios:

| Dominio | Propósito | Material esperado | Nunca debe hacer |
|---|---|---|---|
| Firma Stellar | Autorizar acciones de una cuenta técnica | clave no exportable controlada por KMS/HSM o servicio aislado | cifrar ficha, firmar QR o autenticar usuarios |
| Cifrado off-chain | Envolver DEK por registro/revisión | KEK versionada no exportable | firmar transacciones o generar IDs públicos |
| Commitment/mapping | Crear referencias opacas por dominio | clave HMAC separada y rotatable | contener PII/PHI o ser una clave Stellar |
| QR público | Autenticar handle público de alta entropía | clave dedicada, con rotación compatible | revelar receipt, actor, identidad o historia |
| Identidad backend | Verificar JWT/claims del IdP | JWKS/credenciales de workload | conceder autoridad on-chain por sí sola |

La chain recibe sólo IDs, commitments y eventos técnicos opacos. Nunca recibe
PII/PHI, RUT, email, diagnóstico, medicamento, dosis, gramaje, saldo, PDF,
consentimiento, ficha clínica ni identificadores correlacionables con una persona.

## 3. Inventario lógico sanitizado

Este inventario registra únicamente etiquetas de rol. El registro operativo
futuro debe guardar internamente un identificador público y una referencia al
proveedor, pero sus reportes compartibles sólo pueden mostrar presencia, versión,
estado y códigos estables.

| Etiqueta de rol | Uso exacto | Autoridad permitida | Prohibiciones | Estado |
|---|---|---|---|---|
| `registry-admin` | Inicializar y gobernar credenciales de médico/dispensario; materializar expiración de seguridad | métodos admin allowlisted de `TrustRegistry`; init aprobada de ambos contratos | emitir elegibilidad de paciente, emitir/dispensar receipts, operar transporte diario | pendiente de diseño multisig |
| `contract-deployer` | Publicar los WASM aprobados y pagar fees Testnet | deploy de hashes allowlisted durante una ventana aprobada | ser admin persistente, operar receipts, rotar claves de otros roles | no provisionado/validado |
| `submission-operator` | Simular, transportar y reconciliar envelopes ya autorizados | RPC allowlisted, envío idempotente durante ventana aprobada | introducir autoridad de actor, firmar payload distinto, cambiar red/contrato/hash | adapter real no habilitado |
| `doctor-service` | Autorizar credencial de elegibilidad sintética y acciones del issuer | `issue_eligibility`, `issue`, `activate`, `set_grant`, `revoke` conforme a scopes | admin de registry, parcial/dispense, datos clínicos en payload | proveedor real pendiente |
| `dispensary-service` | Autorizar parcial o dispensado de receipt con grant vigente | `record_partial`, `mark_dispensed` conforme a scopes | emitir, activar, revocar receipt, administrar credenciales | proveedor real pendiente |
| `data-encryption-service` | Wrap/unwrap de DEK off-chain | contexto de cifrado y key version allowlisted | firmar Stellar, entregar KEK, descifrar fuera de propósito | sólo fixture local |
| `break-glass-approvers` | Autorizar pausa, revocación o recuperación excepcional | flujo humano M-de-N auditado | custodiar una clave operacional única o ejecutar actividad diaria | política pendiente |

El paciente no necesita ni recibe un signer Stellar. La cuenta técnica o receipt no
se presenta como identidad, wallet personal, NFT transferible ni receta válida.

## 4. Separación de funciones

| Acción | Solicita | Aprueba | Ejecuta | Verifica |
|---|---|---|---|---|
| Congelar WASM/IDL/hash | ingeniería contrato | seguridad + release | build reproducible | QA independiente |
| Proveer/rotar signer admin | plataforma custodia | dos aprobadores designados | operador KMS/HSM distinto | seguridad + auditoría |
| Deploy de contrato | release | owner técnico + seguridad | `contract-deployer` | observador read-only |
| Inicializar admin/registry | release | quorum admin | `registry-admin` | QA de contract ID/estado |
| Emitir credencial de actor | operaciones TrustLeaf | revisor operacional | `registry-admin` | auditor independiente |
| Acción de médico | servicio médico autenticado | policy engine server-side | `doctor-service`; operador sólo transporta | reconciliador/indexador |
| Acción de dispensario | servicio dispensario autenticado | policy engine server-side | `dispensary-service`; operador sólo transporta | reconciliador/indexador |
| Pausa por incidente | seguridad | quorum break-glass | plataforma | auditoría + release |
| Recuperación | plataforma | seguridad + owner de negocio | operador distinto del solicitante | revisor externo al cambio |

Reglas duras:

1. Una persona no puede aprobar y ejecutar su propia provisión o recuperación.
2. El deployer no conserva autoridad de negocio después del deploy.
3. El operador de submission no puede elegir el signer ni modificar el envelope.
4. El admin no sustituye la decisión del médico ni conoce datos clínicos.
5. Doctor y dispensario usan identidades técnicas separadas, con scopes y cuotas
   distintos; no existe signer global que pueda actuar como ambos.
6. La identidad backend `subject` se vincula a un actor/rol durable server-side;
   email, address, XDR o rol enviado por cliente nunca conceden autoridad.

## 5. Trust boundaries y flujo de autorización

```mermaid
sequenceDiagram
  participant U as Servicio de rol autenticado
  participant P as Policy engine server-side
  participant O as Orquestador idempotente
  participant K as KMS/HSM o servicio de firma
  participant R as RPC Testnet allowlisted
  participant I as Indexador/reconciliador

  U->>P: intención + recurso opaco + scope
  P->>P: auth, vínculo objeto, estado, cuota y allowlists
  alt denegación o configuración incompleta
    P-->>U: código estable; sin firma
  else permitido y ventana humana activa
    P->>O: intención canónica + operation_id
    O->>R: simulación read-only
    R-->>O: footprint y resultado simulado
    O->>K: digest canónico + rol + versión fijada
    K-->>O: firma; material privado no sale
    O->>R: envelope exacto una sola vez
    R-->>O: resultado o unknown
    O->>I: reconciliar sin re-firmar
    I-->>U: estado técnico sanitizado
  end
```

Una respuesta `unknown` bloquea todo reintento con un `operation_id` distinto. El
reconciliador debe resolver el resultado antes de permitir otra intención.

## 6. Amenazas y controles obligatorios

| Amenaza | Consecuencia | Control preventivo | Evidencia necesaria |
|---|---|---|---|
| secreto en env, CLI, log o ticket | control de cuenta técnica | clave no exportable; prohibir campos inline; redacción estructural; sin comandos `show/export` | scan de repo/config/logs + test negativo |
| confused deputy entre roles | médico actúa como admin o dispensario | subject→actor→role→scope durable; alias elegido por policy, no por request | E2E cruzado deny |
| colapso admin/deployer/operator | compromiso único gobierna todo | identidades, IAM y owners separados; quorum admin | revisión de permisos efectivos |
| downgrade o rollback de versión | firma con clave retirada | versión activa fijada; CAS; caché corta; invalidación inmediata | drill de rotación y versión obsoleta deny |
| KMS/HSM indisponible | presión para bypass manual | fail-closed; cola/outbox; `unknown`; sin fallback inline | chaos test y runbook de espera |
| compromiso de workload identity | firmas no autorizadas | identidad no exportable, audience/context, cuotas, allowlist de método/contrato/hash/red | prueba IAM negativa y alertas |
| contrato/red/WASM equivocados | evidencia en destino incorrecto | passphrase, RPC, contract ID y SHA-256 allowlisted; doble revisión | manifiesto firmado de artefactos |
| replay o doble submission | estado duplicado/inconsistente | operation ID canónico, idempotency store durable, versión/CAS, reconciliación | replay/concurrencia E2E |
| mutación del envelope tras aprobación | firma de acción distinta | digest canónico; comparar simulación, envelope y digest antes de firma | tamper test |
| admin comprometido | credenciales falsas o suspensión abusiva | quorum, límites de métodos, alertas, pausa y nueva instancia planificada | ejercicio de compromiso |
| recuperación usada como bypass | toma de control silenciosa | M-de-N, espera, ticket, sesión grabada sin secretos, notificación independiente | drill aprobado |
| metadata o timing correlacionable | inferencia sobre participante | payload opaco de forma fija; batching cuando proceda; sin etiquetas humanas | privacy scan de eventos |
| observabilidad filtra material | secreto o identificador en SIEM | allowlist de campos y códigos; no payload/digest/firma/XDR/token | snapshot de logs negativos |
| supply-chain del signer | firma alterada o exfiltrada | versiones fijadas, attestation si existe, dependencias/imagen verificadas | SBOM/hash/revisión de build |

Riesgo residual explícito: los eventos de un mismo receipt siguen siendo
correlacionables en una red pública. El diseño reduce el vínculo con personas,
pero no puede eliminar la correlación temporal ni borrar historia de Testnet.

## 7. Allowlist mínima y defaults fail-closed

La configuración server-side debe validar en conjunto, nunca parcialmente:

- red `Testnet` y passphrase exacta;
- RPC HTTPS exacto y sin redirecciones;
- hashes WASM aprobados para `TrustRegistry` y `ReceiptLedgerV2`;
- contract IDs resultantes y vínculo registry→ledger esperado;
- métodos permitidos por cada rol;
- alias lógico, versión de clave y public key esperada por rol;
- subject, actor, credencial activa, recurso y scopes efectivos;
- límites de monto de fee, secuencia, timeout, expiración y cuota;
- flags de mutación y submission cerrados fuera de una ceremonia autorizada;
- auditoría durable y reconciliador disponibles antes de cualquier firma.

Falta, vacío, duplicado, versión desconocida, mismatch o proveedor degradado deben
producir un código de bloqueo y cero firmas. No existe un valor por defecto que
habilite firma o submission.

## 8. Decisión de proveedor KMS/HSM

No se recomienda aún un proveedor. La selección requiere un PoC sintético que
demuestre compatibilidad Stellar sin exportar claves. Las alternativas a comparar
son:

| Patrón | Ventaja | Riesgo/costo | Condición mínima |
|---|---|---|---|
| KMS administrado con firma asimétrica | operación y auditoría simplificadas | soporte algorítmico/formato puede no ser compatible; dependencia cloud | PoC exacto de firma Stellar/Soroban + IAM por workload |
| HSM administrado/dedicado | políticas y control criptográfico fuertes | mayor operación, costo y complejidad de quorum/backup | soporte verificable, HA y ceremonia M-de-N ensayada |
| servicio de firma aislado sobre HSM/KMS | policy engine y canonicalización controlables | nueva superficie, cola, disponibilidad y supply-chain | API mínima, mTLS/workload identity, attestation y auditoría durable |
| CLI/archivo local | útil sólo en smoke histórico controlado | exportable, operador único, difícil segregación | **rechazado para el próximo deploy** |

Criterios de decisión:

1. firma compatible con cuentas Stellar y autorización Soroban sin exponer seed;
2. creación/importación prohibida en este sprint y futura provisión con quorum;
3. IAM por rol, método, entorno y workload; sin credenciales humanas permanentes;
4. versionado, disable/revoke, rotación sin pérdida y recuperación documentada;
5. logs redactados, métricas, cuotas, alertas y evidencia de acceso;
6. disponibilidad Testnet, latencia, límites, costo y residencia/contrato del dato;
7. backup o estrategia de reemplazo que no requiera exportar una clave privada;
8. capacidad de probar pérdida, compromiso y continuidad con fixtures.

## 9. Decisiones humanas pendientes

Antes de aprovisionar cualquier identidad real de Testnet se necesita una única
ADR aprobada que resuelva:

1. proveedor y región/entorno no productivo;
2. patrón exacto de admin M-de-N y nombres de los roles aprobadores;
3. quién es owner de deployer, operator, doctor-service y dispensary-service;
4. si las cuentas se generan dentro del proveedor o se usa otro mecanismo no
   exportable, siempre en una ceremonia posterior autorizada;
5. IAM, workload identity, cuotas y método de attestation;
6. retención de auditoría, SIEM/alertas y responsable de respuesta;
7. RTO/RPO para pérdida/indisponibilidad y estrategia de reemplazo de contratos;
8. aceptación del riesgo residual de correlación pública;
9. autorización separada para provisión y otra para deploy/submission.

Si falta una decisión, una evidencia o un owner: **NO-GO**.
