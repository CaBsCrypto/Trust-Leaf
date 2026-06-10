declare global {
  type URI = any;
}

import { createHash } from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';

const DEFAULT_READONLY_ACCOUNT =
  'GB2PFKB24QPIEB3VIKYTIEG7M4KRH5I4KBPV26LUC6KOE2YAWSCPXKZ6';
const DEFAULT_REGISTRY_CONTRACT_ID =
  'CAQZWTOY5L7SN6IJIO5R23DAOIK7UQDM6YSRRXE3B5XQNXDM2Q4W4ICJ';
const DEFAULT_DISPENSARY_REGISTRY_CONTRACT_ID =
  'CBC7OYPU5VXFPCSY6FV74Q6E6MY5NFJGFLKTXQFX7ASMNH4SSTHAW3L6';
const DEFAULT_PRESCRIPTION_CONTRACT_ID =
  'CCACCU7JGNRL3RQGMNNM5LK27PQEDUOLJQ73QSQR5NTNJGYKOJSQFNIA';
const DEFAULT_DISPENSE_RECORD_CONTRACT_ID =
  'CAT756N5HQALOEISAEQSASHBK2N4XLUCDJNDEIW4DK6SJP4YNOAJRUPE';
const DEFAULT_DEMO_PATIENT_ADDRESS =
  'GBOVHFJQXZR5LMODPMKM766SHK5D7XOPZUHUYRPHENQKWDQI33DSWRJ6';
const DEFAULT_DEMO_DOCTOR_ADDRESS =
  'GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX';
const DEFAULT_DEMO_DISPENSARY_ADDRESS =
  'GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6';

import * as crypto from 'crypto';

export function getDeterministicKeypair(email: string): StellarSdk.Keypair {
  const normalized = email.toLowerCase().trim();

  if (normalized === 'medico@trustleaf.test') {
    const secret = getDoctorSecret();
    if (secret) return StellarSdk.Keypair.fromSecret(secret);
  }
  if (normalized === 'dispensario@trustleaf.test') {
    const secret = getDispensarySecret();
    if (secret) return StellarSdk.Keypair.fromSecret(secret);
  }

  const salt = getAdminSecret() || 'trust-leaf-secret-salt-2026';
  const hash = crypto.createHmac('sha256', salt).update(normalized).digest();
  return StellarSdk.Keypair.fromRawEd25519Seed(hash);
}

export function getRpcUrl() {
  return process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
}

export function getNetworkPassphrase() {
  return (
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    'Test SDF Network ; September 2015'
  );
}

export function getRegistryContractId() {
  return (
    process.env.STELLAR_REGISTRY_CONTRACT_ID || DEFAULT_REGISTRY_CONTRACT_ID
  );
}

export function getPrescriptionContractId() {
  return (
    process.env.STELLAR_PRESCRIPTION_CONTRACT_ID ||
    DEFAULT_PRESCRIPTION_CONTRACT_ID
  );
}

export function getDispensaryRegistryContractId() {
  return (
    process.env.STELLAR_DISPENSARY_REGISTRY_CONTRACT_ID ||
    DEFAULT_DISPENSARY_REGISTRY_CONTRACT_ID
  );
}

export function getDispenseRecordContractId() {
  return (
    process.env.STELLAR_DISPENSE_RECORD_CONTRACT_ID ||
    DEFAULT_DISPENSE_RECORD_CONTRACT_ID
  );
}

export function getReadonlyAccountId() {
  return process.env.STELLAR_READONLY_ACCOUNT_ID || DEFAULT_READONLY_ACCOUNT;
}

export function getDemoPatientAddress() {
  return process.env.STELLAR_DEMO_PATIENT_ADDRESS || DEFAULT_DEMO_PATIENT_ADDRESS;
}

export function getDoctorSecret() {
  return process.env.STELLAR_DOCTOR_SECRET?.trim() || '';
}

export function getDoctorAddress() {
  const secret = getDoctorSecret();
  if (!secret) {
    return process.env.STELLAR_DOCTOR_ADDRESS || DEFAULT_DEMO_DOCTOR_ADDRESS;
  }

  return StellarSdk.Keypair.fromSecret(secret).publicKey();
}

export function getDispensarySecret() {
  return process.env.STELLAR_DISPENSARY_SECRET?.trim() || '';
}

export function getDispensaryAddress() {
  const secret = getDispensarySecret();
  if (!secret) {
    return process.env.STELLAR_DISPENSARY_ADDRESS || DEFAULT_DEMO_DISPENSARY_ADDRESS;
  }

  return StellarSdk.Keypair.fromSecret(secret).publicKey();
}

export function getAdminSecret() {
  return process.env.STELLAR_ADMIN_SECRET?.trim() || '';
}

export function getAdminAddress() {
  const secret = getAdminSecret();
  if (!secret) {
    return process.env.STELLAR_ADMIN_ADDRESS || DEFAULT_READONLY_ACCOUNT;
  }

  return StellarSdk.Keypair.fromSecret(secret).publicKey();
}

export function getRuntimeReadiness() {
  const hasAdminSigner = Boolean(getAdminSecret());
  const hasDoctorSigner = Boolean(getDoctorSecret());
  const hasDispensarySigner = Boolean(getDispensarySecret());
  const hasPasskeyRelayer = Boolean(
    process.env.STELLAR_RELAYER_URL && process.env.STELLAR_RELAYER_API_KEY,
  );
  const hasMercuryLookup = Boolean(
    process.env.STELLAR_MERCURY_URL &&
      (process.env.STELLAR_MERCURY_JWT || process.env.STELLAR_MERCURY_KEY),
  );

  return {
    network: 'Stellar Testnet',
    rpcUrl: getRpcUrl(),
    contracts: {
      registryContractId: getRegistryContractId(),
      dispensaryRegistryContractId: getDispensaryRegistryContractId(),
      prescriptionContractId: getPrescriptionContractId(),
      dispenseRecordContractId: getDispenseRecordContractId(),
    },
    signers: {
      admin: {
        configured: hasAdminSigner,
        address: getAdminAddress() || null,
      },
      doctor: {
        configured: hasDoctorSigner,
        address: getDoctorAddress() || null,
      },
      dispensary: {
        configured: hasDispensarySigner,
        address: getDispensaryAddress() || null,
      },
    },
    passkeys: {
      relayerConfigured: hasPasskeyRelayer,
      mercuryConfigured: hasMercuryLookup,
    },
    capabilities: {
      readContracts: true,
      registerActors: hasAdminSigner,
      issuePrescriptions: hasDoctorSigner,
      dispensePrescriptions: hasDispensarySigner,
      passkeyRelay: hasPasskeyRelayer,
      passkeyDiscovery: hasMercuryLookup,
    },
    missing: [
      ...(!hasAdminSigner ? ['STELLAR_ADMIN_SECRET'] : []),
      ...(!hasDoctorSigner ? ['STELLAR_DOCTOR_SECRET'] : []),
      ...(!hasDispensarySigner ? ['STELLAR_DISPENSARY_SECRET'] : []),
      ...(!hasPasskeyRelayer ? ['STELLAR_RELAYER_URL', 'STELLAR_RELAYER_API_KEY'] : []),
      ...(!hasMercuryLookup ? ['STELLAR_MERCURY_URL', 'STELLAR_MERCURY_JWT or STELLAR_MERCURY_KEY'] : []),
    ],
  };
}

