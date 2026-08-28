# Runbook gated — receipt Stellar Testnet

Estado: preparación no ejecutada. Este documento no autoriza deploy, fondeo, RPC, datos reales, mainnet ni uso clínico.

## Evidencia local requerida

Desde `soroban/`:

```powershell
cargo fmt --check -p receipt-ledger
cargo test --locked -p receipt-ledger
cargo test --locked --workspace
cargo build --locked --target wasm32v1-none --release -p receipt-ledger
Get-FileHash -Algorithm SHA256 .\target\wasm32v1-none\release\receipt_ledger.wasm
```

Desde la raíz web:

```powershell
npm run preflight
```

El preflight incluye `test:simulated-testnet-adapter` y `test:receipt-indexer`. Estos arneses prueban lógica local; no sustituyen smoke RPC ni autorización de deploy.

El informe debe registrar commit, estado limpio, versiones Rust/Cargo/Stellar CLI y Node/npm, 20 pruebas del receipt, total del workspace, hash y tamaño WASM, suite web y revisión independiente. El WASM no se versiona ni se publica desde este sprint. No ejecutar `npm ci` sobre una instalación compartida sin revisar antes el lockfile y autorizar su impacto.

## Gate humano antes de configurar Testnet

- [ ] IDL/eventos revisados; `operation_id`, actor técnico, dominio, versión y commitment no contienen ni derivan de PII/PHI.
- [ ] Aceptación explícita de que actor, tiempo y secuencia son públicamente correlacionables.
- [ ] Cuentas técnicas Testnet seudónimas, no asociadas a identidad personal, con propietario, custodia, rotación y revocación documentados.
- [ ] Ninguna clave en repositorio, navegador, QR, logs o fixtures; mecanismo de secretos aprobado.
- [ ] Contract ID y RPC allowlisted exclusivamente para Testnet; passphrase verificada.
- [ ] `STELLAR_RECEIPT_CONTRACT_ID` continúa vacío antes del deploy y, después, coincide con el contrato efímero y hash aprobados; nunca reutilizar IDs legacy.
- [ ] Mutaciones continúan deshabilitadas hasta la ventana aprobada.
- [ ] Backend tiene autenticación real o arnés sintético aislado; jamás rol autoafirmado.
- [ ] Rate limit, `no-store`, referrer policy y redacción de URL/logs definidos para verificador público.
- [ ] Pausa/rollback lógico, TTL/storage, recuperación de RPC y teardown definidos.
- [x] El simulador local cubre cursor, finality, fork/reorg lógico, gaps, deduplicación, reconciliación de `unknown`, retry acotado y errores redactados (`npm run test:receipt-indexer`).
- [ ] Owner, persistencia durable, fuente RPC allowlisted, criterio final de Testnet y procedimiento operativo han sido aprobados y probados contra una red autorizada.
- [ ] Revisión jurídica, clínica y farmacéutica reconoce que la prueba es sintética y no una receta válida.

## Secuencia de smoke propuesta tras autorización específica

1. Confirmar red Testnet y hash WASM aprobado.
2. Crear o seleccionar cuentas técnicas Testnet sin identidad y sin flujos de pago de usuario.
3. Desplegar una instancia efímera del receipt y registrar contract ID en configuración aislada.
4. Inicializar admin, médico técnico y dispensario técnico.
5. Ejecutar con valores aleatorios opacos: `Issued → Active → Partial → Dispensed`.
6. En receipts separados validar `Revoked` y `Expired`.
7. Repetir operación exacta; intentar sustitución de actor, dominio y payload; intentar versión obsoleta y transición terminal.
8. Confirmar el mismo estado mínimo mediante QR y detalle únicamente con scope autorizado.
9. Inspeccionar eventos/explorer y logs con scan negativo de campos prohibidos.
10. Pausar mutaciones, archivar evidencia sin secretos y ejecutar teardown definido.

## Criterios de parada

Detener sin reintentar automáticamente si cambia la red, falta una cuenta/rol, diverge la versión, el resultado queda `unknown`, aparece un campo prohibido, falla autorización o no coincide el hash WASM. No ocultar un fallo RPC mediante éxito del adaptador in-memory.

## Fuera de alcance

La capa visual NFT no es un token transferible ni una fuente clínica. Stellar no almacena ficha, identidad, consentimiento, medicamento, dosis, gramaje, saldo o historial. Sin una primitiva adicional, el contrato no demuestra la aritmética de cantidades ocultas ni validez legal/clínica.
