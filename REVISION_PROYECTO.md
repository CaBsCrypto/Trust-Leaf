# 📋 Guía de Revisión y Estado del Proyecto: Trust Leaf

Este documento ha sido preparado para facilitar la auditoría y revisión detallada del proyecto **Trust Leaf** por parte de evaluadores, ingenieros o Scrum Masters. Aquí se detalla el estado actual del desarrollo, las funcionalidades listas para probar, los contratos inteligentes activos y los pasos exactos para realizar pruebas tanto automatizadas como manuales.

---

## 🏗️ 1. Arquitectura y Estado de Integración

Trust Leaf es una dApp de infraestructura regulada y privada para recetas médicas y cannabis medicinal que implementa un modelo **híbrido de privacidad (Zero-Knowledge Compliance)**:
*   **Privacidad Médica (Ley 19.628):** Los datos clínicos sensibles (diagnósticos, dosificaciones detalladas, fichas e imágenes) **nunca se escriben en la blockchain**. Se resguardan cifrados en base de datos privada (Firebase Firestore).
*   **Trazabilidad Inmutable (Stellar Soroban):** La red pública Stellar registra únicamente los estados lógicos de las recetas, hashes criptográficos de integridad (SHA-256 de la receta), saldos autorizados en gramos, y eventos de retiro parcial o quema.
*   **Autenticación y Firma (WebAuthn Passkeys):** Registro y login biométrico (FaceID/TouchID/Windows Hello) que crea llaves descentralizadas resguardadas en hardware sin frases semilla complejas.

### Stack Tecnológico Desplegado:
*   **Frontend:** React 18 + Vite + Tailwind CSS + Lucide Icons + Motion.
*   **Backend:** Express.js (configurado como middleware de desarrollo de Vite y servidor API independiente para endpoints de transacciones y autenticación passkey).
*   **Base de Datos / Auth:** Firebase (Auth, Firestore y Reglas de seguridad).
*   **Blockchain:** Stellar Soroban (4 Contratos Inteligentes escritos en Rust) desplegados en **Testnet**.

---

## 🚀 2. Listado de Funcionalidades Listas para Probar

El sistema se encuentra en un estado funcional avanzado para **demostración de extremo a extremo (E2E)** sobre Stellar Testnet:

### A. Capa de Contratos Inteligentes (Stellar Soroban) - 100% Funcional
1.  **Doctor Registry (`registry.wasm`):** Registro de médicos autorizados por gobernanza.
2.  **Dispensary Registry (`dispensary_registry.wasm`):** Registro de dispensarios aprobados por el ISP.
3.  **Prescription Contract (`prescription.wasm`):** Motor principal de recetas:
    *   Emisión de receta on-chain vinculando ID de médico, ID de paciente, hash criptográfico de tratamiento y expiración.
    *   Soporte de **Retención Criptográfica (Lock-up)** por 90 días con predicados multifirma para impedir que el paciente retire en múltiples dispensarios simultáneamente.
    *   **Liberación de Receta (Release):** Retorno de la receta bajo control incondicional del paciente si este decide cambiar de dispensario.
4.  **Dispense Record (`dispense_record.wasm`):**
    *   Deducción de saldos de gramos on-chain en tiempo real.
    *   Quema automática del activo (Clawback) cuando el saldo disponible llega a cero o expira el plazo.

### B. Capa de API Backend (`server.ts`) - 100% Funcional
*   `/api/stellar/health`: Consulta de conectividad al nodo Horizon de Stellar Testnet.
*   `/api/stellar/contracts`: Obtención de los IDs de los contratos activos.
*   `/api/stellar/readiness`: Diagnóstico de capacidades y llaves configuradas.
*   `/api/stellar/faucet`: Proveedor automático de fondos Friendbot para cuentas del piloto.
*   `/api/stellar/patient/:address/dashboard`: Lectura directa de eventos del Ledger Soroban para construir el historial clínico e histórico de dispensación del paciente.
*   `/api/stellar/doctor/issue-prescription`: Endpoint para que el médico firme la receta (emisor autorizado).
*   `/api/stellar/dispensary/dispense-prescription`: Procesamiento y firma de retiros parciales/totales.
*   `/api/stellar/verify-passport/:accountId`: Validación externa de pasaporte médico y balances reclamables de NFT (RX*) en el ledger tradicional de Stellar.
*   `/api/passkeys/*`: Endpoints para resolver contraseñas biométricas, relayers de transacciones y Mercury.

