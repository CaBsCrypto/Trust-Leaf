# Evidencia — receipt-ledger Stellar Testnet (2026-08-22)

Resultado: **GO técnico del smoke sintético Testnet**. No es una receta, no usa pacientes ni datos reales y no acredita validez clínica, farmacéutica o legal. Producción, mainnet, pagos y web deploy permanecen fuera de alcance.

## Artefacto y red

- Rama de ceremonia: `integration/onchain-testnet-readiness-20260822`.
- Commit de pre-gate: `bf1f511d93d078a32c569eb53c113caaf6c521d0`.
- Red: Stellar Testnet; RPC oficial saludable.
- WASM: 12.665 bytes.
- SHA-256: `718467336c29d771af93612ecaa3954ec3bd14837ad2c219587e5b75e591e370`.
- Contract ID: `CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3`.
- [Contrato en Stellar Lab](https://lab.stellar.org/r/testnet/contract/CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3).
- [Contrato en Stellar Expert](https://stellar.expert/explorer/testnet/contract/CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3).

La IDL extraída del mismo WASM expone 11 funciones, receipt no transferible y eventos `schema_version=1`. El escaneo no encontró PII/PHI, diagnóstico, medicamento, dosis, gramaje, cantidad, saldo, PDF, metadata clínica ni método de transferencia.

## Deploy e inicialización

- [Upload WASM](https://stellar.expert/explorer/testnet/tx/62db4e4d22389c0e0bd56060df8b00fbba9121b2e15cf1f0823e01d1523b87db).
- [Deploy contrato](https://stellar.expert/explorer/testnet/tx/d59dcbf7ab12387f27e2fc29893eaa08e0f5a47473c41c48a52e7821163be2e0).
- [Inicialización admin técnico](https://stellar.expert/explorer/testnet/tx/2132a816140f3b4c36d9ecfb50e5887913077db1655745a1853774e94c5b9ada).
- Roles técnicos habilitados: [médico](https://stellar.expert/explorer/testnet/tx/fb98641a9be669137d7a7a1f517b207d1fea9a4cf9fdd75644479daa01ac1ce7) y [dispensario](https://stellar.expert/explorer/testnet/tx/7c852a1db96b1b3bbed9b480fa6378f179ebb59d1cc38cb0e2dc2ecb484ae586).

Los aliases locales se usaron sin imprimir ni exportar semillas. Las cuentas son técnicas y sintéticas; KMS/HSM sigue siendo gate de cualquier entorno superior.

## Flujo on-chain confirmado

Receipt opaco independiente, una intención por `operation_id`, simulación previa y sin contenido clínico:

1. [Issued](https://stellar.expert/explorer/testnet/tx/6ae42822f355c848a878c4a75c5d86a8beec93d50913e42da22e55fe02eb241f).
2. [GrantChanged](https://stellar.expert/explorer/testnet/tx/8dcc85b499123997d768ecbc428c904a6b8971dcf5937384f24fee5787a32668).
3. [Active](https://stellar.expert/explorer/testnet/tx/24c600d34b808fd66c1bd074278e21bd9eaedd83ed90d7feec024f3004de848a).
4. [Partial](https://stellar.expert/explorer/testnet/tx/e5ce314dea2a5d1c65a13e26900b692552867225229c2717acafb40fb5b5fe6d).
5. [Dispensed](https://stellar.expert/explorer/testnet/tx/8a972d679987c5223e45fac0d784ab30b3eb7395f52570873fda24cca690ac86).

El estado final consultado fue `Dispensed`, versión 4. Dos receipts opacos separados terminaron en:

- [Revoked](https://stellar.expert/explorer/testnet/tx/fa758ef79cd0bd9e4aaf11bf3361803dd29d4a0a1479a99a409982d7f4ccfb6e), versión 2.
- [Expired](https://stellar.expert/explorer/testnet/tx/418789eeb55cc41ae2c3e00d90ce75d7bd03635013a6913cd04914ec1425a06f), versión 2.

## Replay, concurrencia e indexación

- Replay exacto de `issue`: idempotente; no creó un segundo evento de estado.
- Transición con `expected_version` obsoleto: rechazada por simulación `--send no`; no fue enviada.
- Hallazgo del runbook: `--build-only` sólo construye XDR y no valida el estado del ledger. La ceremonia ahora exige además `--send no` antes de firmar.
- Event source RPC real recorrió hasta ledger `4282756` y decodificó 11 eventos lifecycle: `issued`, `active`, `partial`, `dispensed`, `revoked` y `expired`, todos con schema v1. `GrantChanged` permanece fuera de la timeline pública.
- Se corrigió y cubrió con regresión el cursor inicial del indexador, que antes podía declarar `caught_up` al pedir sólo el ledger padre.

## QR y límites

La suite pública confirma una respuesta limitada a `{demo, evidenceExists, proofMatches, status}` y negativos de tamper/replay/expired/revoked. La UI pública aún no consulta directamente este contrato Testnet: enlazar contract ID/indexer durable/backend autenticado sigue pendiente. No se expone detalle de dispensación ni dato clínico mediante QR.

## Gates restantes

- Auth/allowlist real por rol y scope; IdP/JWKS.
- KMS/HSM, doble control, rotación y break-glass.
- Persistencia cifrada durable, backup/retención y auditoría append-only.
- Indexer durable y observabilidad operativa; el smoke usó lectura RPC acotada.
- Integración backend/QR con el contract ID allowlisted.
- Revisión jurídica, clínica y farmacéutica; ninguna se presume.
- Aprobación separada para cualquier nuevo deploy, web deploy, producción o mainnet.

Tras el smoke, la regla operativa vuelve a fail-closed: no se autoriza ninguna submission adicional por este documento.
