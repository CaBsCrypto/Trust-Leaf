# Soroban MVP Architecture

Esta guia aterriza la arquitectura funcional de Trust Leaf sobre Stellar/Soroban para el MVP de mayo de 2026.

## Objetivo del MVP

Construir una red medica donde:

1. Trust Leaf autoriza medicos y dispensarios.
2. Un medico autorizado emite una receta digital al paciente.
3. La receta queda anclada on-chain y no puede ser transferida ni duplicada.
4. Un dispensario autorizado verifica y consume la receta.
5. El sistema registra la dispensacion real de la medicina.

## Deploy actual en Stellar Testnet

Actualizado: 26 de mayo de 2026. Produccion Vercel apunta a estos contratos
desde `https://www.trustleaf.org`.

Cuenta deploy/admin:
- `trustleaf-admin`: `GB2PFKB24QPIEB3VIKYTIEG7M4KRH5I4KBPV26LUC6KOE2YAWSCPXKZ6`

Contratos desplegados e inicializados:
- `DoctorRegistry`: `CAQZWTOY5L7SN6IJIO5R23DAOIK7UQDM6YSRRXE3B5XQNXDM2Q4W4ICJ`
- `DispensaryRegistry`: `CBC7OYPU5VXFPCSY6FV74Q6E6MY5NFJGFLKTXQFX7ASMNH4SSTHAW3L6`
- `Prescription`: `CCACCU7JGNRL3RQGMNNM5LK27PQEDUOLJQ73QSQR5NTNJGYKOJSQFNIA`
- `DispenseRecord`: `CAT756N5HQALOEISAEQSASHBK2N4XLUCDJNDEIW4DK6SJP4YNOAJRUPE`

Actores demo autorizados:
- `trustleaf-doctor`: `GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX`
- `trustleaf-dispensary`: `GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6`

Flujo real probado en Testnet:
- receta `0` emitida por `trustleaf-doctor`;
- retiro parcial `0` registrado por `trustleaf-dispensary`;
- estado final probado: `30g` autorizados, `5g` dispensados y `25g`
  restantes.

## Contratos objetivo

### 1. `DoctorRegistry`

Contrato de gobernanza para medicos autorizados.

Responsabilidad:
- definir que addresses pueden emitir recetas

Funciones esperadas:
- `init(admin: Address)`
- `add_doctor(admin: Address, doctor: Address)`
- `remove_doctor(admin: Address, doctor: Address)`
- `is_authorized(doctor: Address) -> bool`
- `get_admin() -> Address`

Estado:
- ya existe una primera version en `soroban/contracts/registry`
- deberia renombrarse conceptualmente a `DoctorRegistry`

### 2. `DispensaryRegistry`

Contrato de gobernanza para dispensarios autorizados.

Responsabilidad:
- definir que addresses pueden dispensar y consumir recetas

Funciones esperadas:
- `init(admin: Address)`
- `add_dispensary(admin: Address, dispensary: Address)`
- `remove_dispensary(admin: Address, dispensary: Address)`
- `is_authorized(dispensary: Address) -> bool`
- `get_admin() -> Address`

Estado:
- implementado en `soroban/contracts/dispensary-registry`

### 3. `PrescriptionSoulbound`

Contrato principal de recetas medicas.

Responsabilidad:
- emitir una receta unica por paciente
- impedir transferencias
- validar expiracion
- registrar saldo terapeutico autorizado
- permitir entregas parciales sin quemar toda la receta
- marcar la receta como expirada o sin saldo cuando corresponda

Modelo recomendado:
- NFT soulbound custom, no un NFT transferible generico
- la prueba real vive on-chain
- el documento clinico completo vive off-chain

Estructura minima:

```rust
struct Prescription {
    id: u64,
    patient: Address,
    doctor: Address,
    medication_hash: BytesN<32>,
    issued_at: u64,
    expires_at: u64,
    total_quantity: u64,
    dispensed_quantity: u64,
    is_active: bool,
}
```

Funciones esperadas:
- `init(admin: Address, doctor_registry: Address, dispensary_registry: Address)`
- `issue_prescription(doctor: Address, patient: Address, medication_hash: BytesN<32>, duration: u64, total_quantity: u64) -> u64`
- `record_partial_dispense(dispensary: Address, prescription_id: u64, quantity: u64)`
- `get_prescription(id: u64) -> Prescription`
- `is_valid(id: u64) -> bool`
- `get_remaining_quantity(id: u64) -> u64`

Restricciones:
- solo medico autorizado puede emitir
- solo dispensario autorizado puede consumir
- la receta no se puede transferir
- una receta vencida o sin saldo ya no sirve
- un retiro no puede superar el saldo disponible

