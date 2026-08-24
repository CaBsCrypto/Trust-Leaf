# Guion visual/E2E read-only — candidata TrustLeaf

Fecha de baseline: 2026-08-24. Base revisada: `f7374d1`. Rama QA: `test/visual-readonly-qa-20260824`.

## Objetivo y límite operativo

Este guion permite a una persona revisar una candidata local con fixtures sintéticos y contrastarla, por enlaces públicos read-only, con el smoke ya registrado en Stellar Testnet. No crea transacciones, no consulta pacientes ni prueba autenticación, persistencia externa, validez clínica, autorización farmacéutica o cumplimiento legal.

Mantener en todo momento:

```text
TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false
TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false
TRUSTLEAF_PILOT_RUNTIME=disabled
```

Estado del gate: **GO sólo para revisión local/read-only; NO-GO para nuevas submissions, despliegue o producción**.

## Preparación reproducible

Desde el worktree candidato, sin copiar `.env` con secretos:

```powershell
git status --short --branch
npm run test:visual-readonly-review
npm run test:visual-qa-regressions
npm run dev
```

Abrir `http://localhost:3000/demo/receipt-pilot`. Si el puerto está ocupado, detener únicamente el proceso de TrustLeaf asociado antes de reintentar. El servidor Express de esta baseline fija el puerto `3000`.

## Superficies y verdad de datos

| Superficie | Ruta/acción exacta | Fuente visible | Qué sí demuestra | Qué no demuestra |
|---|---|---|---|---|
| flujo consolidado | `http://localhost:3000/demo/receipt-pilot?role=doctor&scenario=lifecycle` | fixtures sintéticos allowlisted | navegación por rol/estado y enlaces históricos Testnet | lectura live ni escritura del contrato desplegado |
| médico/paciente/dispensario/admin | selectores de la misma ruta | fixture local por escenario | visibilidad por rol y mutaciones bloqueadas | identidad, consentimiento o acto clínico real |
| panel admin técnico | seleccionar `Admin técnico` | colas/alertas sintéticas | superficie de revisión sin PHI y acciones disabled | autenticación o administración productiva |
| QR público | botón `Abrir verificación pública demo` / `/verify/<token-opaco>` | verificador sintético local | respuesta pública de cuatro campos y rechazo de tamper | correlación live con el receipt desplegado |
| admin autenticado | `http://localhost:3000/admin` | gate Firebase/allowlist | denegación por defecto sin sesión autorizada | una sesión admin disponible para esta revisión |
| evidencia on-chain | enlaces Stellar Expert siguientes | ledger público Testnet, smoke del 2026-08-22 | existencia de contrato y transacciones técnicas sintéticas | validez de receta, identidad o entrega material |

## Secuencia visual principal

Ejecutar primero a `1440 × 900` y repetir los pasos 1–8 a `390 × 844`.

1. Abrir `/demo/receipt-pilot?role=doctor&scenario=lifecycle`. Confirmar `Revisión local · sin submissions`, contract ID y botón `Abrir contrato en Stellar Expert`.
2. En `Médico técnico`, confirmar escenario `Ciclo completo`, estado `dispensed`, finalidad `confirmed`, operaciones bloqueadas y enlaces Issued/Active.
3. Cambiar a `Paciente sintético`. Confirmar que aparece `Abrir QR público demo`, que no aparece timeline operativo y que los enlaces visibles corresponden a estados públicos históricos.
4. Abrir el QR. Esperado: sólo `Vigente`, existencia y coincidencia, más aviso de exclusión de datos; volver con el navegador.
5. Cambiar a `Dispensario técnico`. Confirmar timeline local versionado y enlaces Partial/Dispensed, sin saldo, cantidad, identidad ni acción de escritura.
6. Cambiar a `Admin técnico`. Confirmar colas sintéticas, receipt opaco, alertas y tres acciones disabled; ningún dato clínico.
7. Recorrer escenarios `Revocada`, `Expirada` y `Fuente no disponible` para cada rol. Confirmar que query `role`/`scenario` cambia de forma determinista y que `unknown` no se presenta como confirmación.
8. Abrir `/admin` sin sesión. Esperado: gate de autenticación; no reutilizar esta ruta para la revisión fixture.

## Negativas visibles