### C. Capa Frontend (`src/components/MockupPortal.tsx`) - Integrada
*   **Ruta de Diagnóstico `/mvp`:** Vista operacional técnica de validación de contratos, conectividad de red y faucet.
*   **Portal Administrador (`/admin`):** Gestión de solicitudes de médicos y farmacias, aprobaciones persistentes en Firebase y sincronización on-chain en los contratos de registro.
*   **Portal del Médico (`/medico/operacion`):** Agenda del día, inicio de consulta clínica, guardado de resumen y firma descentralizada de recetas (minting del NFT).
*   **Portal del Paciente (`/paciente/recetas`):** Acceso con Passkeys, panel de control de privacidad, consulta de saldo en gramos, generación de QR dinámico y visualización del historial.
*   **Portal del Dispensario (`/dispensario/operacion`):** Validador de QR, visualización del saldo restante e ingreso de retiros parciales y finales de medicamentos con su respectivo Lote y Laboratorio.

---

## 🧪 3. Guía de Ejecución de Pruebas

Para demostrar y revisar que el sistema funciona correctamente con transacciones reales en Stellar Testnet, existen dos vías principales:

### VÍA A: Prueba de Integración Automatizada (Recomendado para Ingenieros)
El proyecto contiene un script que ejecuta el flujo completo de vida de una receta directamente contra Stellar Testnet, validando firmas, saldos parciales, bloqueos del dispensario y quema de NFTs:

1.  Asegúrate de tener instaladas las dependencias y la CLI de Stellar (si deseas desplegar contratos).
2.  Ejecuta el script de inicialización de entorno de prueba (despliega nuevos contratos efímeros, inicializa su gobernanza, asocia claves y genera un archivo `.env` limpio):
    ```bash
    npx tsx setup-dev.ts
    ```
3.  Ejecuta el flujo de pruebas E2E:
    ```bash
    npx tsx test-flow.ts
    ```

#### ¿Qué verifica este script en tiempo real?
*   **Paso 1 y 2:** Genera llaves efímeras (Admin, Médico, Dispensario, Paciente) y las fondea en Friendbot.
*   **Paso 3 y 4:** Despliega los 4 contratos inteligentes y los inicializa vinculando sus dependencias lógicas.
*   **Paso 5:** Registra y autoriza on-chain al Médico y al Dispensario a través de transacciones firmadas por el Administrador.
*   **Paso 6:** El Médico emite una receta por un saldo total de **30 gramos** (crea el NFT RX* y el balance reclamable correspondiente).
*   **Paso 7:** Verifica en Horizon (Stellar Explorer) la existencia física del NFT asociado al Paciente.
*   **Paso 7.5:** Simula la **retención de la receta** por parte del dispensario por un bloqueo de 90 días (creando un balance reclamable multifirma condicional).
*   **Paso 7.6:** Simula la **liberación de la receta** devolviendo el control total e incondicional al paciente.
*   **Paso 8:** El paciente realiza un **retiro parcial de 10g**. Se verifica que el saldo on-chain en Soroban baje a 20g y que el NFT **no haya sido destruido**.
*   **Paso 9:** El paciente realiza el **retiro final de los 20g restantes**. El contrato detecta saldo 0, ejecuta un **Clawback** y **quema permanentemente el NFT** de Horizon.
*   **Paso 10:** Se valida que, a pesar de que el NFT ya no existe en la billetera del paciente, el historial de auditoría y retiros del dispensario sigue siendo accesible de forma segura.

---

### VÍA B: Prueba de la Interfaz Web (Paso a Paso en Navegador)
Para probar la aplicación interactiva de manera local:

1.  Inicia el servidor de desarrollo:
    ```bash
    npm run dev
    ```
2.  Abre en tu navegador la dirección local (usualmente `http://localhost:3000`).
3.  Navega a la ruta de diagnóstico técnico para verificar la conectividad de la red Stellar y los contratos:
    *   **Ruta:** `http://localhost:3000/mvp`