Eventos:
- `PrescriptionIssued(id, patient, doctor)`
- `PrescriptionPartiallyDispensed(id, dispensary, quantity, remaining_quantity)`
- `PrescriptionExpired(id)`

Estado:
- existe una version funcional avanzada en `soroban/contracts/prescription`
- ya valida medico autorizado y dispensario autorizado
- ya registra `issued_at`, `expires_at`, `total_quantity`,
  `dispensed_quantity`, `is_used` e `is_valid`
- `is_used` ahora significa saldo agotado, no primer retiro realizado
- ya expone `record_partial_dispense` y `get_remaining_quantity`
- siguiente evolucion: semantica soulbound mas estricta, ventana por periodo
  semanal/mensual y eventos tipados con `#[contractevent]`
- el frontend debe emitir alertas 15 y 10 dias antes de `expires_at`

### 4. `DispenseRecord`

Contrato de trazabilidad de dispensacion.

Responsabilidad:
- dejar evidencia on-chain de la entrega real de medicina

Por que existe:
- `PrescriptionSoulbound` prueba autorizacion
- `DispenseRecord` prueba cumplimiento real
- permite que distintos dispensarios autorizados consulten consumo acumulado de
  la misma receta sin ver ficha clinica completa

Estructura sugerida:

```rust
struct DispenseRecord {
    id: u64,
    prescription_id: u64,
    patient: Address,
    doctor: Address,
    dispensary: Address,
    product_hash: BytesN<32>,
    batch_hash: BytesN<32>,
    quantity: u64,
    remaining_quantity: u64,
    dispensed_at: u64,
}
```

Funciones esperadas:
- `init(admin: Address, prescription_contract: Address, dispensary_registry: Address)`
- `record_dispense(dispensary: Address, prescription_id: u64, product_hash: BytesN<32>, batch_hash: BytesN<32>, quantity: u64) -> u64`
- `get_record(id: u64) -> DispenseRecord`
- `get_last_record_for_prescription(prescription_id: u64) -> Option<DispenseRecord>`

Reglas:
- solo dispensario autorizado puede registrar
- solo se puede registrar si la receta es valida o en el mismo flujo de consumo
- el registro debe copiar `patient` y `doctor` desde la receta para auditoria
- el registro debe guardar cantidad retirada y saldo restante
- el dispensario puede consultar retiros previos por receta, no historial
  clinico general del paciente

Eventos:
- `DispenseRecorded(record_id, prescription_id, patient, dispensary)`

Estado:
- implementado en `soroban/contracts/dispense-record`
- ya copia `patient` y `doctor` desde `Prescription`
- ya valida `dispensary` autorizado y `prescription` valida antes de registrar
- ya llama a `Prescription.record_partial_dispense` para descontar saldo on-chain
  antes de crear el comprobante de entrega

### 5. `Patient Smart Account`

No es un contrato medico de negocio, sino la wallet programable del paciente.

Responsabilidad:
- autenticar al paciente con passkey
- permitir Freighter como signer secundario
- funcionar como cuenta que posee la receta soulbound

Modelo:
- `passkey` como signer principal
- `Freighter` como signer secundario / recovery operativo

Estado:
- frontend actual usa una capa transicional
- la direccion futura debe alinearse a OpenZeppelin Smart Accounts

## Que va on-chain y que va off-chain

Principio: Soroban no es el repositorio privado de la ficha clinica. La capa
on-chain prueba que algo existe, que fue autorizado, que esta vigente y que no
fue alterado; la informacion medica completa queda cifrada fuera de la cadena.

### On-chain

- autorizacion de medicos
- autorizacion de dispensarios
- emision de receta
- expiracion y consumo
- trazabilidad de dispensacion
- hashes de documentos, productos y lotes
- saldo terapeutico: cantidad autorizada, retirada y restante
- permisos o estados de consentimiento cuando aporten valor verificable

### Off-chain

- perfil clinico del paciente
- historia medica completa
- detalle textual de la receta
- sintomas, diagnosticos, notas y resumen clinico
- examenes, imagenes y documentos legales
- catalogo de medicinas
- fotos
- stock por dispensario
- precios
- metadata administrativa

### Cifrado y revelacion controlada

- La DB/storage guarda documentos cifrados; las llaves no deben vivir mezcladas
  con el mismo registro clinico.
- El paciente concede acceso temporal al medico o a otro actor especifico.
- El dispensario valida receta, vigencia, categorias permitidas y saldo; no ve
  ficha clinica completa.
- Si una autoridad legal requiere ver un documento, el sistema revela el archivo
  especifico mediante flujo controlado y usa el hash on-chain como prueba de
  integridad.

