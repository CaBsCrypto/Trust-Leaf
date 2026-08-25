# Runbook de ceremonia de claves para el próximo deploy Testnet

Estado: **preparación documental; no ejecutado**.
Este runbook no autoriza crear, importar, exportar, copiar, mostrar, mover o
almacenar claves; tampoco autoriza deploy, firma o submission. La ejecución de
cada ventana requiere aprobación humana separada y sólo fixtures sintéticos.

Documento de riesgos asociado:
[`key-custody-threat-model.md`](./key-custody-threat-model.md).

## 1. Objetivo y reglas inmutables

Preparar una ceremonia reproducible para que claves técnicas no exportables
autoricen `TrustRegistry` y `ReceiptLedgerV2` en Stellar Testnet con separación de
funciones. La fuente clínica permanece cifrada off-chain y fuera de esta ceremonia.

Reglas:

- nunca pegar semillas, secretos, tokens, XDR firmado, payloads o direcciones en
  consola compartida, chat, ticket, captura, evidencia o commit;
- nunca ejecutar comandos de mostrar/exportar claves;
- no derivar alias, cuentas o commitments desde nombre, RUT, email, wallet o dato
  de una persona;
- no usar cuentas de mainnet, producción, pagos, fondos reales o participantes;
- no activar `TRUSTLEAF_TESTNET_SUBMIT_ENABLED` ni
  `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS` durante la preparación;
- un `unknown`, mismatch de versión o configuración incompleta detiene la sesión;
- no existe fallback a secretos inline, CLI local o una clave compartida;
- cuatro ojos para todo cambio de policy, clave admin, deploy o recuperación.

## 2. Roles de la sesión

Asignar personas diferentes antes de reservar la ventana:

| Rol de ceremonia | Responsabilidad | No puede |
|---|---|---|
| director | lee pasos, controla alcance y criterios de parada | operar el proveedor o aprobar su propia excepción |
| custodio A/B | conforman quorum para admin y recuperación | ejecutar acciones diarias de médico/dispensario |
| operador plataforma | configura IAM/workload y provider adapter | aprobar su propio acceso |
| release/deployer | usa sólo el artefacto y red allowlisted | convertirse en admin persistente |
| operador de submission | transporta envelope aprobado | elegir signer, payload o contract ID |
| seguridad | compara policy efectiva y threat model | manipular material privado |
| QA observador | captura evidencia sanitizada y negativos | solicitar acceso de firma |
| incident commander | decide pausa/abandono ante anomalía | forzar continuación para completar el smoke |

Registrar sólo nombres internos de rol/responsable en el acta de acceso restringido;
la evidencia compartible usa las etiquetas de esta tabla.

## 3. Formato de inventario sanitizado

El inventario operativo restringido puede contener referencias del proveedor y
public keys. El artefacto compartible de este repositorio sólo admite:

```json
{
  "schema": "trustleaf.key-inventory-summary.v1",
  "environment": "stellar-testnet",
  "roles": [
    {
      "role": "registry-admin",
      "present": false,
      "providerConfigured": false,
      "activeVersionPresent": false,
      "policyValidated": false,
      "balanceSufficient": false,
      "status": "BLOCKED"
    }
  ],
  "submissionEnabled": false,
  "mutationsEnabled": false,
  "blockers": ["STABLE_CODE_ONLY"]
}
```

Prohibido en este resumen: alias reales, direcciones, saldos exactos, ARN/URI,
project IDs, key IDs, versiones concretas, seeds, tokens, firmas, XDR, payloads,
digests, receipt IDs, operation IDs y valores de configuración.

Si en una sesión posterior se valida un alias Testnet existente, la comprobación
debe consumir el alias desde un input local no registrado y emitir únicamente
`present`, `balanceSufficient` y un código estable. No debe imprimir alias,
dirección ni saldo. En esta fase no se ejecuta esa comprobación.

## 4. Fase A — preflight local sin secretos

Responsables: director + QA. Se puede ejecutar ahora.

