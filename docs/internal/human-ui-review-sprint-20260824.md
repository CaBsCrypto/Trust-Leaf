# Sprint de revisión humana UI + evidencia Testnet

Base: `f7374d1`. Candidata: `integration/human-ui-candidate-20260824`.

## Objetivo

Entregar una preview local navegable por médico, paciente, dispensario y admin, vinculada únicamente en lectura al receipt ya desplegado en Stellar Testnet:

- contrato: `CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3`;
- explorador: `https://stellar.expert/explorer/testnet/contract/CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3`.

La evidencia de red prueba existencia técnica del contrato/eventos, no identidad, contenido clínico, legalidad ni validez de una receta.

## Frentes

| Frente | Rama | Estado | Gate |
|---|---|---|---|
| UI/evidencia on-chain | `sprint/ui-onchain-review-20260824` | COMPLETADO | vistas por rol, enlaces correctos, cero writes |
| guion visual/E2E/backlog | `test/visual-readonly-qa-20260824` | COMPLETADO | rutas y negativos reproducibles |
| Scrum/integración/browser QA | `integration/human-ui-candidate-20260824` | COMPLETADO PARA REVISIÓN LOCAL | suite combinada + Browser desktop/móvil |

## Límites

- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`;
- sólo fixtures sintéticos, sin login ni infraestructura externa;
- no RPC writes, deploy, push, main ni datos reales;
- no mezclar IdP, Postgres/Supabase, KMS/HSM o adapters durables con este paquete de interfaz.

## Candidata y evidencia reproducible

- preview local activa: `http://127.0.0.1:5196/demo/receipt-pilot?role=doctor&scenario=active`;
- el contrato abrió en Stellar Expert como `WASM contract`, red `testnet`, con el mismo contract ID;
- Browser: PASS en los cuatro roles, escenarios `active`, `partial`, `dispensed`, `revoked`, `expired` y `unknown`, QR público mínimo, query manipulada con defaults seguros y admin con tres acciones deshabilitadas;
- responsive: PASS a `390 × 844`, `scrollWidth === clientWidth`, sin texto clínico, identidad o secretos;
- foco: el control seleccionado expone `:focus-visible` y outline nativo; el recorrido completo por teclado queda como verificación humana P1;
- la evidencia externa se limita al timeline del escenario visible; `unknown` no enlaza una transacción como confirmada;
- todas las suites de `preflight` y TypeScript pasaron. El build encontró `spawn EPERM` dentro del sandbox y pasó al repetir `npm run build` fuera de esa restricción: 2.425 módulos.

**Estado final:** GO sólo para revisión humana local/read-only. NO-GO para merge a `main`, nuevas submissions Testnet, deploy o producción.