## Flujo funcional completo

1. Trust Leaf despliega `DoctorRegistry`.
2. Trust Leaf despliega `DispensaryRegistry`.
3. Trust Leaf despliega `PrescriptionSoulbound`.
4. Trust Leaf despliega `DispenseRecord`.
5. El admin registra medicos.
6. El admin registra dispensarios.
7. El paciente crea o conecta su smart account.
8. El paciente agenda una consulta con un medico autorizado.
9. El paciente comparte ficha clinica/examenes por consentimiento temporal.
10. El medico inicia consulta y guarda resumen off-chain.
11. El medico emite una receta soulbound al paciente.
12. El paciente visualiza la receta y QR en su dashboard.
13. El dispensario valida QR, vigencia y saldo.
14. El dispensario registra entrega parcial en `DispenseRecord`.
15. El paciente conserva saldo para futuros retiros.

## Orden de implementacion recomendado

### Fase 1. Contratos

1. crear `DispensaryRegistry`
2. evolucionar `Prescription` a `PrescriptionSoulbound`
3. crear `DispenseRecord`
4. actualizar tests
5. desplegar todo en `testnet`

### Fase 2. Backend y lectura

1. leer `DoctorRegistry`
2. leer `DispensaryRegistry`
3. leer recetas por paciente
4. leer registros de dispensacion
5. preparar utilidades server-side para emitir y consumir

### Fase 3. POV Medico

Objetivo:
- registrar o buscar paciente
- administrar agenda y disponibilidad
- ver consultas futuras/pasadas
- iniciar y cerrar consulta
- revisar documentos compartidos por consentimiento
- completar evaluacion
- crear la receta
- emitirla al wallet del paciente

Estado:
- existe un flujo inicial en la vista `Medicos`
- usa `POST /api/stellar/doctor/issue-prescription`
- firma con `STELLAR_DOCTOR_SECRET` en testnet como atajo de MVP
- genera `medication_hash` con SHA-256 del payload clinico
- actualiza el dashboard del paciente leyendo eventos del contrato `Prescription`
- siguiente evolucion: receta soulbound con `total_quantity`, `dispensed_quantity`
  y `expires_at`

Nota de seguridad:
- `STELLAR_DOCTOR_SECRET` solo debe usarse en testnet
- en produccion, el medico debe firmar desde su wallet/passkey, no desde una key custodial del servidor

### Fase 4. POV Dispensario

Objetivo:
- registrar dispensario
- mantener catalogo e inventario off-chain
- validar receta del paciente
- consumir receta
- registrar dispensacion

### Fase 5. POV Paciente

Objetivo:
- visualizar recetas emitidas
- ver estado de vigencia
- ver historial de dispensacion
- conectar passkey + Freighter

## Variables de entorno necesarias

### Core Stellar

- `STELLAR_RPC_URL`
- `STELLAR_NETWORK_PASSPHRASE`

### Contract IDs

- `STELLAR_REGISTRY_CONTRACT_ID`
- `STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID`
- `STELLAR_PRESCRIPTION_CONTRACT_ID`
- `STELLAR_DISPENSE_RECORD_CONTRACT_ID`

### Wallet / Passkeys

- `STELLAR_RELAYER_URL`
- `STELLAR_RELAYER_API_KEY`
- `VITE_STELLAR_WALLET_WASM_HASH`

### POV Medico Testnet

- `STELLAR_DOCTOR_ADDRESS`
- `STELLAR_DOCTOR_SECRET`

### POV Dispensario Testnet

- `STELLAR_DISPENSARY_ADDRESS`
- `STELLAR_DISPENSARY_SECRET`

## Comandos base

```bash
cd soroban
stellar contract build
cargo test
```

## Decision de producto para esta etapa

No tokenizar la medicina misma como activo transferible en el MVP.

En esta fase:
- la receta es el objeto critico on-chain
- la dispensacion se registra como hecho auditable
- el inventario sigue siendo gestion operacional del dispensario

## Siguiente desarrollo recomendado historico

1. implementar `DispensaryRegistry`
2. rediseñar `Prescription` como soulbound medico
3. implementar `DispenseRecord`
4. despues construir el POV medico
5. luego el POV dispensario

## Siguiente desarrollo recomendado

1. configurar `STELLAR_DOCTOR_SECRET` en Vercel para habilitar emision real desde el MVP
2. configurar `STELLAR_DISPENSARY_SECRET` en Vercel para habilitar dispensacion real desde el MVP
3. probar emision real contra el paciente conectado
4. probar consumo y registro de dispensacion desde POV dispensario
5. reemplazar la firma server-side del medico por firma wallet/passkey
