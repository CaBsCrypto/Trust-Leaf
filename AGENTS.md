# Hoja de Ruta Técnica: Trust Leaf (Stellar + Firebase)

Este documento sirve como guía para el siguiente desarrollador o agente que continúe la construcción de esta dApp.

## 🏗️ Arquitectura Actual
- **Frontend:** React 18 + Vite + Tailwind CSS.
- **Backend:** Express configurado como middleware de Vite (Type: Module).
- **Blockchain:** Stellar Network (Testnet). Uso de `stellar-sdk`.
- **Base de Datos/Auth:** Firebase (Firestore & Auth).

## 🚀 Próximos Pasos Técnicos

### 1. Implementación de Recetas como NFT (Stellar)
En el archivo `server.ts` se encuentra el endpoint `/api/stellar/verify-passport/`. El siguiente paso es implementar el **Minting**:
- **Asset Code:** `RX[ID_UNICO]`.
- **Issuer:** Cuenta del Médico.
- **Distribución:** Se debe enviar el NFT a la cuenta del Paciente.
- **Temporalidad:** Usar `TimeBounds` en Stellar para que la transacción de "Claim" del dispensario expire si no se usa a tiempo. Recomendado usar **Clawback** habilitado en el asset para invalidar recetas si el médico lo requiere.

### 2. Sincronización Firebase -> Blockchain
Actualmente, los retiros se guardan en el estado del frontend (`localStorage`). Se debe:
1. Migrar `activePickups` a la colección `pickups` en Firestore.
2. Al confirmar un retiro, el backend debe verificar en el Ledger de Stellar que el paciente posee el Token de la receta.
3. Marcar la receta como "Quemada" (Burned) o enviarla de vuelta al emisor al completar el retiro.

### 3. Autenticación Real
- Reemplazar los botones de "Login" del mockup con `signInWithPopup(auth, googleProvider)`.
- El `uid` de Firebase debe vincularse a una `Stellar Public Key` (mapeo guardado en la colección `users`).

## 🔐 Seguridad
- Las reglas de Firestore en `firestore.rules` ya están desplegadas y protegen los datos por `request.auth.uid`.
- **IMPORTANTE:** Nunca exponer Secret Keys de Stellar en el frontend. Toda firma de transacciones pesadas debe ocurrir en `server.ts` o mediante el uso de un Wallet (como Albedo o Freighter) en el cliente.

## 📦 Despliegue
- El `package.json` está configurado para ejecutar `tsx server.ts` en desarrollo.
- Para producción (Vercel/Cloud Run), asegurar que las variables de entorno de `.env.example` estén configuradas.

## 🎯 Decisiones de Diseño de la Segunda Fase (Alineación /grill-me)

Durante la sesión de alineación del 9 de junio de 2026, acordamos los siguientes enfoques de diseño técnico para continuar la construcción del MVP:

### 1. Sincronización Avanzada en Firestore (`pickups`)
- **Query de Privacidad en Dispensario:** Al consultar retiros pendientes, el portal del dispensario filtrará en tiempo real solo los documentos de la colección `pickups` cuyo campo `dispensaryId` coincida con su ID aprobado de Firestore o su clave pública Stellar. Esto evita fugas de información inter-sucursal.
- **Transición de Estado:** Cuando el dispensario registra la entrega, el estado de la dispensa en Firestore cambia de `pending` a `completed`, coordinándose con la quema/descuento on-chain.

### 2. Soporte Híbrido de Firma para Profesionales (Web3 + Custodial)
- **Selector de Firma:** Médicos y dispensarios tendrán un control interactivo en su interfaz para elegir:
  - **Firma Delegada (Custodial):** Firma en el servidor derivando el keypair determinista desde el email de sesión (ideal para demos rápidas).
  - **Firma Local (Web3):** Firma en el frontend usando la extensión de navegador **Freighter** o **Albedo**, delegando al servidor únicamente la transmisión final (`submit`).

### 3. Custodia 100% On-chain en Soroban
- **Modificación del Contrato `Prescription`:**
  - Agregar la propiedad `retained_by: Option<Address>` al struct `Prescription`.
  - Crear el método `retain_prescription(dispensary: Address, prescription_id: u64)` que guarda el dispensario custodio en el ledger.
  - Crear el método `release_prescription(doctor: Address, prescription_id: u64)` para remover el custodio.
  - Modificar `record_partial_dispense` para validar que si `retained_by` está definido, la llamada solo sea válida si proviene de la dirección del dispensario custodio.

### 4. Receta Magistral PDF Client-Side
- **jsPDF en el Cliente:** Generar el PDF oficial del preparado magistral directamente en el navegador del médico. El documento incluirá un código de barras, un QR dinámico con un enlace de verificación (`trustleaf.org/verify/[id]`) y la representación visual de la firma digital médica vinculada a la TX de Stellar.