| Caso | Ejecución | Resultado esperado |
|---|---|---|
| QR manipulado | cambiar un carácter final de la URL `/verify/<token>` | `No disponible`, existencia no confirmada y coincidencia no confirmada; sin detalle adicional |
| ruta pública enumerable | abrir `/verify/123`, email ficticio o handle corto | misma proyección no disponible, sin indicar si otro receipt existe |
| query manipulada | usar `?role=attacker&scenario=forged` | defaults seguros `doctor/lifecycle`; no error ni dato adicional |
| transición indebida | buscar controles de issue/partial/submit | no existen en la ruta de revisión; `Operaciones: Bloqueadas` |
| rol equivocado | seleccionar Admin técnico | no token QR ni acciones habilitadas |
| recarga/deep link | recargar cualquier combinación allowlisted | conserva sólo rol/escenario sintéticos de la query |

No ingresar nombres, RUT, correos, direcciones, información médica ni credenciales en ninguna superficie.

## Responsive, teclado y movimiento reducido

- Desktop: comprobar jerarquía, dos columnas desde `lg`, botones habilitados/deshabilitados y que el aviso demo permanezca visible.
- Móvil `390 × 844`: comprobar una columna, ausencia de scroll horizontal, texto sin recorte y botones con área táctil utilizable. La inspección 2026-08-24 observó `scrollWidth === clientWidth`.
- Teclado: recorrer con `Tab`; el orden esperado es Volver → roles del flujo → acción disponible → roles read-only → acción QR disponible. Activar con `Enter`/`Espacio`; `aria-pressed` debe seguir la selección.
- Movimiento reducido: activar la preferencia del sistema/navegador y repetir navegación. La baseline no contiene una regla global `prefers-reduced-motion`; verificar que no haya animación que impida operar y mantener el hallazgo P1 abierto.
- Foco: no aceptar como aprobado hasta confirmar visualmente un indicador de foco con contraste suficiente en todos los botones. Los controles son semánticos y tienen `tabIndex=0`, pero esta revisión automatizada no confirmó el estilo visible de foco.

## Evidencia Stellar Expert, sólo lectura

- [Contrato receipt-ledger desplegado](https://stellar.expert/explorer/testnet/contract/CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3)
- [Issued](https://stellar.expert/explorer/testnet/tx/6ae42822f355c848a878c4a75c5d86a8beec93d50913e42da22e55fe02eb241f)
- [Active](https://stellar.expert/explorer/testnet/tx/24c600d34b808fd66c1bd074278e21bd9eaedd83ed90d7feec024f3004de848a)
- [Partial](https://stellar.expert/explorer/testnet/tx/e5ce314dea2a5d1c65a13e26900b692552867225229c2717acafb40fb5b5fe6d)
- [Dispensed](https://stellar.expert/explorer/testnet/tx/8a972d679987c5223e45fac0d784ab30b3eb7395f52570873fda24cca690ac86)
- [Revoked](https://stellar.expert/explorer/testnet/tx/fa758ef79cd0bd9e4aaf11bf3361803dd29d4a0a1479a99a409982d7f4ccfb6e)
- [Expired](https://stellar.expert/explorer/testnet/tx/418789eeb55cc41ae2c3e00d90ce75d7bd03635013a6913cd04914ec1425a06f)

Estas transacciones son la evidencia del smoke sintético documentado, no el origen de los datos renderizados por la UI local actual. Contrastar network `testnet`, contract ID y estado/evento; no abrir ni usar cuentas/secretos.

## Registro mínimo de evidencia humana

Registrar fecha, commit exacto, navegador/viewport y PASS/FAIL por paso. Una captura segura puede mostrar sólo rótulos demo, estado técnico, versiones opacas y URL pública truncada; excluir barra de marcadores, sesiones, extensiones, claves, correos y cualquier dato personal. Los defectos se añaden a `docs/internal/visual-readonly-ux-backlog-20260824.md` con reproducción y prioridad.

## Evidencia de esta baseline

- Browser local: PASS en médico→paciente→QR; tamper visible rechazado; `390 × 844` sin overflow horizontal.
- `npm run test:visual-readonly-review`: PASS.
- `npm run test:visual-qa-regressions`: PASS.
- `npm run preflight`: todas las suites y `tsc --noEmit` pasaron; el paso build encontró `spawn EPERM` por la restricción local del sandbox.
- `npm run build`, repetido fuera de esa restricción sin alterar flags ni red: PASS, 2.426 módulos. Permanece el warning histórico de chunks mayores a 800 kB.
- No hubo request de escritura, login, submission, deploy, push ni dato real.