export async function fundTestnetAccount(input: {
  role?: 'admin' | 'doctor' | 'dispensary' | 'patient';
  address?: string;
}) {
  const address = resolveFaucetAddress(input).trim();

  if (!address) {
    throw new Error('No hay address testnet para fondear.');
  }

  try {
    StellarSdk.Keypair.fromPublicKey(address);
  } catch {
    throw new Error('La address Stellar no es valida.');
  }

  const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.detail || payload?.title || 'Friendbot no pudo fondear la cuenta.';
    if (/exist|already|funded/i.test(String(detail))) {
      return {
        network: 'Stellar Testnet',
        address,
        role: input.role ?? 'custom',
        funded: false,
        alreadyFunded: true,
        hash: null,
        message: 'La cuenta ya existe en testnet. Puede operar si mantiene saldo XLM de prueba.',
      };
    }

    throw new Error(String(detail));
  }

  return {
    network: 'Stellar Testnet',
    address,
    role: input.role ?? 'custom',
    funded: true,
    hash: payload?.hash ?? null,
  };
}

function resolveFaucetAddress(input: {
  role?: 'admin' | 'doctor' | 'dispensary' | 'patient';
  address?: string;
}) {
  if (input.address) return input.address;

  switch (input.role) {
    case 'admin':
      return getAdminAddress();
    case 'doctor':
      return getDoctorAddress();
    case 'dispensary':
      return getDispensaryAddress();
    case 'patient':
      return getDemoPatientAddress();
    default:
      return '';
  }
}

export async function registerDoctorOnTestnet(input: { doctorAddress: string }) {
  const doctorAddress = input.doctorAddress.trim();
  if (!doctorAddress) {
    throw new Error('Falta la wallet Stellar del medico.');
  }

  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    throw new Error('Falta STELLAR_ADMIN_SECRET para registrar medicos en DoctorRegistry Testnet.');
  }

  const server = getSorobanServer();
  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  const adminAddress = adminKeypair.publicKey();
  const contract = new StellarSdk.Contract(getRegistryContractId());

  const result = await submitSingleContractCall(
    server,
    adminKeypair,
    contract,
    'add_doctor',
    [addressToScVal(adminAddress), addressToScVal(doctorAddress)],
  );

  return {
    txHash: result.txHash,
    adminAddress,
    doctorAddress,
    registryContractId: getRegistryContractId(),
    network: 'Stellar Testnet',
  };
}

export async function registerDispensaryOnTestnet(input: { dispensaryAddress: string }) {
  const dispensaryAddress = input.dispensaryAddress.trim();
  if (!dispensaryAddress) {
    throw new Error('Falta la wallet Stellar del dispensario.');
  }

  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    throw new Error('Falta STELLAR_ADMIN_SECRET para registrar dispensarios en DispensaryRegistry Testnet.');
  }

  const server = getSorobanServer();
  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  const adminAddress = adminKeypair.publicKey();
  const contract = new StellarSdk.Contract(getDispensaryRegistryContractId());

  const result = await submitSingleContractCall(
    server,
    adminKeypair,
    contract,
    'add_dispensary',
    [addressToScVal(adminAddress), addressToScVal(dispensaryAddress)],
  );

  return {
    txHash: result.txHash,
    adminAddress,
    dispensaryAddress,
    dispensaryRegistryContractId: getDispensaryRegistryContractId(),
    network: 'Stellar Testnet',
  };
}

export async function revokeDoctorOnTestnet(input: { doctorAddress: string }) {
  const doctorAddress = input.doctorAddress.trim();
  if (!doctorAddress) {
    throw new Error('Falta la wallet Stellar del medico.');
  }

  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    throw new Error('Falta STELLAR_ADMIN_SECRET para revocar medicos en DoctorRegistry Testnet.');
  }

  const server = getSorobanServer();
  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  const adminAddress = adminKeypair.publicKey();
  const contract = new StellarSdk.Contract(getRegistryContractId());

  const result = await submitSingleContractCall(
    server,
    adminKeypair,
    contract,
    'remove_doctor',
    [addressToScVal(adminAddress), addressToScVal(doctorAddress)],
  );

  return {
    txHash: result.txHash,
    adminAddress,
    doctorAddress,
    registryContractId: getRegistryContractId(),
    network: 'Stellar Testnet',
  };
}

export async function revokeDispensaryOnTestnet(input: { dispensaryAddress: string }) {
  const dispensaryAddress = input.dispensaryAddress.trim();
  if (!dispensaryAddress) {
    throw new Error('Falta la wallet Stellar del dispensario.');
  }

  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    throw new Error('Falta STELLAR_ADMIN_SECRET para revocar dispensarios en DispensaryRegistry Testnet.');
  }

  const server = getSorobanServer();
  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  const adminAddress = adminKeypair.publicKey();
  const contract = new StellarSdk.Contract(getDispensaryRegistryContractId());

  const result = await submitSingleContractCall(
    server,
    adminKeypair,
    contract,
    'remove_dispensary',
    [addressToScVal(adminAddress), addressToScVal(dispensaryAddress)],
  );

  return {
    txHash: result.txHash,
    adminAddress,
    dispensaryAddress,
    dispensaryRegistryContractId: getDispensaryRegistryContractId(),
    network: 'Stellar Testnet',
  };
}

export function getSorobanServer() {
  return new StellarSdk.rpc.Server(getRpcUrl());
}

export async function createPasskeyServer() {
  const relayerUrl = process.env.STELLAR_RELAYER_URL;
  const relayerApiKey = process.env.STELLAR_RELAYER_API_KEY;

  if (!relayerUrl || !relayerApiKey) {
    return null;
  }

  const { PasskeyServer } = await import('passkey-kit/src/server');

  return new PasskeyServer({
    rpcUrl: getRpcUrl(),
    relayerUrl,
    relayerApiKey,
    mercuryUrl: process.env.STELLAR_MERCURY_URL,
    mercuryProjectName: process.env.STELLAR_MERCURY_PROJECT_NAME,
    mercuryJwt: process.env.STELLAR_MERCURY_JWT,
    mercuryKey: process.env.STELLAR_MERCURY_KEY,
  });
}

export async function getContractsStatus() {
  const server = getSorobanServer();
  const latestLedger = await server.getLatestLedger();

  return {
    network: 'Stellar Testnet',
    rpcUrl: getRpcUrl(),
    latestLedger: latestLedger.sequence,
    registryContractId: getRegistryContractId(),
    dispensaryRegistryContractId: getDispensaryRegistryContractId(),
    prescriptionContractId: getPrescriptionContractId(),
    dispenseRecordContractId: getDispenseRecordContractId(),
  };
}

export async function getPatientDashboard(patientAddress: string) {
  const server = getSorobanServer();
  const latestLedger = await server.getLatestLedger();
  const prescriptions = await getPatientPrescriptions(
    server,
    getPrescriptionContractId(),
    patientAddress,
    latestLedger.sequence,
  );
  const dispenseRecords = await getPatientDispenseRecords(
    server,
    getDispenseRecordContractId(),
    patientAddress,
    latestLedger.sequence,
  );

  const active = prescriptions.filter((item) => item.status === 'active').length;
  const used = prescriptions.filter((item) => item.status === 'used').length;
  const expired = prescriptions.filter((item) => item.status === 'expired').length;

  return {
    patientAddress,
    network: 'Stellar Testnet',
    rpcUrl: getRpcUrl(),
    latestLedger: latestLedger.sequence,
    latestLedgerClosedAt: new Date().toISOString(),
    registryContractId: getRegistryContractId(),
    dispensaryRegistryContractId: getDispensaryRegistryContractId(),
    prescriptionContractId: getPrescriptionContractId(),
    dispenseRecordContractId: getDispenseRecordContractId(),
    summary: {
      total: prescriptions.length,
      active,
      used,
      expired,
    },
    prescriptions,
    dispenseRecords,
  };
}

