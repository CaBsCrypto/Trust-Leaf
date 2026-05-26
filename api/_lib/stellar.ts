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

  const doctorSecret = getDoctorSecret();
  if (!doctorSecret) {
    throw new Error(
      'Falta STELLAR_DOCTOR_SECRET para emitir recetas reales desde el POV médico.',
    );
  }

  const server = getSorobanServer();
  const doctorKeypair = StellarSdk.Keypair.fromSecret(doctorSecret);
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

  const sendResult = await server.sendTransaction(transaction);
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

export async function dispensePrescriptionForPatient(input: {
  prescriptionId: number;
  productLabel: string;
  batchLabel: string;
  quantity: number;
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

  const dispensarySecret = getDispensarySecret();
  if (!dispensarySecret) {
    throw new Error(
      'Falta STELLAR_DISPENSARY_SECRET para dispensar recetas reales desde el POV dispensario.',
    );
  }

  const server = getSorobanServer();
  const dispensaryKeypair = StellarSdk.Keypair.fromSecret(dispensarySecret);
  const dispensaryAddress = dispensaryKeypair.publicKey();
  const dispenseRecordContract = new StellarSdk.Contract(getDispenseRecordContractId());
  const prescriptionId = Math.floor(input.prescriptionId);

  const prescription = await invokeReadonlyContract(
    server,
    getPrescriptionContractId(),
    'get_prescription',
    { id: BigInt(prescriptionId) },
  );

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
  const patientAddress = String(prescription.patient);
  const dashboard = await getPatientDashboard(patientAddress);

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

  return {
    network: 'Stellar Testnet',
    latestLedger: latestLedger.sequence,
    prescriptionContractId: getPrescriptionContractId(),
    dispenseRecordContractId: getDispenseRecordContractId(),
    prescription: normalized,
    validation: {
      canDispense: normalized.status === 'active',
      reason:
        normalized.status === 'active'
          ? 'Receta vigente con saldo disponible.'
          : normalized.status === 'expired'
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

      return normalizePrescriptionRecord(onchain, event);
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

  const sendResult = await server.sendTransaction(transaction);
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
