# 🚀 Guía de Pruebas E2E y Recorrido del Piloto: Trust Leaf

¡Bienvenido a la guía oficial de pruebas en vivo de **Trust Leaf**! Esta guía detalla la secuencia paso a paso (del Paso 1 al Paso 8) para simular el flujo completo de registro, aprobación on-chain, emisión de receta, retiro de medicamentos y quema definitiva del activo en **Stellar Testnet**.

> [!NOTE]
> Todas las firmas y transacciones on-chain del MVP ocurren en la red de pruebas **Stellar Testnet**, con comisiones (fees) patrocinadas por la plataforma para que los evaluadores no necesiten adquirir saldo real.

---

## 🔗 Enlaces de Acceso Rápido
*   **URL de Producción (Live App):** [https://www.trustleaf.org](https://www.trustleaf.org)
*   **Consola de Diagnóstico:** [https://www.trustleaf.org/mvp](https://www.trustleaf.org/mvp)
*   **Panel de Administración:** [https://www.trustleaf.org/admin](https://www.trustleaf.org/admin)
*   **Portal del Médico:** [https://www.trustleaf.org/medico](https://www.trustleaf.org/medico)
*   **Portal del Paciente:** [https://www.trustleaf.org/paciente](https://www.trustleaf.org/paciente)
*   **Portal del Dispensario:** [https://www.trustleaf.org/dispensario](https://www.trustleaf.org/dispensario)

---

## 📋 Secuencia Paso a Paso del Test E2E

### Paso 1: Registro y Solicitud del Médico 🩺
1. Navega al **Portal del Médico** (`/medico`).
2. Haz clic en **"Iniciar sesión con Google"** o utiliza el botón **"Entrar en Modo Grabación (Demo Local)"** si deseas una prueba rápida.
3. El sistema te pedirá completar el **Formulario de Solicitud Profesional**:
   * Ingresa tu nombre profesional, RUT, especialidad, y tu número de Registro en la **Superintendencia de Salud (SIS)**.
   * Vincula tu wallet pública (el sistema puede autogenerarte una llave criptográfica en hardware con tu Passkey biométrica).
4. Haz clic en **"Enviar solicitud al admin"**. Verás la pantalla de espera confirmando que tu solicitud está en estado *"Revisión administrativa"*.

---

### Paso 2: Registro y Solicitud del Dispensario 💊
1. Navega al **Portal de Farmacia / Dispensario** (`/dispensario`).
2. Inicia sesión (con Google o modo Demo) y completa el **Formulario de Solicitud de Dispensario**:
   * Ingresa la Razón Social, RUT de la empresa, dirección fiscal, y el número de Registro ISP / Autorización Sanitaria.
   * Vincula o genera la wallet operativa del local.
3. Haz clic en **"Enviar solicitud al admin"**. Quedará guardado tu estado pendiente de revisión.

---

### Paso 3: Aprobación y Registro On-Chain por el Administrador 👑
El Administrador es responsable de corroborar que los datos clínicos y regulatorios sean válidos antes de dar el alta on-chain.
1. Navega al **Panel de Administración** (`/admin`).
2. Inicia sesión (usa `cabscryptocontacto@gmail.com` si tienes permisos Firebase reales, o selecciona **"Modo Grabación (Demo Local)"**).
3. En la pestaña de **"Médicos Pendientes"**, verás la solicitud enviada en el Paso 1. Haz clic en **"Aprobar"** para marcar el visto bueno off-chain.
4. `[🔵 INTERACCIÓN STELLAR TESTNET]` Haz clic en **"Registrar on-chain"**. Esto enviará una transacción al contrato inteligente `Doctor Registry` (`registry.wasm`) registrando la llave del médico en el ledger inmutable.
5. Ve a la pestaña **"Dispensarios Pendientes"** y repite el proceso para autorizar la wallet del dispensario en el contrato `Dispensary Registry` (`dispensary_registry.wasm`).

---

### Paso 4: Consulta Clínica y Emisión de Receta (NFT) 🩺
Una vez aprobado el médico, su panel de control se desbloquea.
1. Vuelve al **Portal del Médico** (`/medico/operacion`). Verás que el estado ahora indica *"Médico Autorizado"*.
2. Simula una consulta con un paciente de prueba (o ingresa su dirección de Stellar).
3. `[🟢 PROCESO PRIVADO OFF-CHAIN]` Escribe los datos privados (diagnóstico de dolor crónico, dosificación, preparado magistral CBD/THC). Estos datos se guardan cifrados de forma segura y privada.
4. `[🔵 INTERACCIÓN STELLAR TESTNET]` Haz clic en **"Guardar consulta y Emitir Receta"**. El sistema:
   * Calcula el hash SHA-256 de la consulta.
   * Invoca el contrato de recetas Soroban registrando **30 gramos** autorizados y el hash de integridad.
   * **Acuñación del NFT:** Crea un **Claimable Balance** de 1.0 unidad del token `RX[ID]` (ej. `RX1`) en Stellar, emitido desde la cuenta del médico hacia la del paciente.
5. El portal te mostrará el **ID de Receta On-chain** y el hash de transacción de Stellar. Copia el ID de la receta.

---

### Paso 5: El Paciente y su Código QR de Retiro 👤
1. Navega al **Portal del Paciente** (`/paciente/recetas`).
2. Inicia sesión con la cuenta de Google o Passkey vinculada.
3. El dashboard cargará la información desde la blockchain: verás que posees el NFT de la receta activa y un saldo disponible de **30 gramos**.
4. Haz clic en **"Generar Código QR de Retiro"**. Esto mostrará una referencia temporal y un código QR en pantalla.

---

### Paso 6: Validación y Dispensación Parcial 💊
El paciente acude al local físico del dispensario y presenta su código QR.
1. Navega al **Portal del Dispensario** (`/dispensario/operacion`).
2. Ingresa el **ID de Receta** generado en el Paso 4.
3. El sistema valida contra Stellar Testnet que el paciente posee el NFT y que la receta está vigente.
4. Ingresa un **retiro parcial de 10 gramos** y escribe los datos de control: lote de laboratorio (ej. `LOTE-MAG-2026-03`) y laboratorio fabricante.
5. `[🔵 INTERACCIÓN STELLAR TESTNET]` Haz clic en **"Registrar Dispensación"**.
   * La transacción descuenta 10g en el contrato inteligente `Dispense Record` (`dispense_record.wasm`).
   * El saldo disponible en la red Soroban disminuye de 30g a **20g**.
   * Se verifica en Horizon que el NFT **no ha sido destruido**, ya que la receta aún tiene saldo activo.

---

### Paso 7: Cierre Criptográfico y Bloqueo (Opcional) 🔒
Para evitar que un paciente intente retirar gramos simultáneamente en dos farmacias distintas:
1. Desde el portal del dispensario, haz clic en **"Retener Receta"**.
2. `[🔵 INTERACCIÓN STELLAR TESTNET]` La farmacia bloquea temporalmente el NFT, creando un balance reclamable multifirma condicional por 90 días donde el dispensario es el custodio primario.
3. Si el paciente decide ir a otra farmacia, el dispensario actual debe hacer clic en **"Liberar Receta"**, devolviendo el control incondicional del NFT al paciente.

---

### Paso 8: Retiro Final y Quema del Activo (Clawback) 🏁
1. Vuelve a consultar la receta en el dispensario; verás que el saldo restante es de **20 gramos**.
2. Registra una nueva dispensación por los **20 gramos** restantes.
3. Al procesar la transacción:
   * El contrato de recetas detecta que el saldo llegó a cero (`remaining_quantity = 0`).
   * El sistema ejecuta automáticamente un **Clawback** on-chain, **quemando y eliminando** de forma permanente el NFT `RX` de la red Stellar.
4. Si intentas realizar un nuevo retiro con ese ID de receta, el ledger de Stellar arrojará un error de *"Receta sin saldo o inactiva"*, imposibilitando el doble gasto.
5. El historial de auditoría y los registros de entrega del dispensario permanecen inmutables y accesibles para cumplimiento legal.

---

## ⚡ 3. Características Avanzadas del Piloto Real

### A. Soporte Híbrido de Firma (Web3 + Custodial)
Durante los pasos de Emisión y Dispensación, los Médicos y Dispensarios cuentan con un selector interactivo para decidir la modalidad de firma:
*   **🔑 Custodial (Firma Delegada):** Firma gestionada de forma automática por el backend mediante claves derivadas del correo, ideal para demostraciones rápidas.
*   **⚓ Freighter / Albedo (Firma Local Web3):** Firma local en el navegador del profesional mediante extensiones de hardware/wallet, delegando al backend únicamente la transmisión final (`submit`) del XDR firmado.

### B. Cola de Retiros en Tiempo Real en Firestore (`pickups`)
*   Al solicitar un retiro en el portal del paciente, se genera un registro en estado `pending` dentro de la colección `pickups` de Firestore.
*   El panel del dispensario (`/dispensario/operacion`) realiza una suscripción en tiempo real (`onSnapshot`) filtrando únicamente las solicitudes que corresponden a su sucursal (`dispensaryId` = Firestore ID / Stellar Public Key), evitando fugas de información.
*   Cuando el dispensario procesa la entrega on-chain, el estado en Firestore cambia automáticamente de `pending` a `completed`, vinculando el `txHash` de Stellar para trazabilidad.