export async function issuePrescriptionForPatient(input: {
  patientAddress: string;
  treatment: string;
  dosage: string;
  notes?: string;
  durationDays: number;
  totalQuantity?: number;
  doctorEmail?: string;
}) {
  const treatment = input.treatment.trim();
  const dosage = input.dosage.trim();
  const notes = (input.notes ?? '').trim();

  if (!input.patientAddress || !treatment || !dosage) {
    throw new Error('Faltan datos clinicos para emitir la receta.');
  }

  if (!Number.isFinite(input.durationDays) || input.durationDays < 1) {
    throw new Error('La vigencia de la receta debe ser de al menos 1 dia.');
  }
  const totalQuantity = Math.floor(input.totalQuantity ?? 30);
  if (!Number.isFinite(totalQuantity) || totalQuantity < 1) {
    throw new Error('La cantidad total autorizada debe ser mayor o igual a 1.');
  }

  let doctorKeypair: StellarSdk.Keypair;
  if (input.doctorEmail) {
    doctorKeypair = getDeterministicKeypair(input.doctorEmail);
  } else {
    const doctorSecret = getDoctorSecret();
    if (!doctorSecret) {
      throw new Error(
        'Falta STELLAR_DOCTOR_SECRET para emitir recetas reales desde el POV médico.',
      );
    }
    doctorKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
  }

  const server = getSorobanServer();
  const doctorAddress = doctorKeypair.publicKey();
  const sourceAccount = await server.getAccount(doctorAddress);
  const contract = new StellarSdk.Contract(getPrescriptionContractId());

  const payload = {
    patient: input.patientAddress,
    treatment,
    dosage,
    notes,
    durationDays: input.durationDays,
    totalQuantity,
    network: 'testnet',
  };
  const medicationHashHex = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  const medicationHashBytes = Buffer.from(medicationHashHex, 'hex');
  const scArgs = [
    addressToScVal(doctorAddress),
    addressToScVal(input.patientAddress),
    bytes32ToScVal(medicationHashBytes),
    u64ToScVal(BigInt(Math.floor(input.durationDays)) * 24n * 60n * 60n),
    u64ToScVal(BigInt(totalQuantity)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('issue_prescription', ...scArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  transaction.sign(doctorKeypair);

  const txToSubmit = sponsorTransactionIfNeeded(transaction);
  const sendResult = await server.sendTransaction(txToSubmit);
  const txHash = sendResult.hash;
  if (!txHash) {
    throw new Error('La red no devolvió hash para la emisión de la receta.');
  }

  const completed = await waitForTransaction(server, txHash);
  if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error('La emisión de la receta no llegó a estado SUCCESS en testnet.');
  }

  const issuedId = completed.returnValue
    ? Number(StellarSdk.scValToBigInt(completed.returnValue))
    : null;

  // STEP 4: Acuñación de Recetas como NFT en Stellar (Claimable Balances & Clawback)
  if (issuedId !== null) {
    const assetCode = `RX${issuedId}`;
    const nftAsset = new StellarSdk.Asset(assetCode, doctorAddress);
    const horizonUrl = getRpcUrl().includes('testnet')
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';
    const serverHorizon = new StellarSdk.Horizon.Server(horizonUrl);

    try {
      console.log(`[NFT Mint] Iniciar acuñación NFT ${assetCode}...`);
      const doctorAccountResp = await serverHorizon.loadAccount(doctorAddress);
      const txBuilder = new StellarSdk.TransactionBuilder(doctorAccountResp, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: getNetworkPassphrase(),
      });

      // Habilitar clawback y revocable si no están activos (Stellar requiere ambos para poder usar Clawback)
      if (!doctorAccountResp.flags.auth_clawback_enabled || !(doctorAccountResp.flags as any).auth_revocable) {
        console.log(`[NFT Mint] Activando flags AUTH_CLAWBACK_ENABLED y AUTH_REVOCABLE_ENABLED en cuenta del médico...`);
        txBuilder.addOperation(
          StellarSdk.Operation.setOptions({
            setFlags: (2 | 8) as any, // 2 = AuthRevocableFlag, 8 = AuthClawbackEnabledFlag
          })
        );
      }

      // Crear Claimable Balance con el hash SHA-256 en el memo (con Expiración Absoluta y Doble Reclamante)
      const expiresAtUnix = Math.floor(Date.now() / 1000) + Math.floor(input.durationDays) * 24 * 60 * 60;
      txBuilder.addOperation(
        StellarSdk.Operation.createClaimableBalance({
          asset: nftAsset,
          amount: '1.0000000',
          claimants: [
            new StellarSdk.Claimant(
              input.patientAddress,
              StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(expiresAtUnix))
            ),
            new StellarSdk.Claimant(
              doctorAddress,
              StellarSdk.Claimant.predicateNot(
                StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(expiresAtUnix))
              )
            ),
          ],
        })
      );

      const classicTx = txBuilder
        .addMemo(StellarSdk.Memo.hash(Buffer.from(medicationHashHex, 'hex')))
        .setTimeout(30)
        .build();

      classicTx.sign(doctorKeypair);
      const txToSubmit = sponsorTransactionIfNeeded(classicTx);
      const submitResult = await serverHorizon.submitTransaction(txToSubmit);
      console.log(`[NFT Mint] ¡Claimable Balance del NFT ${assetCode} creado con éxito! Hash: ${submitResult.hash}`);
    } catch (nftError: any) {
      console.error("[NFT Mint] Error al crear Claimable Balance en Stellar:", nftError.message);
      if (nftError.response && nftError.response.data) {
        console.error("[NFT Mint] Detalle del error de Horizon:", JSON.stringify(nftError.response.data, null, 2));
      }
    }
  }

  const dashboard = await getPatientDashboard(input.patientAddress);

  return {
    txHash,
    issuedId,
    doctorAddress,
    medicationHash: medicationHashHex,
    totalQuantity,
    dashboard,
  };
}

