# Sprint read-only UI/QR — gates Testnet

Alcance: lectura del contrato `CA7S…OSY3` ya desplegado, con fixtures sintéticos. No es receta ni validación clínica/legal. No habilita escritura, pagos, producción o datos reales.

## Controles implementados

- Endpoint server-side con contract ID cerrado, RPC HTTPS, timeout y `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` obligatorio.
- QR opaco de 256 bits autenticado con HMAC server-side; entradas inválidas no llegan al RPC.
- Proyección exacta `demo`, `evidenceExists`, `proofMatches`, `status`; sin identificadores, actores, saldo, contenido clínico ni timeline.
- Sólo eventos exitosos del contrato allowlisted y schema v1; versiones no contiguas fallan cerrado.
- Negativo uniforme, rate limit local, `no-store`, `no-referrer` y `noindex`.

## Evidencia

`npm run test:readonly-ui-qr`, `npm run test:public-verification`, `npm run test:stellar-event-source`, `npm run lint`, `npm run build`.

## Pendientes

- Rate limit distribuido, métricas redactadas, HMAC en KMS/HSM y mapping opaco durable.
- Indexer durable con cursor/paginación; la lectura RPC actual está acotada al smoke y falla cerrado.
- E2E navegador local y revisión auth/RBAC antes de detalle por rol.
- Autorización separada antes de submissions, deploy web, producción o datos reales.