4.  Prueba los roles desde el portal operacional:
    *   **Paciente Onboarding (Passkey):** Crea tu cuenta de paciente usando tu biometría. Verás que el backend le asigna automáticamente una billetera inteligente en hardware y la fondea con Stellar Testnet Faucet.
    *   **Consola de Administración (`/admin`):** Inicia sesión con la cuenta de administrador (puedes usar el modo demo para visualización inmediata). Aprueba los médicos pendientes y presiona "Registrar on-chain" para ver cómo se transmite la transacción a Stellar Testnet.
    *   **Portal Médico (`/medico/operacion`):** Simula una consulta con el paciente demo, ingresa el diagnóstico privado y emite la receta. Verás el ID del contrato de Stellar y el hash del medicamento emitido.
    *   **Portal del Paciente (`/paciente/recetas`):** Observa la receta emitida en tiempo real, su saldo disponible y genera el QR de retiro.
    *   **Punto de Venta del Dispensario (`/dispensario/operacion`):** Ingresa el ID de la receta del paciente. Valídala contra el ledger. Realiza una dispensación parcial o total (ingresando lote de control) y confirma cómo se reduce el saldo disponible en Stellar Testnet.

---

## 🔗 4. Identificadores de Contratos Activos en Testnet

Actualmente, el proyecto está enlazado a los siguientes contratos inteligentes desplegados de forma permanente en Stellar Testnet (configurados en tu `.env` actual):

*   **Doctor Registry:** `CCSOMUNZQXETL655HKTEKDRI2ZTW5FEEEEYIGXKV5IHLMBMDHSZMZINJ`
*   **Dispensary Registry:** `CB77Y2SRV6G7OU44ZXSDSMDFSG6AXJ2UVGM7T4XPUD2VXO2SEEJLPYTD`
*   **Prescription Contract:** `CBPH3CHKAKSFZLDQRIMWY5UXZH4SXHARCNBHFXSLXBXC2TD26O634QQM`
*   **Dispense Record:** `CCUMV25TIFSPP6LINQHYSPVICPELEP2URY6TCPWCWW5YEEFJRFTAILRN`

*Puedes auditar las transacciones y llamados a estos contratos directamente copiando sus direcciones en el explorador de bloques [Stellar.expert](https://stellar.expert/explorer/testnet/).*

---

## 🔐 5. Modelo Jurídico e ISP (Cumplimiento Chileno)

El diseño de Trust Leaf se alinea rigurosamente con el marco legal sanitario de Chile:
*   **Ley 20.000 / Ley 21.575 (Art. 8):** El registro y estampa de tiempo on-chain de la receta médica magistral sirve como justificación inalterable y defensa penal de la posesión y cultivo del paciente ante fiscalías y policías.
*   **Superintendencia de Salud (SIS):** El validador exige incorporar el RUT y Registro SIS del médico, los cuales se validan contra el registro nacional antes de otorgarle su estado aprobado en el ledger de Stellar.
*   **Preparación Magistral (ISP & Minsal):** La receta compila un recetario guiado de fitocannabinoides (THC/CBD) y volumen del preparado que permite al farmacéutico generar el Libro de Control de Estupefacientes digital integrado en el PoS de venta del dispensario.

---

## 🚧 6. Próximos Pasos Técnicos para el Piloto Real
1.  **Migración Completa a Firmas Client-side:** Reemplazar las firmas automáticas hechas con las secret keys del servidor por firmas directas en navegador usando billeteras del ecosistema (Freighter o Albedo) o mediante Passkeys directas firmando los XDR en el cliente.
2.  **Cifrado Homomórfico/Simétrico en Firebase:** Incorporar una capa de cifrado simétrico en el cliente (usando llaves derivadas de la passkey del paciente) antes de guardar el diagnóstico en Firebase Firestore, de modo que el backend sea verdaderamente zero-knowledge.
3.  **Habilitación del Allowlist de Administradores:** Registrar los UIDs reales de Firebase Auth de los administradores clínicos en la colección `appAdministrators` de Firestore para restringir accesos al panel `/admin`.