export async function buildRetainPrescriptionTx(input: {
  dispensaryAddress: string;
  prescriptionId: number;
}) {
  const dispensaryAddress = input.dispensaryAddress.trim();
  const prescriptionId = Math.floor(input.prescriptionId);

  if (!dispensaryAddress || !Number.isFinite(prescriptionId) || prescriptionId < 0) {
    throw new Error('Faltan parámetros válidos para construir la retención.');
  }

  const server = getSorobanServer();
  const sourceAccount = await server.getAccount(dispensaryAddress);
  const contract = new StellarSdk.Contract(getPrescriptionContractId());

  const scArgs = [
    addressToScVal(dispensaryAddress),
    u64ToScVal(BigInt(prescriptionId)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('retain_prescription', ...scArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  const xdr = transaction.toXDR();

  return {
    xdr,
  };
}

export async function buildReleasePrescriptionTx(input: {
  callerAddress: string;
  prescriptionId: number;
}) {
  const callerAddress = input.callerAddress.trim();
  const prescriptionId = Math.floor(input.prescriptionId);

  if (!callerAddress || !Number.isFinite(prescriptionId) || prescriptionId < 0) {
    throw new Error('Faltan parámetros válidos para construir la liberación.');
  }

  const server = getSorobanServer();
  const sourceAccount = await server.getAccount(callerAddress);
  const contract = new StellarSdk.Contract(getPrescriptionContractId());

  const scArgs = [
    addressToScVal(callerAddress),
    u64ToScVal(BigInt(prescriptionId)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('release_prescription', ...scArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  const xdr = transaction.toXDR();

  return {
    xdr,
  };
}

export async function retainPrescriptionForDispensary(input: {
  prescriptionId: number;
  dispensaryAddress: string;
  dispensaryEmail?: string;
  lockPeriodDays?: number;
  doctorEmail?: string;
}) {
  const prescriptionId = Math.floor(input.prescriptionId);
  const dispensaryAddress = input.dispensaryAddress.trim();

  if (!Number.isFinite(prescriptionId) || prescriptionId < 0) {
    throw new Error('prescriptionId debe ser un número válido.');
  }

  let dispensaryKeypair: StellarSdk.Keypair;
  if (input.dispensaryEmail) {
    dispensaryKeypair = getDeterministicKeypair(input.dispensaryEmail);
  } else {
    const dispensarySecret = getDispensarySecret();
    if (!dispensarySecret) {
      throw new Error('Falta la credencial del dispensario para firmar la retención en el servidor.');
    }
    dispensaryKeypair = StellarSdk.Keypair.fromSecret(dispensarySecret);
  }

  const server = getSorobanServer();
  const sourceAccount = await server.getAccount(dispensaryAddress);
  const contract = new StellarSdk.Contract(getPrescriptionContractId());

  const scArgs = [
    addressToScVal(dispensaryAddress),
    u64ToScVal(BigInt(prescriptionId)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('retain_prescription', ...scArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  transaction.sign(dispensaryKeypair);

  const txToSubmit = sponsorTransactionIfNeeded(transaction);
  const sendResult = await server.sendTransaction(txToSubmit);
  const txHash = sendResult.hash;
  if (!txHash) {
    throw new Error('La red no devolvió hash para la retención.');
  }

  const completed = await waitForTransaction(server, txHash);
  if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error('La retención no llegó a estado SUCCESS en testnet.');
  }

  return {
    txHash,
    prescriptionId,
    dispensaryAddress,
    status: 'retained',
  };
}

export async function releasePrescriptionToPatient(input: {
  prescriptionId: number;
  doctorEmail?: string;
  dispensaryEmail?: string;
  dispensaryAddress?: string;
}) {
  const prescriptionId = Math.floor(input.prescriptionId);

  if (!Number.isFinite(prescriptionId) || prescriptionId < 0) {
    throw new Error('prescriptionId debe ser un número válido.');
  }

  const server = getSorobanServer();
  const prescription = await invokeReadonlyContract(
    server,
    getPrescriptionContractId(),
    'get_prescription',
    { id: BigInt(prescriptionId) },
  );

  const patientAddress = String(prescription.patient);
  const doctorAddress = String(prescription.doctor);

  let callerKeypair: StellarSdk.Keypair;
  let callerAddress: string;

  if (input.dispensaryEmail) {
    callerKeypair = getDeterministicKeypair(input.dispensaryEmail);
    callerAddress = callerKeypair.publicKey();
  } else if (input.dispensaryAddress) {
    callerAddress = input.dispensaryAddress;
    const dispensarySecret = getDispensarySecret();
    if (!dispensarySecret) {
      throw new Error('Falta la credencial del dispensario para liberar la receta.');
    }
    callerKeypair = StellarSdk.Keypair.fromSecret(dispensarySecret);
  } else if (input.doctorEmail) {
    callerKeypair = getDeterministicKeypair(input.doctorEmail);
    callerAddress = callerKeypair.publicKey();
  } else {
    const doctorSecret = getDoctorSecret();
    if (!doctorSecret) {
      throw new Error('Falta la credencial del médico para liberar la receta.');
    }
    callerKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
    callerAddress = callerKeypair.publicKey();
  }

  const sourceAccount = await server.getAccount(callerAddress);
  const contract = new StellarSdk.Contract(getPrescriptionContractId());

  const scArgs = [
    addressToScVal(callerAddress),
    u64ToScVal(BigInt(prescriptionId)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('release_prescription', ...scArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  transaction.sign(callerKeypair);

  const txToSubmit = sponsorTransactionIfNeeded(transaction);
  const sendResult = await server.sendTransaction(txToSubmit);
  const txHash = sendResult.hash;
  if (!txHash) {
    throw new Error('La red no devolvió hash para la liberación.');
  }

  const completed = await waitForTransaction(server, txHash);
  if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error('La liberación no llegó a estado SUCCESS en testnet.');
  }

  return {
    txHash,
    prescriptionId,
    patientAddress,
    status: 'released',
  };
}

export async function dispensePrescriptionForPatient(input: {
  prescriptionId: number;
  productLabel: string;
  batchLabel: string;
  quantity: number;
  dispensaryEmail?: string;
  doctorEmail?: string;
}) {
  const productLabel = input.productLabel.trim();
  const batchLabel = input.batchLabel.trim();
  const quantity = Math.floor(input.quantity);

  if (!Number.isFinite(input.prescriptionId) || input.prescriptionId < 0) {
    throw new Error('prescriptionId debe ser un numero valido.');
  }

  if (!productLabel || !batchLabel) {
    throw new Error('Faltan datos de producto o lote para registrar la dispensacion.');
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('quantity debe ser un numero mayor o igual a 1.');
  }

  let dispensaryKeypair: StellarSdk.Keypair;
  if (input.dispensaryEmail) {
    dispensaryKeypair = getDeterministicKeypair(input.dispensaryEmail);
  } else {
    const dispensarySecret = getDispensarySecret();
    if (!dispensarySecret) {
      throw new Error(
        'Falta STELLAR_DISPENSARY_SECRET para dispensar recetas reales desde el POV dispensario.',
      );
    }
    dispensaryKeypair = StellarSdk.Keypair.fromSecret(dispensarySecret);
  }

  const server = getSorobanServer();
  const dispensaryAddress = dispensaryKeypair.publicKey();
  const dispenseRecordContract = new StellarSdk.Contract(getDispenseRecordContractId());
  const prescriptionId = Math.floor(input.prescriptionId);

  const prescription = await invokeReadonlyContract(
    server,
    getPrescriptionContractId(),
    'get_prescription',
    { id: BigInt(prescriptionId) },
  );

  // STEP 5: Verificar que el paciente (o el dispensario en caso de retencion) posee el Token NFT RX[ID_PRESCRIPTION]
  const patientAddress = String(prescription.patient);
  const assetCode = `RX${prescriptionId}`;
  const horizonUrl = getRpcUrl().includes('testnet')
    ? 'https://horizon-testnet.stellar.org'
    : 'https://horizon.stellar.org';
  const serverHorizon = new StellarSdk.Horizon.Server(horizonUrl);

  let hasNFT = false;
  let claimableBalanceId = '';
  try {
    // 1. Verificacion estandar (Paciente)
    const patientAccount = await serverHorizon.loadAccount(patientAddress);
    const hasAssetInWallet = patientAccount.balances.some(
      (b: any) => b.asset_code === assetCode && Number(b.balance) > 0
    );
    if (hasAssetInWallet) {
      hasNFT = true;
    } else {
      const claimableBalances = await serverHorizon
        .claimableBalances()
        .claimant(patientAddress)
        .asset(new StellarSdk.Asset(assetCode, String(prescription.doctor)))
        .call();
      if (claimableBalances.records.length > 0) {
        hasNFT = true;
        claimableBalanceId = claimableBalances.records[0].id;
      }
    }

    // 2. Verificacion alternativa (Retenido por el Dispensario)
    if (!hasNFT) {
      const dispensaryAccount = await serverHorizon.loadAccount(dispensaryAddress);
      const hasAssetInDispensaryWallet = dispensaryAccount.balances.some(
        (b: any) => b.asset_code === assetCode && Number(b.balance) > 0
      );
      if (hasAssetInDispensaryWallet) {
        hasNFT = true;
        console.log(`[NFT Check] Posesion confirmada: El dispensario posee el NFT de forma directa.`);
      } else {
        const claimableBalancesDisp = await serverHorizon
          .claimableBalances()
          .claimant(dispensaryAddress)
          .asset(new StellarSdk.Asset(assetCode, String(prescription.doctor)))
          .call();
        if (claimableBalancesDisp.records.length > 0) {
          hasNFT = true;
          claimableBalanceId = claimableBalancesDisp.records[0].id;
          console.log(`[NFT Check] Posesion confirmada: El dispensario posee el NFT como Claimable Balance.`);
        }
      }
    }
  } catch (err) {
    console.error(`[NFT Check] Error verificando posesión del NFT en Horizon:`, err);
    // Fallback permisivo en testnet
    hasNFT = true;
  }

  if (!hasNFT) {
    throw new Error(`Acceso denegado: El paciente no posee el token de la receta ${assetCode} en testnet.`);
  }

  const productHashHex = createHash('sha256')
    .update(JSON.stringify({ productLabel, network: 'testnet' }))
    .digest('hex');
  const batchHashHex = createHash('sha256')
    .update(JSON.stringify({ batchLabel, prescriptionId, network: 'testnet' }))
    .digest('hex');

  const recordArgs = [
    addressToScVal(dispensaryAddress),
    u64ToScVal(BigInt(prescriptionId)),
    bytes32ToScVal(Buffer.from(productHashHex, 'hex')),
    bytes32ToScVal(Buffer.from(batchHashHex, 'hex')),
    u64ToScVal(BigInt(quantity)),
  ];

  const recordResult = await submitSingleContractCall(
    server,
    dispensaryKeypair,
    dispenseRecordContract,
    'record_dispense',
    recordArgs,
  );
  const recordId = recordResult.returnValue
    ? Number(StellarSdk.scValToBigInt(recordResult.returnValue))
    : null;

  const record = await invokeReadonlyContractWithSpec(
    server,
    getDispenseRecordContractId(),
    'get_last_record_for_prescription',
    { prescription_id: BigInt(prescriptionId) },
  );
  const dashboard = await getPatientDashboard(patientAddress);

  // STEP 6: Quema del NFT (Clawback) de forma dual en Horizon - SOLO SI SE AGOTÓ LA RECETA
  let clawbackTxHash: string | undefined = undefined;
  let isFullyUsed = true;
  let remainingQuantity = 0;
  let totalQuantity = 0;
  try {
    const updatedPrescription = await invokeReadonlyContract(
      server,
      getPrescriptionContractId(),
      'get_prescription',
      { id: BigInt(prescriptionId) },
    );
    isFullyUsed = Boolean(updatedPrescription.is_used);
    totalQuantity = Number(updatedPrescription.total_quantity);
    remainingQuantity = totalQuantity - Number(updatedPrescription.dispensed_quantity);
  } catch (err) {
    console.error(`[NFT Burn] Error al leer receta actualizada de Soroban:`, err);
  }

  if (isFullyUsed) {
    try {
      let doctorKeypair: StellarSdk.Keypair;
      if (input.doctorEmail) {
        doctorKeypair = getDeterministicKeypair(input.doctorEmail);
      } else {
        const doctorSecret = getDoctorSecret();
        if (doctorSecret) {
          doctorKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
        } else {
          throw new Error('Falta STELLAR_DOCTOR_SECRET para quemar el NFT de la receta.');
        }
      }
      console.log(`[NFT Burn] Receta completamente consumida. Preparando transacción clásica de quema para el asset ${assetCode}...`);
      const doctorAddress = doctorKeypair.publicKey();
      const doctorAccountResp = await serverHorizon.loadAccount(doctorAddress);
        
        const nftAsset = new StellarSdk.Asset(assetCode, doctorAddress);
        const clawbackBuilder = new StellarSdk.TransactionBuilder(doctorAccountResp, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: getNetworkPassphrase(),
        });

        if (claimableBalanceId) {
          console.log(`[NFT Burn] Ejecutando clawbackClaimableBalance para el balance ${claimableBalanceId}...`);
          clawbackBuilder.addOperation(
            StellarSdk.Operation.clawbackClaimableBalance({
              balanceId: claimableBalanceId,
            })
          );
        } else {
          console.log(`[NFT Burn] Ejecutando clawback de balance en la wallet del paciente ${patientAddress}...`);
          clawbackBuilder.addOperation(
            StellarSdk.Operation.clawback({
              from: patientAddress,
              asset: nftAsset,
              amount: '1.0000000',
            })
          );
        }

        const clawbackTx = clawbackBuilder.setTimeout(30).build();
        clawbackTx.sign(doctorKeypair);
        const txToSubmit = sponsorTransactionIfNeeded(clawbackTx);
        const clawbackResult = await serverHorizon.submitTransaction(txToSubmit);
        clawbackTxHash = clawbackResult.hash;
        console.log(`[NFT Burn] Receta NFT ${assetCode} quemada (Clawback exitoso): ${clawbackTxHash}`);
    } catch (burnErr) {
      console.error(`[NFT Burn] Error al ejecutar Clawback del NFT de receta:`, burnErr);
    }
  } else {
    console.log(`[NFT Burn] Receta parcialmente consumida (restante: ${remainingQuantity}/${totalQuantity}). El paciente conserva su NFT para futuros retiros.`);
  }

  return {
    txHash: recordResult.txHash,
    recordTxHash: recordResult.txHash,
    recordId: record ? Number(record.id) : recordId,
    prescriptionId,
    patientAddress,
    dispensaryAddress,
    productHash: productHashHex,
    batchHash: batchHashHex,
    dispenseMode: 'partial_allowance',
    dashboard,
    clawbackTxHash,
  };
}

export async function validatePrescriptionForDispensary(input: {
  prescriptionId: number;
}) {
  const prescriptionId = Math.floor(input.prescriptionId);

  if (!Number.isFinite(prescriptionId) || prescriptionId < 0) {
    throw new Error('prescriptionId debe ser un numero valido.');
  }

  const server = getSorobanServer();
  const latestLedger = await server.getLatestLedger();
  const prescription = await invokeReadonlyContract(
    server,
    getPrescriptionContractId(),
    'get_prescription',
    { id: BigInt(prescriptionId) },
  );
  const normalized = normalizePrescriptionSnapshot(prescription);

  let lastRecord = null;
  try {
    const record = await invokeReadonlyContractWithSpec(
      server,
      getDispenseRecordContractId(),
      'get_last_record_for_prescription',
      { prescription_id: BigInt(prescriptionId) },
    );

    if (record) {
      lastRecord = {
        id: Number(record.id),
        prescriptionId: Number(record.prescription_id),
        patient: String(record.patient),
        doctor: String(record.doctor),
        dispensary: String(record.dispensary),
        quantity: Number(record.quantity),
        productHash: bufferLikeToHex(record.product_hash),
        batchHash: bufferLikeToHex(record.batch_hash),
        dispensedAt: Number(record.dispensed_at),
      };
    }
  } catch {
    lastRecord = null;
  }

  let retainedBy = normalized.retainedBy || null;
  let status = normalized.status;
  if (retainedBy && status === 'active') {
    status = 'retained' as any;
  }

  const updatedPrescription = {
    ...normalized,
    status,
    retainedBy,
  };

  return {
    network: 'Stellar Testnet',
    latestLedger: latestLedger.sequence,
    prescriptionContractId: getPrescriptionContractId(),
    dispenseRecordContractId: getDispenseRecordContractId(),
    prescription: updatedPrescription,
    validation: {
      canDispense: updatedPrescription.status === 'active' || updatedPrescription.status === 'retained',
      reason:
        updatedPrescription.status === 'active'
          ? 'Receta vigente con saldo disponible.'
          : updatedPrescription.status === 'retained'
            ? `Receta retenida en custodia digital por el dispensario: ${retainedBy}`
            : updatedPrescription.status === 'expired'
              ? 'La receta expiro y requiere nueva evaluacion medica.'
              : 'La receta ya no tiene saldo disponible.',
      visibleToDispensary: [
        'estado',
        'vigencia',
        'saldo',
        'formatos autorizados',
        'hash clinico',
      ],
      hiddenFromDispensary: [
        'diagnostico',
        'notas clinicas completas',
        'expediente privado',
      ],
    },
    lastRecord,
  };
}

async function getPatientPrescriptions(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  contractId: string,
  patientAddress: string,
  latestLedger: number,
) {
  const topic = StellarSdk.nativeToScVal('PrescriptionIssued').toXDR('base64');

  const page = await server.getEvents({
    startLedger: Math.max(1, latestLedger - 10_000),
    filters: [
      {
        type: 'contract',
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
        'get_prescription',
        { id: BigInt(event.id) },
      );

      const record = normalizePrescriptionRecord(onchain, event);
      
      let retainedBy = record.retainedBy || null;
      let status = record.status;
      if (retainedBy && status === 'active') {
        status = 'retained' as any;
      }

      return {
        ...record,
        status,
        retainedBy,
      };
    }),
  );

  return prescriptions.sort((a, b) => b.id - a.id);
}

async function getPatientDispenseRecords(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  contractId: string,
  patientAddress: string,
  latestLedger: number,
) {
  const topic = StellarSdk.nativeToScVal('DispenseRecorded').toXDR('base64');

  const page = await server.getEvents({
    startLedger: Math.max(1, latestLedger - 10_000),
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
        topics: [[topic]],
      },
    ],
    limit: 100,
  });

  const recorded = page.events
    .map((event) => decodeDispenseRecordedEvent(event))
    .filter(
      (event): event is NonNullable<typeof event> =>
        Boolean(event) && event.patient === patientAddress,
    );

  const records = await Promise.all(
    recorded.map(async (event) => {
      const onchain = await invokeReadonlyContractWithSpec(
        server,
        contractId,
        'get_record',
        { id: BigInt(event.id) },
      );

      return normalizeDispenseRecord(onchain, event);
    }),
  );

  return records.sort((a, b) => b.id - a.id);
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

function decodeDispenseRecordedEvent(
  event: StellarSdk.rpc.Api.EventResponse,
) {
  const values = event.value.vec();
  if (!values || values.length < 4) {
    return null;
  }

  return {
    id: Number(StellarSdk.scValToBigInt(values[0])),
    prescriptionId: Number(StellarSdk.scValToBigInt(values[1])),
    patient: StellarSdk.Address.fromScVal(values[2]).toString(),
    dispensary: StellarSdk.Address.fromScVal(values[3]).toString(),
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
  return invokeReadonlyContractWithSpec(server, contractId, method, args);
}

async function invokeReadonlyContractWithSpec(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
) {
  const sourceAccount = await server.getAccount(getReadonlyAccountId());
  const contract = new StellarSdk.Contract(contractId);
  const scArgs = buildContractArgs(method, args);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (StellarSdk.rpc.Api.isSimulationError(simulation) || !simulation.result) {
    throw new Error(`La simulación del contrato ${method} falló en testnet.`);
  }

  return decodeContractResult(method, simulation.result.retval);
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
  const totalQuantity = Number(onchain.total_quantity ?? 1);
  const dispensedQuantity = Number(onchain.dispensed_quantity ?? (onchain.is_used ? totalQuantity : 0));
  const remainingQuantity = Math.max(totalQuantity - dispensedQuantity, 0);
  const isUsed = Boolean(onchain.is_used) || remainingQuantity <= 0;
  const now = Math.floor(Date.now() / 1000);
  const status = isUsed ? 'used' : expiresAt <= now ? 'expired' : 'active';
  const retainedBy = onchain.retained_by ? String(onchain.retained_by) : null;

  return {
    id: Number(onchain.id),
    patient: String(onchain.patient),
    doctor: String(onchain.doctor),
    medicationHash: bufferLikeToHex(onchain.medication_hash),
    expiresAt,
    totalQuantity,
    dispensedQuantity,
    remainingQuantity,
    isUsed,
    status,
    issuedAt: event.ledgerClosedAt,
    issuedLedger: event.ledger,
    txHash: event.txHash,
    retainedBy,
  };
}

function normalizePrescriptionSnapshot(onchain: any) {
  const expiresAt = Number(onchain.expires_at);
  const totalQuantity = Number(onchain.total_quantity ?? 1);
  const dispensedQuantity = Number(
    onchain.dispensed_quantity ?? (onchain.is_used ? totalQuantity : 0),
  );
  const remainingQuantity = Math.max(totalQuantity - dispensedQuantity, 0);
  const isUsed = Boolean(onchain.is_used) || remainingQuantity <= 0;
  const now = Math.floor(Date.now() / 1000);
  const status = isUsed ? 'used' : expiresAt <= now ? 'expired' : 'active';
  const retainedBy = onchain.retained_by ? String(onchain.retained_by) : null;

  return {
    id: Number(onchain.id),
    patient: String(onchain.patient),
    doctor: String(onchain.doctor),
    medicationHash: bufferLikeToHex(onchain.medication_hash),
    expiresAt,
    totalQuantity,
    dispensedQuantity,
    remainingQuantity,
    isUsed,
    status,
    retainedBy,
  };
}

function normalizeDispenseRecord(
  onchain: any,
  event: {
    id: number;
    prescriptionId: number;
    patient: string;
    dispensary: string;
    ledger: number;
    ledgerClosedAt: string;
    txHash: string;
  },
) {
  return {
    id: Number(onchain.id),
    prescriptionId: Number(onchain.prescription_id),
    patient: String(onchain.patient),
    doctor: String(onchain.doctor),
    dispensary: String(onchain.dispensary),
    productHash: bufferLikeToHex(onchain.product_hash),
    batchHash: bufferLikeToHex(onchain.batch_hash),
    quantity: Number(onchain.quantity),
    dispensedAt: Number(onchain.dispensed_at),
    recordedAt: event.ledgerClosedAt,
    recordedLedger: event.ledger,
    txHash: event.txHash,
  };
}

function bufferLikeToHex(value: unknown) {
  if (Buffer.isBuffer(value)) {
    return value.toString('hex');
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex');
  }

  if (Array.isArray(value)) {
    return Buffer.from(value).toString('hex');
  }

  return String(value);
}

function buildContractArgs(method: string, args: Record<string, unknown>) {
  switch (method) {
    case 'get_prescription':
    case 'get_record':
      return [u64ToScVal(BigInt(args.id as bigint | number | string))];
    case 'get_last_record_for_prescription':
      return [u64ToScVal(BigInt(args.prescription_id as bigint | number | string))];
    default:
      throw new Error(`Metodo de contrato no soportado por el codificador manual: ${method}`);
  }
}

function decodeContractResult(method: string, value: StellarSdk.xdr.ScVal) {
  const native = StellarSdk.scValToNative(value);

  if (method === 'get_last_record_for_prescription' && native === undefined) {
    return null;
  }

  return native;
}

function addressToScVal(address: string) {
  return StellarSdk.Address.fromString(address).toScVal();
}

function u64ToScVal(value: bigint) {
  return StellarSdk.nativeToScVal(value, { type: 'u64' });
}

function bytes32ToScVal(value: Buffer) {
  if (value.length !== 32) {
    throw new Error('Se esperaba un hash de 32 bytes para Soroban.');
  }

  return StellarSdk.nativeToScVal(value, { type: 'bytes' });
}

function sponsorTransactionIfNeeded(
  transaction: StellarSdk.Transaction
): StellarSdk.Transaction | StellarSdk.FeeBumpTransaction {
  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    return transaction;
  }

  const sponsorKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  const sponsorPublicKey = sponsorKeypair.publicKey();

  if (transaction.source === sponsorPublicKey) {
    return transaction;
  }

  console.log(
    `[Fee Sponsor] Patrocinando transacción de forma nativa desde la cuenta: ${sponsorPublicKey}`
  );

  const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    sponsorPublicKey,
    StellarSdk.BASE_FEE,
    transaction,
    getNetworkPassphrase()
  );

  feeBumpTx.sign(sponsorKeypair);
  return feeBumpTx;
}

async function submitSingleContractCall(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  signer: StellarSdk.Keypair,
  contract: StellarSdk.Contract,
  method: string,
  args: StellarSdk.xdr.ScVal[],
) {
  const sourceAccount = await server.getAccount(signer.publicKey());
  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  transaction.sign(signer);

  const txToSubmit = sponsorTransactionIfNeeded(transaction);
  const sendResult = await server.sendTransaction(txToSubmit);
  const txHash = sendResult.hash;
  if (!txHash) {
    throw new Error(`La red no devolvio hash para ${method}.`);
  }

  const completed = await waitForTransaction(server, txHash);
  if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`${method} no llego a estado SUCCESS en testnet.`);
  }

  return {
    txHash,
    returnValue: completed.returnValue,
  };
}

async function waitForTransaction(
  server: InstanceType<typeof StellarSdk.rpc.Server>,
  txHash: string,
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await server.getTransaction(txHash);
    if (result.status !== StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return result;
    }

    await sleep(1500);
  }

  throw new Error('La transacción no terminó de indexarse a tiempo en Soroban RPC.');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function buildIssuePrescriptionTx(input: {
  doctorAddress: string;
  patientAddress: string;
  treatment: string;
  dosage: string;
  notes?: string;
  durationDays: number;
  totalQuantity?: number;
}) {
  const doctorAddress = input.doctorAddress.trim();
  const patientAddress = input.patientAddress.trim();
  const treatment = input.treatment.trim();
  const dosage = input.dosage.trim();
  const notes = (input.notes ?? '').trim();

  if (!doctorAddress || !patientAddress || !treatment || !dosage) {
    throw new Error('Faltan datos clínicos para emitir la receta.');
  }

  if (!Number.isFinite(input.durationDays) || input.durationDays < 1) {
    throw new Error('La vigencia de la receta debe ser de al menos 1 día.');
  }
  const totalQuantity = Math.floor(input.totalQuantity ?? 30);
  if (!Number.isFinite(totalQuantity) || totalQuantity < 1) {
    throw new Error('La cantidad total autorizada debe ser mayor o igual a 1.');
  }

  const server = getSorobanServer();
  const sourceAccount = await server.getAccount(doctorAddress);
  const contract = new StellarSdk.Contract(getPrescriptionContractId());

  const payload = {
    patient: patientAddress,
    treatment,
    dosage,
    notes,
    durationDays: input.durationDays,
    totalQuantity,
    network: 'testnet',
  };
  const medicationHashHex = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  const medicationHashBytes = Buffer.from(medicationHashHex, 'hex');

  const scArgs = [
    addressToScVal(doctorAddress),
    addressToScVal(patientAddress),
    bytes32ToScVal(medicationHashBytes),
    u64ToScVal(BigInt(Math.floor(input.durationDays)) * 24n * 60n * 60n),
    u64ToScVal(BigInt(totalQuantity)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('issue_prescription', ...scArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  const xdr = transaction.toXDR();

  return {
    xdr,
    medicationHash: medicationHashHex,
    totalQuantity,
  };
}

export async function buildDispensePrescriptionTx(input: {
  dispensaryAddress: string;
  prescriptionId: number;
  productLabel: string;
  batchLabel: string;
  quantity: number;
}) {
  const dispensaryAddress = input.dispensaryAddress.trim();
  const productLabel = input.productLabel.trim();
  const batchLabel = input.batchLabel.trim();
  const quantity = Math.floor(input.quantity);
  const prescriptionId = Math.floor(input.prescriptionId);

  if (!dispensaryAddress || !productLabel || !batchLabel) {
    throw new Error('Faltan datos de producto, lote o dispensario.');
  }

  if (!Number.isFinite(prescriptionId) || prescriptionId < 0) {
    throw new Error('prescriptionId debe ser un número válido.');
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('quantity debe ser un número mayor o igual a 1.');
  }

  const server = getSorobanServer();
  const sourceAccount = await server.getAccount(dispensaryAddress);
  const dispenseRecordContract = new StellarSdk.Contract(getDispenseRecordContractId());

  const productHashHex = createHash('sha256')
    .update(JSON.stringify({ productLabel, network: 'testnet' }))
    .digest('hex');
  const batchHashHex = createHash('sha256')
    .update(JSON.stringify({ batchLabel, prescriptionId, network: 'testnet' }))
    .digest('hex');

  const recordArgs = [
    addressToScVal(dispensaryAddress),
    u64ToScVal(BigInt(prescriptionId)),
    bytes32ToScVal(Buffer.from(productHashHex, 'hex')),
    bytes32ToScVal(Buffer.from(batchHashHex, 'hex')),
    u64ToScVal(BigInt(quantity)),
  ];

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(dispenseRecordContract.call('record_dispense', ...recordArgs))
    .setTimeout(30)
    .build();

  transaction = await server.prepareTransaction(transaction);
  const xdr = transaction.toXDR();

  return {
    xdr,
  };
}

export async function submitSignedTransaction(input: {
  xdr: string;
  operationType: 'issue' | 'dispense' | 'retain' | 'release';
  patientAddress?: string;
  medicationHash?: string;
  totalQuantity?: number;
  prescriptionId?: number;
  durationDays?: number;
}) {
  const server = getSorobanServer();
  const parsedTx = StellarSdk.TransactionBuilder.fromXDR(input.xdr, getNetworkPassphrase());
  let txToSubmit = parsedTx;

  if (parsedTx instanceof StellarSdk.Transaction) {
    txToSubmit = sponsorTransactionIfNeeded(parsedTx);
  }

  const sendResult = await server.sendTransaction(txToSubmit);
  const txHash = sendResult.hash;
  if (!txHash) {
    throw new Error('La red no devolvió hash para la transacción firmada.');
  }

  const completed = await waitForTransaction(server, txHash);
  if (completed.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error('La transacción no llegó a estado SUCCESS en testnet.');
  }

  const returnValue = completed.returnValue;

  let issuedId: number | null = null;
  let recordId: number | null = null;
  let clawbackTxHash: string | undefined = undefined;

  if (input.operationType === 'issue' && input.patientAddress && input.medicationHash) {
    issuedId = returnValue ? Number(StellarSdk.scValToBigInt(returnValue)) : null;
    if (issuedId !== null) {
      const assetCode = `RX${issuedId}`;
      const doctorSecret = getDoctorSecret();
      const doctorKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
      const doctorAddress = doctorKeypair.publicKey();
      const nftAsset = new StellarSdk.Asset(assetCode, doctorAddress);
      const horizonUrl = getRpcUrl().includes('testnet')
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org';
      const serverHorizon = new StellarSdk.Horizon.Server(horizonUrl);

      try {
        console.log(`[NFT Mint] Iniciar acuñación NFT ${assetCode}...`);
        const doctorAccountResp = await serverHorizon.loadAccount(doctorAddress);
        const txBuilder = new StellarSdk.TransactionBuilder(doctorAccountResp, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: getNetworkPassphrase(),
        });

        if (!doctorAccountResp.flags.auth_clawback_enabled || !(doctorAccountResp.flags as any).auth_revocable) {
          console.log(`[NFT Mint] Activando flags en cuenta médico...`);
          txBuilder.addOperation(
            StellarSdk.Operation.setOptions({
              setFlags: (2 | 8) as any,
            })
          );
        }

        const durationDays = input.durationDays || 30;
        const expiresAtUnix = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;
        txBuilder.addOperation(
          StellarSdk.Operation.createClaimableBalance({
            asset: nftAsset,
            amount: '1.0000000',
            claimants: [
              new StellarSdk.Claimant(
                input.patientAddress,
                StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(expiresAtUnix))
              ),
              new StellarSdk.Claimant(
                doctorAddress,
                StellarSdk.Claimant.predicateNot(
                  StellarSdk.Claimant.predicateBeforeAbsoluteTime(String(expiresAtUnix))
                )
              ),
            ],
          })
        );

        const classicTx = txBuilder
          .addMemo(StellarSdk.Memo.hash(Buffer.from(input.medicationHash, 'hex')))
          .setTimeout(30)
          .build();

        classicTx.sign(doctorKeypair);
        const txToSubmit = sponsorTransactionIfNeeded(classicTx);
        const submitResult = await serverHorizon.submitTransaction(txToSubmit);
        console.log(`[NFT Mint] ¡Claimable Balance del NFT ${assetCode} creado! Hash: ${submitResult.hash}`);
      } catch (nftError: any) {
        console.error("[NFT Mint] Error al crear Claimable Balance en Stellar:", nftError.message);
      }
    }
  } else if (input.operationType === 'dispense' && input.prescriptionId !== undefined) {
    recordId = returnValue ? Number(StellarSdk.scValToBigInt(returnValue)) : null;
    const prescriptionId = input.prescriptionId;
    const assetCode = `RX${prescriptionId}`;
    
    let isFullyUsed = false;
    let patientAddress = '';
    let doctorAddress = '';
    try {
      const updatedPrescription = await invokeReadonlyContract(
        server,
        getPrescriptionContractId(),
        'get_prescription',
        { id: BigInt(prescriptionId) },
      );
      isFullyUsed = Boolean(updatedPrescription.is_used);
      patientAddress = String(updatedPrescription.patient);
      doctorAddress = String(updatedPrescription.doctor);
    } catch (err) {
      console.error(`[NFT Burn] Error al leer receta de Soroban para quema:`, err);
    }

    if (isFullyUsed && doctorAddress && patientAddress) {
      try {
        const doctorSecret = getDoctorSecret();
        if (doctorSecret) {
          console.log(`[NFT Burn] Receta completamente consumida. Preparando clawback de quema para el asset ${assetCode}...`);
          const doctorKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
          const serverHorizon = new StellarSdk.Horizon.Server(
            getRpcUrl().includes('testnet')
              ? 'https://horizon-testnet.stellar.org'
              : 'https://horizon.stellar.org'
          );
          const doctorAccountResp = await serverHorizon.loadAccount(doctorAddress);
          const nftAsset = new StellarSdk.Asset(assetCode, doctorAddress);
          const clawbackBuilder = new StellarSdk.TransactionBuilder(doctorAccountResp, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: getNetworkPassphrase(),
          });

          let claimableBalanceId = '';
          try {
            const claimableBalances = await serverHorizon
              .claimableBalances()
              .asset(nftAsset)
              .call();
            if (claimableBalances.records.length > 0) {
              claimableBalanceId = claimableBalances.records[0].id;
            }
          } catch (err) {
            console.error(`[NFT Burn] Error buscando balance para quema:`, err);
          }

          if (claimableBalanceId) {
            clawbackBuilder.addOperation(
              StellarSdk.Operation.clawbackClaimableBalance({
                balanceId: claimableBalanceId,
              })
            );
          } else {
            clawbackBuilder.addOperation(
              StellarSdk.Operation.clawback({
                from: patientAddress,
                asset: nftAsset,
                amount: '1.0000000',
              })
            );
          }

          const clawbackTx = clawbackBuilder.setTimeout(30).build();
          clawbackTx.sign(doctorKeypair);
          const txToSubmit = sponsorTransactionIfNeeded(clawbackTx);
          const clawbackResult = await serverHorizon.submitTransaction(txToSubmit);
          clawbackTxHash = clawbackResult.hash;
          console.log(`[NFT Burn] Receta NFT ${assetCode} quemada: ${clawbackTxHash}`);
        }
      } catch (burnErr) {
        console.error(`[NFT Burn] Error al ejecutar quema del NFT:`, burnErr);
      }
    }
  }

  const targetPatient = input.patientAddress || (input.prescriptionId ? await getPatientAddressForPrescription(input.prescriptionId!) : '');
  const dashboard = targetPatient ? await getPatientDashboard(targetPatient) : null;

  return {
    txHash,
    issuedId,
    recordId,
    clawbackTxHash,
    dashboard,
  };
}

async function getPatientAddressForPrescription(prescriptionId: number): Promise<string> {
  try {
    const server = getSorobanServer();
    const prescription = await invokeReadonlyContract(
      server,
      getPrescriptionContractId(),
      'get_prescription',
      { id: BigInt(prescriptionId) },
    );
    return String(prescription.patient);
  } catch {
    return '';
  }
}

