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
