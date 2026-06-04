# 🚀 Guía de Pruebas E2E y Recorrido del Piloto: Trust Leaf

¡Bienvenido a la primera fase de pruebas en vivo de **Trust Leaf**! Esta guía servirá como hoja de ruta paso a paso para que cualquier evaluador o tester pueda experimentar el ciclo de vida completo de una receta médica y la trazabilidad del cannabis medicinal en nuestra plataforma descentralizada.

Todas las pruebas se ejecutan con transacciones reales en **Stellar Testnet**, sin requerir que los usuarios paguen por transacciones (fees patrocinados por la dApp).

---

## 🔗 Enlaces Rápidos y Accesos
*   **URL de Producción (Live App):** [https://www.trustleaf.org](https://www.trustleaf.org)
*   **Ruta de Diagnóstico Técnico:** [https://www.trustleaf.org/mvp](https://www.trustleaf.org/mvp)
*   **Panel de Administración:** [https://www.trustleaf.org/admin](https://www.trustleaf.org/admin)
*   **Portal del Médico:** [https://www.trustleaf.org/medico/operacion](https://www.trustleaf.org/medico/operacion)
*   **Portal del Paciente:** [https://www.trustleaf.org/paciente/recetas](https://www.trustleaf.org/paciente/recetas)
*   **Portal de Farmacia / Dispensario:** [https://www.trustleaf.org/dispensario/operacion](https://www.trustleaf.org/dispensario/operacion)

---

## 🌐 Resumen de Interacciones con Stellar Testnet (Web3)

Para esta demo, las siguientes acciones ocurren en tiempo real sobre la red pública **Stellar** y sus contratos inteligentes **Soroban**:

1.  **Aprovisionamiento de Cuentas:** Fondeo automático con **Friendbot** (el faucet de prueba de Stellar) para crear las wallets del piloto.
2.  **Doctor Registry (`registry.wasm`):** Registro inmutable del RUT y la clave pública del médico autorizado.
3.  **Dispensary Registry (`dispensary_registry.wasm`):** Registro de la dirección pública de la farmacia validada.
4.  **Prescription Contract (`prescription.wasm`):** Creación de la receta on-chain asociando ID, médico, paciente, hash de tratamiento y saldo de gramos.
5.  **Acuñación del NFT de Receta:** Creación de un **Claimable Balance** de 1.0 token de la serie `RX[ID]` desde la cuenta del médico hacia la del paciente.
6.  **Bloqueo y Retención Criptográfica:** Restricción de doble gasto de la receta creando un bloqueo temporal multifirma por 90 días en la cuenta del dispensario.
7.  **Dispense Record (`dispense_record.wasm`):** Deducción y registro de gramos on-chain ante retiros parciales.
8.  **Clawback y Quema del NFT:** Destrucción definitiva del token `RX` en la red Stellar una vez consumido todo el gramaje de la receta.

---

## 🎛️ Paso 0: Verificación y Readiness Técnico
Antes de comenzar, es recomendable verificar que la infraestructura descentralizada está activa.

1.  Navega a [https://www.trustleaf.org/mvp](https://www.trustleaf.org/mvp).
2.  Verifica los checks en verde en la sección de **Conectividad**:
    *   **Stellar Testnet:** Conectado.
    *   **Smart Contracts:** Cargados y listos.
3.  `[🔵 INTERACCIÓN STELLAR TESTNET]` En esta pantalla, puedes usar el **Friendbot Faucet** integrado para fondea y activar la wallet de cualquiera de los actores de la demo en el ledger.

---

## 👑 Ruta 1: El Administrador del Portal (`/admin`)
El Administrador es responsable de validar que solo los médicos certificados por la **Superintendencia de Salud (SIS)** y las farmacias autorizadas por el **ISP** puedan operar en la red.

### 📋 Pasos para el Tester:
1.  Ingresa a [https://www.trustleaf.org/admin](https://www.trustleaf.org/admin).
2.  Inicia sesión (puedes usar el botón de **"Entrar en Modo Grabación (Demo Local)"** para un acceso rápido y seguro).
3.  `[🟢 PROCESO PRIVADO OFF-CHAIN]` En la pestaña **"Médicos Pendientes"**, verás las solicitudes de alta. Revisa el RUT profesional y el número de Registro SIS del médico demo. Haz clic en **"Aprobar"** para guardar el estado en tu navegador.
4.  `[🔵 INTERACCIÓN STELLAR TESTNET]` Haz clic en **"Registrar on-chain"**. Verás una barra de progreso mientras se emite la transacción a Stellar Testnet. Al finalizar, se mostrará el hash de transacción de Stellar. El médico ya está registrado en el contrato inteligente `Doctor Registry` (`registry.wasm`).
5.  Repite el mismo flujo en la pestaña de **"Dispensarios Pendientes"** para autorizar la wallet del dispensario en el smart contract `Dispensary Registry` (`dispensary_registry.wasm`).

---

## 🩺 Ruta 2: El Médico Tratante (`/medico/operacion`)
El médico es quien evalúa al paciente e inscribe la justificación médica de autocultivo y dosificación de fitocannabinoides.

### 📋 Pasos para el Tester:
1.  Ingresa a [https://www.trustleaf.org/medico/operacion](https://www.trustleaf.org/medico/operacion).
2.  Selecciona un paciente de tu agenda o inicia una consulta rápida.
3.  `[🟢 PROCESO PRIVADO OFF-CHAIN]` Completa la ficha médica de forma privada: diagnóstico (ej. dolor crónico), preparado magistral (Aceite CBD 10% / THC 5%) y dirección de cultivo. Esta información queda a resguardo off-chain.
4.  `[🔵 INTERACCIÓN STELLAR TESTNET]` Haz clic en **"Guardar consulta y Emitir Receta"**. El sistema generará el hash SHA-256 de la consulta y llamará al contrato inteligente `Prescription` on-chain:
    *   Registra la vigencia de **90 días**, el saldo inicial de **30 gramos** y el hash clínico.
    *   **Acuñación del NFT:** Crea un **Claimable Balance** de 1.0 unidad del token `RX[ID]` (ej. `RX1`) emitido por la wallet del médico hacia la del paciente.
5.  **Resultado esperado:** La pantalla mostrará el **ID de Receta On-chain** y el enlace para auditar la transacción de acuñación en Stellar.

---

## 👤 Ruta 3: El Paciente Digital (`/paciente/recetas`)
El paciente posee el control de su pasaporte de salud y el código QR de retiro.

### 📋 Pasos para el Tester:
1.  Ingresa a [https://www.trustleaf.org/paciente/recetas](https://www.trustleaf.org/paciente/recetas).
2.  `[🔵 INTERACCIÓN STELLAR TESTNET]` Inicia sesión con tus credenciales. (Puedes vincular tu **Passkey biométrica** para crear una wallet en hardware). El portal consultará a Stellar Testnet el balance del NFT de receta y los gramos disponibles en el smart contract.
3.  Verifica tu panel de control: el saldo de **30 gramos** restantes y la geolocalización de tu autocultivo autorizada.
4.  Haz clic en **"Generar Código QR de Retiro"**. Esto generará una referencia temporal en pantalla.

---

## 💊 Ruta 4: Farmacia / Dispensario (`/dispensario/operacion`)
La farmacia valida las recetas contra el Ledger público y despacha de forma segura los gramos autorizados.

### 📋 Pasos para el Tester:
1.  Ingresa a [https://www.trustleaf.org/dispensario/operacion](https://www.trustleaf.org/dispensario/operacion).
2.  `[🔵 INTERACCIÓN STELLAR TESTNET]` Ingresa el **ID de la Receta** del paciente (o simula el escaneo del QR). El sistema consulta en Stellar Testnet el saldo disponible en tiempo real.
3.  `[🔵 INTERACCIÓN STELLAR TESTNET]` **Cerradura Criptográfica (Lock-up):** El dispensario gatilla el bloqueo de la receta. Se crea un bloqueo temporal multifirma por 90 días en la blockchain para que el paciente no pueda retirar en otra farmacia.
4.  Ingresa un **retiro parcial de 10 gramos** y el lote de laboratorio (ej: LOTE-MAG-2026-03).
5.  `[🔵 INTERACCIÓN STELLAR TESTNET]` Haz clic en **"Registrar Dispensación"**. La transacción llama al smart contract `Dispense Record` (`dispense_record.wasm`) y actualiza el saldo de gramos on-chain de 30g a **20g**.
6.  `[🟢 PROCESO PRIVADO OFF-CHAIN]` El sistema genera la primera fila en el **Libro de Control de Estupefacientes** del local.

---

## 🏁 Ruta 5: Retiro Final y Quema del Activo (Clawback)
Para concluir las pruebas, simularemos el término del tratamiento.

### 📋 Pasos para el Tester:
1.  Vuelve a consultar la misma receta en el portal del dispensario. Verás que el saldo actualizado es de **20 gramos**.
2.  Registra un retiro por los **20 gramos** restantes.
3.  `[🔵 INTERACCIÓN STELLAR TESTNET]` Al confirmar la dispensación:
    *   El balance de gramos en el smart contract llega a cero (`remaining_quantity = 0`).
    *   El contrato de recetas ejecuta automáticamente un **Clawback** (llamado clásico de la red Stellar) y **quema** permanentemente el NFT `RX` en la blockchain.
4.  Intenta hacer una consulta adicional para esa receta. El sistema arrojará un error de **"Receta Inactiva o sin saldo"** en Stellar Testnet, impidiendo cualquier reuso.
