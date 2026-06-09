import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import * as LegacyStellarSdk from "stellar-sdk";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  dispensePrescriptionForPatient as dispensePrescriptionForPatientShared,
  fundTestnetAccount,
  getRuntimeReadiness,
  issuePrescriptionForPatient as issuePrescriptionForPatientShared,
  validatePrescriptionForDispensary,
  registerDoctorOnTestnet,
  registerDispensaryOnTestnet,
  revokeDoctorOnTestnet,
  revokeDispensaryOnTestnet,
  retainPrescriptionForDispensary,
  releasePrescriptionToPatient,
  buildIssuePrescriptionTx,
  buildDispensePrescriptionTx,
  submitSignedTransaction,
  getDeterministicKeypair,
} from "./api/_lib/stellar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_READONLY_ACCOUNT =
  "GB2PFKB24QPIEB3VIKYTIEG7M4KRH5I4KBPV26LUC6KOE2YAWSCPXKZ6";
const DEFAULT_REGISTRY_CONTRACT_ID =
  "CDNV4BVPCLAZJXYZ2ADPA2SQMBGJQMSQDF33QABQ4YN2W63C5CJF3PHS";
const DEFAULT_DISPENSARY_REGISTRY_CONTRACT_ID =
  "CCFW6WEVV76EIRHKZDPIKIXHEFC53EMJ5FLND5ZBBES22NXZD3VUQNTX";
const DEFAULT_PRESCRIPTION_CONTRACT_ID =
  "CDPIIGBA6WAL7MBPUWSRIQNLCITKGRO5REWIYTAVSOS3FHSK373MEK42";
const DEFAULT_DISPENSE_RECORD_CONTRACT_ID =
  "CBG6Z77BNEVMPOVAYI2RKGVFSNU4QJ4GBCP5ALRECDHDBJGWOO2DQJVI";
const PRESCRIPTION_WASM_PATH = path.join(
  __dirname,
  "soroban",
  "target",
  "wasm32v1-none",
  "release",
  "prescription.wasm",
);
const prescriptionSpec = loadContractSpec(PRESCRIPTION_WASM_PATH);

