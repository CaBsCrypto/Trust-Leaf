# Revisión local — TrustRegistry + ReceiptLedgerV2

Estado: GO sólo para revisión local con fixtures; NO-GO para deploy/submissions/Testnet/producción.

## Comandos

```powershell
npm run contract:test:credentials
npm run test:trust-registry-ui
npm run preflight
npm exec vite -- --host 127.0.0.1 --port 5197
```

Abrir:

`http://127.0.0.1:5197/demo/trust-registry?scenario=active`

## Guion visual

1. Confirmar `IDL local · sin deploy` y ausencia de contract ID nuevo.
2. `Cadena activa`: tres credenciales `active`; ReceiptLedgerV2 indica referencias activas/no vencidas.
3. `Médico suspendido`: doctor `suspended`; resultado `Acción bloqueada fail-closed`.
4. `Elegibilidad revocada`: elegibilidad `revoked`; resultado bloqueado.
5. `Dispensario vencido`: dispensario `expired`; resultado bloqueado.
6. Abrir `?scenario=forged`: debe normalizar a `scenario=active` sin revelar datos.
7. Repetir a `390 × 844`: no debe existir overflow horizontal.

En ninguna captura deben aparecer cuentas, claves, identidad, ficha, diagnóstico, medicamento, dosis, cantidad, dirección o datos reales. Las referencias `cred_*` y `rcpt_*` son fixtures truncados y no se consultan por red.

## Evidencia observada 2026-08-24

- Browser desktop: cuatro escenarios PASS; query manipulada vuelve a `active`.
- Browser móvil `390 × 844`: `scrollWidth === clientWidth`.
- consola: cero warnings/errors.
- la pantalla no contiene `fetch`, firma, invocación, submit ni controles mutantes.
- `npm run preflight`: PASS completo; build web de 2.427 módulos, con el warning histórico de chunks mayores a 800 kB.

## Gate siguiente

No solicitar deploy hasta aprobar [gate de redeploy Testnet](trust-registry-testnet-migration-gate.md). La UI local no demuestra lectura live, autenticación real, custodia, indexación ni cumplimiento legal/clínico.