- [ ] rama/worktree aislado y árbol limpio;
- [ ] confirmar que el diff no contiene material sensible;
- [ ] confirmar que ambos flags están exactamente en `false`;
- [ ] confirmar que los tres campos legacy de secretos inline están vacíos;
- [ ] ejecutar `npm run test:server-auth-custody`;
- [ ] ejecutar `npm run test:auth-custody-readiness`;
- [ ] ejecutar `npm run test:stellar-rpc-prep` con transporte sintético;
- [ ] ejecutar `npm run contract:test:credentials`;
- [ ] ejecutar `npm run preflight` antes de proponer integración;
- [ ] archivar sólo PASS/FAIL, commit, hash de artefactos públicos y códigos de
  bloqueo; nunca stdout crudo del proveedor.

El inspector actual puede declarar `ready` con configuración sintética, pero eso
no equivale a custodia real ni autorización de deploy.

## 5. Fase B — decisión y policy review (bloqueada)

Responsables: seguridad + plataforma + owners humanos.

- [ ] ADR de proveedor KMS/HSM aprobada;
- [ ] compatibilidad exacta de firma Stellar/Soroban demostrada con fixture;
- [ ] admin M-de-N, custodios y break-glass definidos;
- [ ] deployer, operator, doctor-service y dispensary-service separados;
- [ ] workload identities no humanas y expiración de sesión definidas;
- [ ] IAM deny-by-default revisada mediante permisos efectivos;
- [ ] allowlists de red, RPC, WASM, contratos, métodos y versiones congeladas;
- [ ] cuotas, fee caps, rate limits y ventana de ejecución aprobados;
- [ ] auditoría, alertas y reconciliación `unknown` disponibles;
- [ ] plan de rotación, compromiso, pérdida y teardown aprobado.

Salida sanitizada: decisión GO/NO-GO, roles aprobadores, IDs de tickets internos y
códigos de bloqueo. No adjuntar policy completa si revela nombres de recursos.

## 6. Fase C — provisión de claves (requiere autorización futura)

Esta fase no contiene comandos ni procedimientos de creación/importación. Cuando
se autorice, el proveedor elegido debe suministrar su procedimiento verificado y
dos custodios deben observarlo sin exponer material privado.

Condiciones mínimas:

1. entorno no productivo y tenant/proyecto aislado;
2. algoritmo/formato verificados para Stellar;
3. generación dentro del límite criptográfico; export deshabilitado;
4. tags/labels sin PII ni nombres de participantes;
5. IAM por workload y rol, sin usuario humano permanente;
6. versión activa fijada en policy server-side;
7. public key comparada por canal restringido contra la cuenta técnica esperada;
8. auditoría del proveedor activa antes de la primera firma;
9. inventario sanitizado actualizado sólo con booleanos;
10. flags de TrustLeaf todavía en `false` al cerrar la fase.

Cualquier clave que haya sido mostrada, copiada o exportada se considera
comprometida y no puede usarse.

## 7. Fase D — dry run de firma sin submission (requiere autorización futura)

Objetivo: probar policy y firma de un payload sintético canónico sin enviar red.

- [ ] construir una intención fija sin datos reales;
- [ ] confirmar role/scope/object authorization server-side;
- [ ] confirmar RPC, passphrase, WASM y contratos allowlisted;
- [ ] simular y comparar el digest canónico;
- [ ] solicitar firma por alias lógico y versión fijada;
- [ ] validar firma contra la public key esperada sin registrarla en el reporte;
- [ ] demostrar deny para rol cruzado, alias desconocido, versión anterior,
  provider down, payload alterado y flag distinto de `false`;
- [ ] demostrar que logs no contienen payload, digest, firma, XDR o identificador;
- [ ] descartar el envelope de prueba; no habilitar transporte ni submission.

La evidencia registra conteos y códigos de resultado, no artefactos firmados.

## 8. Fase E — deploy y smoke (fuera de autorización actual)

Sólo se abre con una aprobación explícita posterior que identifique hashes WASM,
red, ventana, roles y alcance. El orden futuro es:

1. deployer publica `TrustRegistry` con el WASM aprobado;
2. quorum admin inicializa el registry;
3. deployer publica `ReceiptLedgerV2` con el WASM aprobado;
4. quorum admin inicializa ledger con el registry exacto;
5. observador verifica read-only IDs, vínculos y estados;
6. una segunda autorización habilita un smoke mutante sintético acotado;
7. operator transporta envelopes ya autorizados; nunca firma actores;
8. indexador reconcilia eventos y cualquier `unknown` antes de continuar;
9. cerrar inmediatamente flags y ventana al terminar.

Deploy y smoke son decisiones distintas. Haber desplegado no autoriza emitir una
credencial, receipt o dispensación.

## 9. Rotación ordinaria

La rotación se prueba primero con fixtures y nunca se improvisa durante un deploy.

1. pausar nuevas intenciones; dejar submissions cerradas;
2. reconciliar todas las operaciones `pending/unknown`;
3. aprobar una nueva versión dentro del proveedor con quorum;
4. validar public key/policy por canal restringido;
5. actualizar versión fijada mediante cambio revisado;
6. demostrar que versión anterior y nueva no aprobada fallan;
7. ejecutar dry run sin submission;
8. cambiar atomícamente la versión activa;
9. observar errores/denegaciones durante la ventana acordada;
10. deshabilitar versión anterior sólo después del período de reversión aprobado;
11. registrar resultado sanitizado y cerrar la ventana.

No se reutiliza un `operation_id` para otra intención ni se re-firma una operación
en estado `unknown`.

## 10. Revocación, compromiso y recuperación

### Sospecha o compromiso

1. detener firma y submission en aplicación, policy y proveedor;
2. no borrar evidencia ni intentar “probar” la clave;
3. bloquear workload identities afectadas y sesiones activas;
4. reconciliar read-only el último estado conocido;
5. clasificar contratos/roles y ventana de exposición;
6. revocar/deshabilitar con quorum, no con el operador afectado;
7. decidir si la recuperación segura exige nuevos contratos; Testnet es público e
   inmutable y no se corrige borrando eventos;
8. notificar, hacer postmortem y repetir negativos antes de reabrir.

### Pérdida o indisponibilidad sin compromiso

- fallar cerrado y mantener cola sin re-firmar;
- usar HA del proveedor sólo si ya estaba aprobada y conserva misma policy;
- no caer a seed local, variable de entorno o signer de otro rol;
- si se supera RTO, el incident commander decide abandono/redeploy, no bypass.

### Break-glass

Requiere quorum, motivo, duración, scope mínimo y revisión posterior. Break-glass
puede pausar o recuperar policy; no puede revelar/exportar claves ni omitir auth,
allowlists, simulación o reconciliación.

## 11. Teardown

- restaurar y verificar ambos flags en `false`;
- invalidar sesiones/credenciales temporales de workload;
- retirar deployer/operator de ventanas y allowlists temporales;
- conservar claves deshabilitadas según la política de evidencia; no destruir sin
  aprobación y análisis de recuperación;
- confirmar que servicios sólo responden read-only o fail-closed;
- guardar evidencia sanitizada, hashes públicos y códigos de resultado;
- documentar cualquier recurso Testnet que continúa público sin vincularlo a una
  persona;
- abrir acciones para anomalías y no declarar GO mientras sigan abiertas.

## 12. Criterios GO/NO-GO

GO para solicitar una ceremonia posterior sólo si:

- suites locales y contratos pasan desde el commit candidato;
- threat model, ADR, roles y separación de duties están aprobados;
- provider PoC, IAM, auditoría, rotación y recuperación tienen evidencia;
- allowlists exactas y artefactos reproducibles están congelados;
- no hay secretos inline ni material sensible en repo/logs;
- indexador/reconciliador y respuesta `unknown` están operativos;
- la sesión tiene director, seguridad, QA y quorum requeridos;
- existe autorización humana específica para esa fase.

NO-GO ante un solo blocker, mismatch, salida sensible, rol acumulado, fallback,
timeout no reconciliado o pedido de ampliar el alcance. El resultado técnico no
constituye receta válida, atención clínica, cumplimiento legal ni autorización de
usar pacientes reales.
