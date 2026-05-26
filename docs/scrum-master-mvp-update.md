# Trust Leaf MVP Update Para SCRUM Master

Actualizado: 26 de mayo de 2026.

## Estado Ejecutivo

Trust Leaf ya tiene una base MVP funcional sobre Stellar Testnet. La app esta
publicada en produccion, los contratos Soroban estan desplegados e inicializados
y el flujo medico-dispensario fue probado con transacciones reales.

URL de produccion:
- https://www.trustleaf.org

Readiness tecnico:
- `/api/stellar/readiness` debe mostrar red `Stellar Testnet`.
- Signers demo de admin, medico y dispensario deben aparecer configurados.
- Passkeys/Mercury/relayer pueden aparecer pendientes; no bloquean la demo.

## Contratos Activos

- DoctorRegistry: `CAQZWTOY5L7SN6IJIO5R23DAOIK7UQDM6YSRRXE3B5XQNXDM2Q4W4ICJ`
- DispensaryRegistry: `CBC7OYPU5VXFPCSY6FV74Q6E6MY5NFJGFLKTXQFX7ASMNH4SSTHAW3L6`
- Prescription: `CCACCU7JGNRL3RQGMNNM5LK27PQEDUOLJQ73QSQR5NTNJGYKOJSQFNIA`
- DispenseRecord: `CAT756N5HQALOEISAEQSASHBK2N4XLUCDJNDEIW4DK6SJP4YNOAJRUPE`

## Demo Principal

1. Admin entra a `/admin`, usa modo real si Firebase Auth + allowlist estan
   configurados o modo demo si es grabacion controlada.
2. Admin aprueba medico y dispensario.
3. Admin registra wallets en DoctorRegistry y DispensaryRegistry Testnet.
4. Medico entra a `/medico/operacion`, selecciona paciente demo, cupo y
   vigencia, y emite receta.
5. Paciente entra a `/paciente/recetas`, ve receta, saldo y QR conceptual.
6. Dispensario entra a `/dispensario/operacion`, valida receta, selecciona
   producto/lote e ingresa retiro parcial.
7. Paciente ve historial y trazabilidad sin exponer ficha clinica completa.

## Sprint Actual

Foco: demo MVP rapido, sprint semanal.

Entregables cerrados o avanzados:
- contratos Soroban con eventos tipados;
- deployment Testnet actualizado;
- produccion Vercel apuntando a contratos nuevos;
- endpoints publicos de admin, medico, paciente y dispensario activos;
- inventario local de dispensario;
- agenda y consulta medica ligera;
- checklist operativo visible en portal paciente;
- admin real preparado con Firebase Auth + `appAdministrators/{uid}` y fallback
  demo explicito.

Pendientes priorizados:
- crear usuario admin real en Firebase y documento allowlist;
- verificar reglas Firestore en entorno real;
- configurar passkeys/Mercury/relayer para salir de modo demo;
- reemplazar firma server-side por firma wallet/passkey en version piloto;
- agregar QA manual grabado de los cuatro roles.

## Definicion De Hecho Para La Demo

- `npm run lint` pasa.
- `npm run build` pasa.
- `cargo test` pasa en `soroban`.
- Produccion responde `200`.
- `/api/stellar/readiness` muestra contratos actuales.
- Médico demo emite receta real.
- Dispensario demo registra retiro parcial real.
- Error de retiro excedido muestra mensaje claro.
- Ningun diagnostico, nota clinica, documento o imagen completa va on-chain.
