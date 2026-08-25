# Gates de auth y custodia para preparación Testnet

Estado: **preparación local con fixtures sintéticos; NO-GO para deploy o submission**.

Diseño operativo asociado: [threat model de claves y custodia](key-custody-threat-model.md)
y [runbook de ceremonia Testnet](testnet-key-ceremony-runbook.md). Estos artefactos
no autorizan provisión, deploy ni submission.

Evidencia local adicional: [gate KMS/HSM mock sin secretos](../../tests/key-custody-gate.test.ts)
y [preflight de inventario sanitizado](key-custody-preflight-qa.md). Ambos son
fixtures locales, mantienen las mutaciones cerradas y no prueban un proveedor real.

## Controles implementados y verificados

- Autorización exclusivamente server-side mediante un puerto `TokenVerifier`; headers de rol no otorgan autoridad.
- Validación cerrada de issuer, audience, expiración, subject allowlisted, rol y scopes efectivos por rol.
- Política de custodia con aliases allowlisted y versión de secreto fijada. Un secreto ausente, una versión anterior o una rotación inesperada bloquean la firma.
- El proveedor firma dentro de su interfaz: el orquestador no solicita ni recibe material secreto.
- Auditoría limitada a alias, versión y resultado/código seguro; no registra token, digest, firma, payload ni mensajes del proveedor.
- `submissionEnabled` sólo admite `false`; este frente no incluye RPC, envío de transacciones, cuentas, secretos ni proveedor KMS.
- El gate local separa `admin-quorum` M-de-N, `deployer`, `submission-operator`, `doctor-service` y
  dispensary-service; exige versiones fijadas, ciclo de vida, allowlists exactas y
  devuelve un proof marcado como no utilizable en Stellar.
- El preflight expone sólo booleanos, conteos, roles aprobados y códigos estables;
  rechaza campos extra, URL, direcciones, seeds y hashes en su salida, y siempre
  marca `deployReady: false`.
- Pruebas con identidades, tokens y material exclusivamente sintéticos: `npm run test:server-auth-custody`.
- Inspección sanitizada por presencia/formato público mediante `inspectAuthCustodyReadiness`; sólo devuelve booleans y códigos estables. En este checkout sólo existe `.env.example`: no hay configuración local de identidad/KMS, el receipt contract ID está vacío y los campos legacy de secretos están vacíos.

## Pendiente antes de Testnet

- Seleccionar y configurar proveedor de identidad, validar JWKS/firmas y revocación, MFA/sesiones, administración de allowlists y separación de funciones.
- Seleccionar KMS/HSM, identidad de workload, políticas IAM, dual control, cuotas, attestation cuando aplique, backup/restore y ceremonia de rotación/revocación.
- Integrar el authorizer en cada endpoint mutante y de detalle; definir matriz de scopes revisada por seguridad y responsables clínicos.
- Integrar signer con el adapter/outbox manteniendo simulate-before-submit, idempotencia y reconciliación `unknown`.
- Añadir rate limits, almacenamiento durable de auditoría sin PII/PHI, alertas y pruebas de recuperación/compromiso.
- Threat model actualizado, runbook, evidencia completa y autorización humana separada antes de cualquier deploy o submission Testnet.

La plantilla aún contiene nombres de variables legacy `STELLAR_*_SECRET`. Aunque están vacías, aceptar secretos inline debe eliminarse del camino Testnet; el gate sanitizado falla si cualquiera aparece poblada. También faltan `TRUSTLEAF_AUTH_*`, `TRUSTLEAF_KMS_*`, public key del signer, contract ID de receipt y el flag explícito `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false`.

No se declara autenticación real, custodia real, KMS configurado ni validez clínica/legal. La chain nunca debe recibir PII/PHI, dosis, gramaje, saldo o metadata clínica; el detalle permanece cifrado off-chain.
