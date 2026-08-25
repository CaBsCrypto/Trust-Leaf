# Backlog UX interno — revisión local/read-only

Baseline inspeccionada: `f7374d1`, 2026-08-24. Este backlog registra brechas observables; no afirma que infraestructura, auth o lectura live estén implementadas.

## Revalidación de la candidata integrada

En `integration/human-ui-candidate-20260824` quedaron resueltos para la revisión humana local:

- `UX-RO-001`: contrato y enlaces históricos Stellar Expert ahora son visibles y están etiquetados como evidencia read-only;
- `UX-RO-002`: se eliminó de esta ruta la mezcla con el store mutable; cada estado visible se rotula como fixture;
- `UX-RO-003`: Admin técnico muestra el panel fixture con acciones deshabilitadas sin eludir `/admin` autenticado;
- `UX-RO-006`: selector allowlisted cubre activa, parcial, dispensada, revocada, expirada y fuente no disponible;
- `UX-RO-007`: rol y escenario quedan en query determinista, sin datos sensibles.
- `UX-RO-012`: la lista de transacciones externas sigue el timeline del escenario visible para todos los roles y no muestra evidencia falsa en `unknown`.

Permanecen abiertos `UX-RO-004`, `UX-RO-005`, `UX-RO-008`, `UX-RO-009`, `UX-RO-010` y `UX-RO-011`. La UI no consume RPC/indexer live; los enlaces históricos no prueban que el fixture renderizado corresponda a un receipt individual.

## P0 — necesario para la revisión humana contra chain

| ID | Hallazgo / reproducción | Impacto | Criterio de cierre |
|---|---|---|---|
| UX-RO-001 | `/demo/receipt-pilot` dice correctamente `simulación local`, pero no muestra el contract ID ni un enlace a Stellar Expert. | El revisor no puede distinguir ni contrastar visualmente el fixture con el smoke on-chain sin salir al runbook. | bloque `Evidencia Testnet read-only` con red, contract ID truncado/copiable, enlace seguro y aviso explícito de que el estado UI es fixture, sin receipt/persona correlacionable |
| UX-RO-002 | La misma pantalla combina un flujo mutable local y un fixture indexado fijo `partial`; ambos usan estados similares sin rótulo de origen en cada valor. | Puede interpretarse el timeline local como lectura live. | cada tarjeta identifica `fixture local mutable`, `fixture indexado local` o `evidencia pública Testnet`; ninguna usa `live` hasta probar RPC/indexer real |
| UX-RO-003 | El selector `Admin` dentro de `Lectura técnica por rol` sólo proyecta un receipt; no es el panel de colas/alertas. `/admin` exige sesión autorizada. | La ruta navegable no cubre una revisión visual completa del panel admin sin IdP. | añadir una vista admin técnica estrictamente fixture/read-only dentro de la candidata o un modo de revisión aislado que no eluda el gate productivo; mantener acciones deshabilitadas |

## P1 — accesibilidad, estados y claridad

| ID | Hallazgo / reproducción | Impacto | Criterio de cierre |
|---|---|---|---|
| UX-RO-004 | `src/index.css` no define `prefers-reduced-motion`. | No hay garantía global de respetar movimiento reducido. | regla verificada que elimina scroll suave y animaciones/transiciones no esenciales sin ocultar estado |
| UX-RO-005 | Los controles son botones semánticos con `aria-pressed` y `tabIndex=0`, pero no se confirmó un estilo de foco visible específico en el flujo. | Navegación de teclado puede resultar ambigua según estilos del navegador. | QA manual confirma foco visible AA en Volver, selectores, emisión, parcial y QR; añadir regresión visual/accesible |
| UX-RO-006 | Revoked, expired, unknown y errores no se seleccionan desde la candidata; sólo están en fixtures/tests o enlaces del runbook. | La revisión humana no cubre todas las proyecciones de estado. | selector de escenarios sintéticos read-only o rutas fixture deterministas para estados terminales/unknown, sin activar mutations |
| UX-RO-007 | Recargar reinicia `draft` y navegar directamente no conserva el rol/estado. | Reproducciones y capturas no son deep-linkables. | query/hash de escenario puramente sintético y allowlisted, o documentación visible del reset; nunca serializar datos sensibles |
| UX-RO-008 | La verificación pública muestra `Vigente` para `active`, pero la relación con un receipt Testnet concreto no es visible ni demostrada. | Riesgo de sobreinterpretar prueba local como evidencia on-chain. | rótulo de fuente y timestamp/cursor técnico read-only; respuesta pública conserva los cuatro campos y no expone timeline |

## P2 — refinamiento de la sesión de revisión

| ID | Mejora | Criterio de cierre |
|---|---|---|
| UX-RO-009 | Añadir resumen PASS/FAIL de los pasos del guion dentro de una sección QA local. | exportación local sin telemetría ni datos; estado no persiste fuera de la sesión |
| UX-RO-010 | Mostrar versión/commit de la candidata en modo técnico. | valor inyectado en build, no secreto, y claramente separado del estado del contrato |
| UX-RO-011 | Normalizar la capitalización de estados (`Active`, `Partial`) a español sin alterar enums técnicos. | etiquetas humanas consistentes; enum visible sólo en detalle técnico |

## Hallazgos confirmados en navegador local

- PASS: ruta `/demo/receipt-pilot` renderiza médico, paciente, dispensario y selector read-only con admin.
- PASS: emisión local produce `issued` y `active`; paciente obtiene existencia/estado y navegación QR por SPA.
- PASS: QR manipulado responde `No disponible`, sin consola de error ni campos adicionales.
- PASS: a `390 × 844` no se observó overflow horizontal (`scrollWidth === clientWidth`).
- PASS parcial de teclado: controles semánticos, habilitación coherente, `aria-pressed` y outline `:focus-visible` confirmado en el selector probado; el recorrido completo requiere confirmación humana.
- PASS: el enlace del contrato abrió en Stellar Expert como contrato WASM de Testnet con el contract ID esperado.
- PASS: la evidencia `Issued/Active/Partial/Dispensed/Revoked/Expired` visible se acota al timeline del escenario; `unknown` no presenta transacciones como confirmadas.
- LÍMITE: la UI usa fixtures locales; los enlaces Stellar Expert permiten contraste manual, pero no alimentan la pantalla mediante RPC/indexer live.
- LÍMITE: no se ejecutó login, RPC live, submission, deploy, persistencia ni datos reales.

## Seguimiento de QA y siguiente iteración

| ID | Hallazgo / reproducción | Impacto | Criterio de cierre |
|---|---|---|---|
| UX-RO-012 | Resuelto durante QA: `Paciente/Parcial` omitía `Partial` y mezclaba eventos posteriores por un filtro basado sólo en rol. | La evidencia podía contradecir el estado visible. | suite estática y Browser confirman `Issued → Active → Partial`; admin/revoked muestra `Issued → Revoked`; `unknown` queda vacío |
| UX-RO-013 | El estado renderizado sigue siendo fixture y no incluye cursor/timestamp firmado por el lector real. | El revisor puede confundir contraste histórico con lectura viva. | conectar un puerto read-only autenticado al indexer durable en otro sprint, sin introducirlo en este paquete de UI |
