# Adaptador Stellar Testnet simulado

Estado: **implementado y verificado localmente**. No realiza llamadas de red, no utiliza claves Stellar y no habilita submission real.

## Controles confirmados

- Configuración cerrada a la passphrase y RPC canónicos de Testnet, más allowlists explícitas de contract ID y hash WASM.
- `submissionEnabled` sólo acepta literalmente `false`; cualquier otro valor detiene la construcción del adaptador.
- El transporte debe declarar la capacidad literal `kind: 'simulated'`; un transporte sin marcador o con otro tipo se rechaza antes de preparar u operar.
- El signer usa material exclusivamente sintético y una versión esperada. Un secreto ausente o rotado falla de forma cerrada.
- Una operación conserva un digest estable. Reutilizar el mismo `operationId` con otro payload es conflicto; repetir una operación confirmada o sometida no vuelve a invocar `submit`. Repetir una operación `unknown` deriva automáticamente a `reconcile`, nunca a una nueva submission.
- Timeout, ausencia de confirmación o retroceso de secuencia producen `unknown`; nunca se interpretan como éxito.
- Los códigos provenientes del transporte se reducen a una allowlist léxica y no incorporan mensajes, payloads ni secretos.
- Fixtures y payloads contienen handles y commitments sintéticos, no PII/PHI ni contenido clínico.

Evidencia reproducible:

```text
npm run test:simulated-testnet-adapter
```

La suite cubre configuración no permitida, contract/hash fuera de allowlist, rechazo de transportes no simulados, submission real, secreto ausente/rotado, timeout, `unknown` sin resubmission, reintento idempotente, conflicto de idempotencia, orden/reorg simulado y redacción de errores.

## Pendiente y bloqueado

- No existe transporte RPC real, firma/custodia real, KMS, outbox durable, autenticación productiva ni indexación de Stellar.
- El simulador no demuestra finalización real, conducta de Testnet ni seguridad de infraestructura.
- Deploy, cuentas, fondeo y submission Testnet requieren autorización humana posterior y los gates del runbook.
- No acredita validez clínica, legal, farmacéutica ni tratamiento de datos reales.
