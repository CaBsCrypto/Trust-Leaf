import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import * as StellarSdk from "stellar-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json());

  // API Routes
  // Stellar Network Config
  app.get("/api/stellar/health", async (req, res) => {
    try {
      // Connect to Testnet by default
      const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      const ledgers = await server.ledgers().limit(1).call();
      res.json({
        status: "connected",
        network: "Stellar Testnet",
        latestLedger: ledgers.records[0]?.sequence
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Could not connect to Stellar" });
    }
  });

  // Example: Verify a Trust ID (Patient Passport) on chain
  app.get("/api/stellar/verify-passport/:accountId", async (req, res) => {
    const { accountId } = req.params;
    try {
      const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      const account = await server.loadAccount(accountId);
      
      /**
       * RECETA MÉDICA COMO NFT TEMPORAL EN STELLAR
       * 
       * Para implementar recetas como NFTs con temporalidad en Stellar:
       * 1. Minting: Emitir un asset (NFT) a la cuenta del paciente.
       * 2. Temporalidad: Usar 'TimeBounds' en las transacciones para asegurar que el asset
       *    solo sea válido en un rango de tiempo, o usar 'Clawback' para que el emisor
       *    pueda recuperar/invalidar el token si expira.
       * 3. Metadata: Guardar el hash de IPFS de la receta completa en un memo o como
       *    data attribute en el ledger.
       */
      
      // Look for a specific data attribute 'MedicalTrustID' or similar
      const trustID = account.data && account.data["MedicalTrustID"];
      
      res.json({
        verified: !!trustID,
        accountId,
        trustID: trustID ? Buffer.from(trustID, 'base64').toString() : null
      });
    } catch (error) {
      res.status(404).json({ verified: false, message: "Account not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
