# Evidencia sintetica de auditoria, 30/09/2026

Baseline: `f1c8f0e1e2e3a3f6318a34283b2b82324f312965`. La decision y los
pendientes pertenecen al [tablero](../../DISPENSARY_CLOSEOUT_SPRINT.md#demo-y-adopcion-30092026).
No contiene capturas de contactos reales ni tokens. No acredita autonomia humana.

## Capturas

- `doctor-explicit-consultation.png`: fixture aislado; abrir/navegar no inicia
  atencion. La consulta comienza mediante accion explicita.
- `error-390-manager.png`: GET 503, cero POST, formulario conservado y confirmacion
  bloqueada. Mensaje de lectura confuso registrado como DEM-UX-01.
- `empty-390-operator.png`: estado vacio sintetico, distinto de error.

390 px es viewport simulado; no prueba teclado o navegador de telefono fisico.
Los servidores temporales de estas pruebas quedaron detenidos.

## Lectura compartida

`actor-read-coherence.json` procede de una nueva ejecucion del coordinador en
PGlite desechable en memoria, con red bloqueada y sin cargar credenciales.
Incluye hashes de fuentes, UUID generados, expectativas y proyecciones observadas;
no guarda valores de correo o telefono. No representa registros de B ni Browns.

Reproduccion conservada fuera de Git en
`D:/00 CODEX - OPENIA/review-artifacts/agente3-paciente-actor-read-coherence-20260930`.
Comando ejecutado:

```powershell
node "$artifact/actor-read-coherence.regression.mjs" --repo "$repo" --evidence "$artifact/coordinator-contract.json"
```

Resultado: **exit 1, ocho expectativas rojas**, no aprobacion de privacidad.
Una cuenta activa de B mantiene tratamiento, grant y comprobante de otra
organizacion cuando paciente o medico esta inactivo. Entregar se rechaza;
no aparecen notas, inventario ajeno ni nuevas entregas. El recibo propio de B
permanece; el paciente activo conserva recibos propios con medico inactivo.

Los cuatro casos de paciente contrastan la exigencia documental de paciente
activo. Los cuatro de medico reproducen comportamiento, pero exigir medico
activo para toda lectura compartida es una propuesta de coherencia con la
entrega, no una politica explicita ya comprobada. `valid_until` es pasado por
un segundo, no igualdad temporal ni prueba concurrente. HTTP se deriva del
mapper del API; las llamadas ejecutadas fueron SQL, no HTTP publicado.

No es una regresion permanente de CI todavia. El fix requiere prueba integrada
y preservacion de recibos propios; no editar migraciones antiguas ni publicar
una migracion desde el PR documental.

## Contraste independiente y frontera heredada

`independent-actor-read.json`: Planck ejecuto otro fixture PGlite con operador,
dos organizaciones y 1 g de cada una. Confirmo los cuatro negativos de paciente;
las expectativas de medico son politica propuesta. Cero notas expuestas, cero
entregas adicionales. Sus fuentes coinciden con los 35 hashes de Singer.

`legacy-handler-boundary.json`: exports serverless reales, adaptadores Stellar
falsos y red bloqueada. Las dos lecturas heredadas llegan al adaptador sin auth
y devuelven 200 anonimo; ni reachability ni datos reales desplegados comprobados.
Las mutaciones permanecen bloqueadas en modo production y con flags apagados.
Tambien registra falta de no-store y reflejo de un error upstream sintetico,
no secretos reales ni evidencia de cache CDN. No se envio XDR ni firma/relay.
Reproductores e informe estan en
`D:/00 CODEX - OPENIA/scratch/trustleaf-agent5-security-f1c8f0e`, fuera de Git.

Estas capturas y JSON no reemplazan una regresion permanente ni una lectura
publicada; preservan la procedencia de los bloqueos y sus limites.
