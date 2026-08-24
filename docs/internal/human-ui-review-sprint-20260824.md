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
| UI/evidencia on-chain | `sprint/ui-onchain-review-20260824` | EN CURSO | vistas por rol, enlace correcto, cero writes |
| guion visual/E2E/backlog | `test/visual-readonly-qa-20260824` | EN CURSO | rutas y negativos reproducibles |
| Scrum/integración/browser QA | `integration/human-ui-candidate-20260824` | EN CURSO | preflight + revisión Browser |

## Límites

- `TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false`;
- sólo fixtures sintéticos, sin login ni infraestructura externa;
- no RPC writes, deploy, push, main ni datos reales;
- no mezclar IdP, Postgres/Supabase, KMS/HSM o adapters durables con este paquete de interfaz.

**Estado inicial:** NO-GO hasta integrar y ejecutar QA visual local.
