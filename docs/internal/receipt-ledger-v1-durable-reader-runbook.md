# Lector durable read-only — ReceiptLedger V1 desplegado

Estado: **implementado y verificable localmente**. La conexión al RPC real es
una ejecución explícita, separada del `preflight`. No firma, simula ni envía
transacciones; no crea tokens QR y no acredita validez clínica o legal.

Este lector existe para cotejar la evidencia sintética ya desplegada en Stellar
Testnet mientras TrustRegistry + ReceiptLedgerV2 permanecen sin desplegar. El
artefacto V1 revisado está fijado por:

- Stellar Testnet y passphrase exacta;
- RPC HTTPS oficial allowlisted;
- contract ID del smoke sintético de 2026-08-22;
- SHA-256 del WASM revisado;
- ledger inicial revisado;
- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y
  `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`.

Los valores exactos viven en `.env.example` y en el registro histórico
[`testnet-receipt-smoke-evidence-20260822.md`](./testnet-receipt-smoke-evidence-20260822.md).
Cambiar un valor para acomodar una discrepancia es **NO-GO**.

## Controles implementados y cubiertos

- Construcción lazy: instanciar el servicio no accede a red.
- La fábrica oficial construye internamente RPC, transporte, métricas y journal;
  rechaza propiedades `server`, `transport`, `attest` o `store` inyectadas. El
  arnés inyectable separado siempre reporta `mode=fixture`.
- Attestation previa: compara passphrase, contract ID y hash del bytecode
  retornado por RPC antes del primer poll. La ejecución acotada termina al
  recuperar el ledger `4282756`, último ledger de evidencia documentado; no
  barre indefinidamente la red después de esa ventana.
- Reutiliza el decoder V1 de `createStellarRpcReceiptEventTransport` y acepta
  sólo eventos lifecycle exitosos del contrato exacto, con IDs opacos de 32
  bytes y versiones positivas.
- Lee ledger, padre y tip previamente guardado. Un cambio del hash del tip
  reemplaza conservadoramente ese ledger mediante el journal CAS; gaps y padres
  inconsistentes no avanzan el cursor.
- El store local usa lock, compare-and-swap y rename atómico. Recupera cursor y
  timeline tras reinicio. Es durable en un host para revisión, **no** es la
  base HA de producción.
- Timeout y reintentos son acotados. El agotamiento queda `unknown`; nunca se
  convierte en éxito ni activa submission.
- El reporte contiene sólo modo/red, booleanos, contadores y códigos cerrados.
  No imprime URL, contract/receipt/event ID, cursor/hash, XDR, identidad,
  secreto ni payload de eventos.
- `ready=true` exige attestation, store durable y cursor ya persistido. Un
  fixture en memoria o `caught-up` sin cursor permanece NO-GO.

Evidencia local sin red:

```text
npm run test:stellar-v1-durable-reader
npm run test:stellar-event-source
npm run test:receipt-indexer
npm run lint
```

La suite focalizada prueba allowlists, flags cerrados, lazy RPC, attestation,
cursor/restart, reemplazo de tip/reorg, retry `unknown`, store y redacción. Usa
fixtures inyectados; no consulta Testnet.

Evidencia live sanitizada del **2026-08-26**: una ejecución única con directorio
temporal nuevo, máximo 64 polls y ambos flags mutantes en `false` devolvió
`ready=true`, `durable=true`, `attested=true`, `cursorPresent=true`,
`submissionAttempts=0`, `mutationsAllowed=false` y
`evidenceWindowComplete=true`. El resultado confirma que el lector V1 recupera
la ventana sintética revisada; no acredita V2, validez clínica o aptitud para
datos reales.

## Ejecución live-read explícita

El comando `npm run live:testnet-v1:readonly` **no forma parte de `preflight`**.
Un operador debe revisar primero la configuración server-side de `.env.example`,
elegir un directorio absoluto privado y temporal para el journal, y habilitar
sólo `TRUSTLEAF_V1_READONLY_LIVE_ENABLED=true` durante esa lectura. Ambos flags
de mutación deben continuar literalmente en `false`.

El directorio debe ser **nuevo y vacío para cada ejecución**. El snapshot local
actual aún no vincula su procedencia a red/contract en metadata y el script hace
un poll antes de evaluar un cursor recuperado. Por ello, reanudar o reutilizar un
journal es NO-GO hasta agregar ese binding y el pre-check del cursor.

Salida esperada: un único JSON sanitizado. `ready=true` y
`evidenceWindowComplete=true` exigen attestation y recuperación de toda la
ventana histórica revisada. `unknown`, `rejected`, discrepancia de
hash/passphrase/contract, gap o error de store es NO-GO. No copiar el journal a
un canal público: aunque contiene únicamente evidencia técnica opaca, incluye
hashes y referencias de cadena que el reporte deliberadamente omite.

Después de la revisión:

1. detener el proceso;
2. volver `TRUSTLEAF_V1_READONLY_LIVE_ENABLED=false`;
3. conservar sólo el reporte sanitizado y la evidencia operativa aprobada;
4. eliminar o archivar el journal conforme a la política interna revisada;
5. no reutilizar este reader V1 como autorización para desplegar V2.

## Gates externos pendientes

- store durable HA con lease/leader, backup/restore y retención aprobada;
- segunda fuente RPC/indexador independiente para reconciliación;
- telemetría y alertas operativas redactadas con owner y SLA;
- backend autenticado para cualquier proyección UI por rol;
- configuración/deploy separado de TrustRegistry + ReceiptLedgerV2;
- revisión jurídica, clínica y farmacéutica. Ninguno de estos gates se presume
  cumplido por una lectura técnica exitosa.