interface RateLimitInfo {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitInfo>();

function createRateLimiter(limit: number, windowMs: number, message: string) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const now = Date.now();
    let record = rateLimitStore.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
    }

    record.count++;
    rateLimitStore.set(ip, record);

    if (record.count > limit) {
      res.status(429).json({ message });
      return;
    }

    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const passkeyServer = await createPasskeyServer();

  // Middlewares
  app.use(express.json());

  // HTTP Security Headers (XSS, Clickjacking, MIME Sniffing & HSTS Defense)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    next();
  });

  // API Rate Limiters for DDoS & Spam Protection
  const faucetLimiter = createRateLimiter(5, 15 * 60 * 1000, "Has superado el límite de fondeos. Inténtalo de nuevo en 15 minutos.");
  const writeLimiter = createRateLimiter(10, 60 * 1000, "Has superado el límite de operaciones por minuto. Por favor, espera.");

  // API Routes
  // Stellar Network Config
  app.get("/api/stellar/health", async (req, res) => {
    try {
      // Connect to Testnet by default
      const server = new LegacyStellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
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

  app.get("/api/stellar/contracts", async (req, res) => {
    try {
      const server = getSorobanServer();
      const latestLedger = await server.getLatestLedger();

      res.json({
        network: "Stellar Testnet",
        rpcUrl: getRpcUrl(),
        latestLedger: latestLedger.sequence,
        registryContractId: getRegistryContractId(),
        dispensaryRegistryContractId: getDispensaryRegistryContractId(),
        prescriptionContractId: getPrescriptionContractId(),
        dispenseRecordContractId: getDispenseRecordContractId(),
      });
    } catch (error) {
      res.status(500).json({
        message: "No fue posible obtener el estado de los contratos en testnet.",
      });
    }
  });

  app.get("/api/stellar/readiness", (_req, res) => {
    res.json(getRuntimeReadiness());
  });

  app.post("/api/stellar/faucet", faucetLimiter, async (req, res) => {
    try {
      const { role, address } = req.body ?? {};
      const result = await fundTestnetAccount({
        role: role ? String(role) as "admin" | "doctor" | "dispensary" | "patient" : undefined,
        address: address ? String(address) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible fondear la cuenta en Stellar Testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/derive-wallet", async (req, res) => {
    try {
      const { email } = req.body ?? {};
      if (!email) {
        res.status(400).json({ message: "Falta email." });
        return;
      }
      const normalized = String(email).toLowerCase().trim();
      if (normalized === "paciente@trustleaf.test") {
        res.json({ publicKey: "GDKCAFBRPVG4E6VEX4SUFVOMLDQKXDVEECR2DIWYRDEMIAS7CUR2RMXP" });
        return;
      }
      const keypair = getDeterministicKeypair(normalized);
      res.json({ publicKey: keypair.publicKey() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al derivar la wallet.";
      res.status(500).json({ message });
    }
  });

  app.get("/api/stellar/patient/:address/dashboard", async (req, res) => {
    try {
      const dashboard = await getPatientDashboard(req.params.address);
      res.json(dashboard);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible consultar el dashboard del paciente en testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/doctor/issue-prescription", writeLimiter, async (req, res) => {
    try {
      const {
        patientAddress,
        treatment,
        dosage,
        notes,
        durationDays,
        doctorEmail,
      } = req.body ?? {};

      if (!patientAddress || !treatment || !dosage || !durationDays) {
        res.status(400).json({
          message:
            "Faltan datos para emitir la receta: patientAddress, treatment, dosage y durationDays.",
        });
        return;
      }

      const normalizedDurationDays = Number(durationDays);
      if (!Number.isFinite(normalizedDurationDays) || normalizedDurationDays < 1) {
        res.status(400).json({
          message: "durationDays debe ser un numero mayor o igual a 1.",
        });
        return;
      }

      const result = await issuePrescriptionForPatientShared({
        patientAddress: String(patientAddress),
        treatment: String(treatment),
        dosage: String(dosage),
        notes: notes ? String(notes) : "",
        durationDays: normalizedDurationDays,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible emitir la receta en testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/dispensary/dispense-prescription", writeLimiter, async (req, res) => {
    try {
      const { prescriptionId, productLabel, batchLabel, quantity, dispensaryEmail, doctorEmail } = req.body ?? {};
      const normalizedPrescriptionId = Number(prescriptionId);
      const normalizedQuantity = Number(quantity);

      if (
        !Number.isFinite(normalizedPrescriptionId) ||
        !productLabel ||
        !batchLabel ||
        !Number.isFinite(normalizedQuantity)
      ) {
        res.status(400).json({
          message:
            "Faltan datos para dispensar: prescriptionId, productLabel, batchLabel y quantity.",
        });
        return;
      }

      const result = await dispensePrescriptionForPatientShared({
        prescriptionId: normalizedPrescriptionId,
        productLabel: String(productLabel),
        batchLabel: String(batchLabel),
        quantity: normalizedQuantity,
        dispensaryEmail: dispensaryEmail ? String(dispensaryEmail) : undefined,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible dispensar la receta en testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/doctor/build-issue-prescription", async (req, res) => {
    try {
      const {
        doctorAddress,
        patientAddress,
        treatment,
        dosage,
        notes,
        durationDays,
        totalQuantity,
      } = req.body ?? {};

      if (!doctorAddress || !patientAddress || !treatment || !dosage || !durationDays) {
        res.status(400).json({
          message: "Faltan datos para construir la receta: doctorAddress, patientAddress, treatment, dosage y durationDays.",
        });
        return;
      }

      const result = await buildIssuePrescriptionTx({
        doctorAddress: String(doctorAddress),
        patientAddress: String(patientAddress),
        treatment: String(treatment),
        dosage: String(dosage),
        notes: notes ? String(notes) : "",
        durationDays: Number(durationDays),
        totalQuantity: totalQuantity ? Number(totalQuantity) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible construir el XDR de emisión.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/dispensary/build-dispense-prescription", async (req, res) => {
    try {
      const { dispensaryAddress, prescriptionId, productLabel, batchLabel, quantity } = req.body ?? {};

      if (!dispensaryAddress || !prescriptionId || !productLabel || !batchLabel || !quantity) {
        res.status(400).json({
          message: "Faltan datos para construir la dispensación: dispensaryAddress, prescriptionId, productLabel, batchLabel y quantity.",
        });
        return;
      }

      const result = await buildDispensePrescriptionTx({
        dispensaryAddress: String(dispensaryAddress),
        prescriptionId: Number(prescriptionId),
        productLabel: String(productLabel),
        batchLabel: String(batchLabel),
        quantity: Number(quantity),
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible construir el XDR de dispensación.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/submit", async (req, res) => {
    try {
      const { xdr, operationType, patientAddress, medicationHash, totalQuantity, prescriptionId, durationDays } = req.body ?? {};

      if (!xdr || !operationType) {
        res.status(400).json({
          message: "Faltan parámetros obligatorios: xdr y operationType.",
        });
        return;
      }

      const result = await submitSignedTransaction({
        xdr: String(xdr),
        operationType: String(operationType) as "issue" | "dispense",
        patientAddress: patientAddress ? String(patientAddress) : undefined,
        medicationHash: medicationHash ? String(medicationHash) : undefined,
        totalQuantity: totalQuantity ? Number(totalQuantity) : undefined,
        prescriptionId: prescriptionId ? Number(prescriptionId) : undefined,
        durationDays: durationDays ? Number(durationDays) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible transmitir la transacción firmada a testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/dispensary/retain-prescription", async (req, res) => {
    try {
      const { prescriptionId, dispensaryAddress, lockPeriodDays, doctorEmail } = req.body ?? {};
      const normalizedPrescriptionId = Number(prescriptionId);

      if (!Number.isFinite(normalizedPrescriptionId) || !dispensaryAddress) {
        res.status(400).json({
          message: "Faltan datos para retener la receta: prescriptionId y dispensaryAddress.",
        });
        return;
      }

      const result = await retainPrescriptionForDispensary({
        prescriptionId: normalizedPrescriptionId,
        dispensaryAddress: String(dispensaryAddress),
        lockPeriodDays: lockPeriodDays ? Number(lockPeriodDays) : undefined,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible retener la receta en testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/dispensary/release-prescription", async (req, res) => {
    try {
      const { prescriptionId, doctorEmail } = req.body ?? {};
      const normalizedPrescriptionId = Number(prescriptionId);

      if (!Number.isFinite(normalizedPrescriptionId)) {
        res.status(400).json({
          message: "Falta prescriptionId para liberar la receta.",
        });
        return;
      }

      const result = await releasePrescriptionToPatient({
        prescriptionId: normalizedPrescriptionId,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible liberar la receta en testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/dispensary/validate-prescription", async (req, res) => {
    try {
      const { prescriptionId } = req.body ?? {};
      const normalizedPrescriptionId = Number(prescriptionId);

      if (!Number.isFinite(normalizedPrescriptionId)) {
        res.status(400).json({
          message: "Falta prescriptionId para validar la receta.",
        });
        return;
      }

      const result = await validatePrescriptionForDispensary({
        prescriptionId: normalizedPrescriptionId,
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible validar la receta en testnet.";

      if (/missing|not found|PrescriptionMissing|#4/i.test(message)) {
        res.status(404).json({
          code: "PRESCRIPTION_NOT_FOUND",
          message: "No encontramos esa receta en el contrato Prescription de Testnet.",
        });
        return;
      }

      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/admin/register-doctor", async (req, res) => {
    try {
      const { doctorAddress } = req.body ?? {};
      if (!doctorAddress) {
        res.status(400).json({ message: "Falta doctorAddress." });
        return;
      }
      const result = await registerDoctorOnTestnet({
        doctorAddress: String(doctorAddress),
      });
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible registrar el medico en DoctorRegistry Testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/admin/register-dispensary", async (req, res) => {
    try {
      const { dispensaryAddress } = req.body ?? {};
      if (!dispensaryAddress) {
        res.status(400).json({ message: "Falta dispensaryAddress." });
        return;
      }
      const result = await registerDispensaryOnTestnet({
        dispensaryAddress: String(dispensaryAddress),
      });
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible registrar el dispensario en DispensaryRegistry Testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/admin/revoke-doctor", async (req, res) => {
    try {
      const { doctorAddress } = req.body ?? {};
      if (!doctorAddress) {
        res.status(400).json({ message: "Falta doctorAddress." });
        return;
      }
      const result = await revokeDoctorOnTestnet({
        doctorAddress: String(doctorAddress),
      });
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible revocar el medico en DoctorRegistry Testnet.";
      res.status(500).json({ message });
    }
  });

  app.post("/api/stellar/admin/revoke-dispensary", async (req, res) => {
    try {
      const { dispensaryAddress } = req.body ?? {};
      if (!dispensaryAddress) {
        res.status(400).json({ message: "Falta dispensaryAddress." });
        return;
      }
      const result = await revokeDispensaryOnTestnet({
        dispensaryAddress: String(dispensaryAddress),
      });
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible revocar el dispensario en DispensaryRegistry Testnet.";
      res.status(500).json({ message });
    }
  });

  app.get("/api/passkeys/health", (req, res) => {
    const configured = Boolean(
      process.env.STELLAR_RELAYER_URL &&
        process.env.STELLAR_RELAYER_API_KEY,
    );

    res.json({
      configured,
      network: "Stellar Testnet",
      rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    });
  });

  app.post("/api/passkeys/send", async (req, res) => {
    if (!passkeyServer) {
      res.status(503).send(
        "Passkey relayer no configurado. Define STELLAR_RELAYER_URL y STELLAR_RELAYER_API_KEY para testnet.",
      );
      return;
    }

    const { xdr } = req.body ?? {};
    if (!xdr || typeof xdr !== "string") {
      res.status(400).send("Debe enviarse un XDR base64 válido.");
      return;
    }

    try {
      const result = await passkeyServer.send(xdr);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible enviar la transacción passkey a testnet.";
      res.status(500).send(message);
    }
  });

  app.get("/api/passkeys/contract/:keyId", async (req, res) => {
    if (!passkeyServer || !process.env.STELLAR_MERCURY_URL) {
      res.status(503).send(
        "Mercury no configurado. Define STELLAR_MERCURY_URL y credenciales para descubrir smart wallets por passkey.",
      );
      return;
    }

    try {
      const contractId = await passkeyServer.getContractId({
        keyId: req.params.keyId,
      });
      res.send(contractId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible resolver el contract id para esta passkey.";
      res.status(404).send(message);
    }
  });

  // Verify a Patient Passport and active Prescription NFTs on chain
  app.get("/api/stellar/verify-passport/:accountId", async (req, res) => {
    const { accountId } = req.params;
    try {
      const server = new LegacyStellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
      const account = await server.loadAccount(accountId);
      
      // 1. Look for a specific data attribute 'MedicalTrustID' or similar
      const trustID = account.data && account.data["MedicalTrustID"];
      const trustIDDecoded = trustID ? Buffer.from(trustID, 'base64').toString() : null;

      // 2. Scan standard balances for active prescription NFTs (Asset code starting with 'RX')
      const activePrescriptionNFTs = account.balances
        .filter((b: any) => b.asset_code && b.asset_code.startsWith("RX") && Number(b.balance) > 0)
        .map((b: any) => ({
          assetCode: b.asset_code,
          issuer: b.asset_issuer,
          balance: b.balance
        }));

      // 3. Scan claimable balances where patient is claimant for prescription NFTs
      let activeClaimableNFTs: any[] = [];
      try {
        const claimables = await server
          .claimableBalances()
          .claimant(accountId)
          .call();
        activeClaimableNFTs = claimables.records
          .filter((record: any) => {
            const assetStr = record.asset || "";
            return assetStr.includes("RX");
          })
          .map((record: any) => {
            const [assetCode, issuer] = record.asset.split(":");
            return {
              balanceId: record.id,
              assetCode,
              issuer,
              amount: record.amount,
              claimants: record.claimants
            };
          });
      } catch (err) {
        console.error("Error querying claimable balances for verify-passport:", err);
      }
      
      res.json({
        verified: !!trustID || activePrescriptionNFTs.length > 0 || activeClaimableNFTs.length > 0,
        accountId,
        trustID: trustIDDecoded,
        activePrescriptionNFTs,
        activeClaimableNFTs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(404).json({ 
        verified: false, 
        message: "La cuenta del paciente no existe en Stellar Testnet o no se pudo cargar.",
        accountId
      });
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

async function createPasskeyServer() {
  const relayerUrl = process.env.STELLAR_RELAYER_URL;
  const relayerApiKey = process.env.STELLAR_RELAYER_API_KEY;

  if (!relayerUrl || !relayerApiKey) {
    return null;
  }

  const { PasskeyServer } = await import("passkey-kit/src/server");

  return new PasskeyServer({
    rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    relayerUrl,
    relayerApiKey,
    mercuryUrl: process.env.STELLAR_MERCURY_URL,
    mercuryProjectName: process.env.STELLAR_MERCURY_PROJECT_NAME,
    mercuryJwt: process.env.STELLAR_MERCURY_JWT,
    mercuryKey: process.env.STELLAR_MERCURY_KEY,
  });
}

function getRpcUrl() {
  return process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
}

function getNetworkPassphrase() {
  return (
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    "Test SDF Network ; September 2015"
  );
}

function getRegistryContractId() {
  return (
    process.env.STELLAR_REGISTRY_CONTRACT_ID || DEFAULT_REGISTRY_CONTRACT_ID
  );
}

function getPrescriptionContractId() {
  return (
    process.env.STELLAR_PRESCRIPTION_CONTRACT_ID ||
    DEFAULT_PRESCRIPTION_CONTRACT_ID
  );
}

function getDispensaryRegistryContractId() {
  return (
    process.env.STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID ||
    DEFAULT_DISPENSARY_REGISTRY_CONTRACT_ID
  );
}

function getDispenseRecordContractId() {
  return (
    process.env.STELLAR_DISPENSE_RECORD_CONTRACT_ID ||
    DEFAULT_DISPENSE_RECORD_CONTRACT_ID
  );
}

function getReadonlyAccountId() {
  return process.env.STELLAR_READONLY_ACCOUNT_ID || DEFAULT_READONLY_ACCOUNT;
}

function getSorobanServer() {
  return new StellarSdk.rpc.Server(getRpcUrl());
}

function loadContractSpec(wasmPath: string) {
  const wasm = fs.readFileSync(wasmPath);
  return StellarSdk.contract.Spec.fromWasm(wasm);
}

async function getPatientDashboard(patientAddress: string) {
  const server = getSorobanServer();
  const latestLedger = await server.getLatestLedger();
  const prescriptions = await getPatientPrescriptions(
    server,
    getPrescriptionContractId(),
    patientAddress,
    latestLedger.sequence,
  );

  const active = prescriptions.filter(
    (item) => item.status === "active",
  ).length;
  const used = prescriptions.filter((item) => item.status === "used").length;
  const expired = prescriptions.filter(
    (item) => item.status === "expired",
  ).length;

  return {
    patientAddress,
    network: "Stellar Testnet",
    rpcUrl: getRpcUrl(),
    latestLedger: latestLedger.sequence,
    latestLedgerClosedAt: new Date().toISOString(),
    registryContractId: getRegistryContractId(),
    prescriptionContractId: getPrescriptionContractId(),
    summary: {
      total: prescriptions.length,
      active,
      used,
      expired,
    },
    prescriptions,
  };
}

async function getPatientPrescriptions(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  contractId: string,
  patientAddress: string,
  latestLedger: number,
) {
  const topic = StellarSdk.nativeToScVal("PrescriptionIssued").toXDR("base64");

  const page = await server.getEvents({
    startLedger: Math.max(1, latestLedger - 10_000),
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
        topics: [[topic]],
      },
    ],
    limit: 100,
  });

  const issued = page.events
    .map((event) => decodePrescriptionIssuedEvent(event))
    .filter(
      (event): event is NonNullable<typeof event> =>
        Boolean(event) && event.patient === patientAddress,
    );

  const prescriptions = await Promise.all(
    issued.map(async (event) => {
      const onchain = await invokeReadonlyContract(
        server,
        contractId,
        "get_prescription",
        { id: BigInt(event.id) },
      );

      return normalizePrescriptionRecord(onchain, event);
    }),
  );

  return prescriptions.sort((a, b) => b.id - a.id);
}

function decodePrescriptionIssuedEvent(
  event: StellarSdk.rpc.Api.EventResponse,
) {
  const values = event.value.vec();
  if (!values || values.length < 3) {
    return null;
  }

  return {
    id: Number(StellarSdk.scValToBigInt(values[0])),
    patient: StellarSdk.Address.fromScVal(values[1]).toString(),
    doctor: StellarSdk.Address.fromScVal(values[2]).toString(),
    ledger: event.ledger,
    ledgerClosedAt: event.ledgerClosedAt,
    txHash: event.txHash,
  };
}

async function invokeReadonlyContract(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
) {
  const sourceAccount = await server.getAccount(getReadonlyAccountId());
  const contract = new StellarSdk.Contract(contractId);
  const scArgs = prescriptionSpec.funcArgsToScVals(method, args);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (StellarSdk.rpc.Api.isSimulationError(simulation) || !simulation.result) {
    throw new Error(
      `La simulación del contrato ${method} falló en testnet.`,
    );
  }

  return prescriptionSpec.funcResToNative(method, simulation.result.retval);
}

function normalizePrescriptionRecord(
  onchain: any,
  event: {
    id: number;
    patient: string;
    doctor: string;
    ledger: number;
    ledgerClosedAt: string;
    txHash: string;
  },
) {
  const expiresAt = Number(onchain.expires_at);
  const isUsed = Boolean(onchain.is_used);
  const now = Math.floor(Date.now() / 1000);
  const status = isUsed ? "used" : expiresAt <= now ? "expired" : "active";

  return {
    id: Number(onchain.id),
    patient: String(onchain.patient),
    doctor: String(onchain.doctor),
    medicationHash: bufferLikeToHex(onchain.medication_hash),
    expiresAt,
    isUsed,
    status,
    issuedAt: event.ledgerClosedAt,
    issuedLedger: event.ledger,
    txHash: event.txHash,
  };
}

function bufferLikeToHex(value: unknown) {
  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }

  if (Array.isArray(value)) {
    return Buffer.from(value).toString("hex");
  }

  return String(value);
}

startServer();
