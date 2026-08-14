# QA reproducible — demo/piloto sintético

## Comandos base

```powershell
npm install
npm run lint
npm run build
```

## Pruebas obligatorias

1. Sin `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=true`, cada POST mutante (`faucet`, alta, emisión, dispensación y relayer) devuelve `503`/`TESTNET_MUTATIONS_DISABLED` y no firma.
2. La UI sin signer muestra `DEMO / NO VÁLIDA`; no usa “emitida”, “legal” ni “firmada”.
3. Completar cinco veces con personajes distintos: reserva → consentimiento → llegada → consulta → nota → vista previa → entrega simulada → historial.
4. Refrescar/cerrar en cada paso y registrar qué estado se pierde. Todo lo dependiente de `localStorage` se considera demo, nunca evidencia clínica.
5. Probar cancelación, consentimiento vencido/revocado, doble clic, timeout, error de red y reintento. No debe duplicar receta/entrega ni mezclar pacientes.
6. Verificar que UI, logs, URL y cadena no contengan RUT, diagnóstico, nota ni texto de receta.

La barrera se valida automáticamente con `npm run test:pilot-safety`.

Abrir una ventana testnet sintética exige autorización operativa explícita, `NODE_ENV` distinto de producción, `TRUSTLEAF_PILOT_RUNTIME=local-synthetic`, endpoints oficiales testnet exactos, relayer solo en localhost y la variable temporal `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=true`. No debe habilitarse en un deployment accesible mientras no exista autenticación/RBAC. Al terminar debe volver a `false` y revisarse la evidencia de transacciones.
