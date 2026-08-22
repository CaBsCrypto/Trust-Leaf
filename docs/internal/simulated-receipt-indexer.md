# Indexador y reconciliador simulado de receipts

## Alcance validado

Este componente es un arnés local con eventos y datos sintéticos. No consulta RPC, no firma, no envía transacciones, no guarda secretos y no constituye evidencia clínica o legal. Complementa `ReceiptLedgerPort`: el ledger conserva las operaciones de producto y `ReceiptEventIndexerPort` modela la observación ordenada de eventos opacos.

Controles implementados y probados:

- cursor por secuencia/hash y rechazo de gaps o parent hash divergente;
- finality configurable por profundidad, sin convertir eventos recientes en confirmados;
- ingestión idempotente de un ledger repetido y detección fail-closed de conflictos de operation ID;
- versiones contiguas por receipt opaco;
- rollback lógico ante fork en la misma altura; lo huérfano queda `unknown` hasta resolución explícita;
- prohibición de confirmar como canónico un evento cuyo ledger ya no es canónico;
- retries acotados que terminan en `unknown`, nunca en éxito supuesto;
- auditoría limitada y redactada: código, tiempo, altura y referencia pseudónima no textual de operación. No registra payloads ni mensajes de error. La referencia no es una garantía criptográfica y sólo se acepta porque los operation IDs del arnés son opacos y de alta entropía.

Evidencia reproducible:

```text
npm run test:receipt-indexer
```

La prueba cubre orden, profundidad, duplicados, gaps, parent mismatch, reorg, resolución `unknown`, conflicto de idempotencia, gap de versión, redacción y retry limitado.

## Gate pendiente

No están implementados ni simulados como finales: RPC Stellar, persistencia durable/HA, retención operativa, autenticación productiva, KMS/custodia, política de finality aprobada, observabilidad externa o recuperación ante reset de Testnet. Conectar este puerto a Testnet requiere una autorización separada y pruebas de integración contra infraestructura allowlisted.
