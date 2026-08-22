import { createHash, randomBytes } from 'node:crypto';

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const TESTNET_RPC = 'https://soroban-testnet.stellar.org';

export type SimulatedSubmissionState = 'prepared' | 'submitted' | 'confirmed' | 'unknown' | 'failed';

export interface SimulatedTestnetConfig {
  network: 'testnet';
  passphrase: string;
  rpcUrl: string;
  contractId: string;
  contractWasmSha256: string;
  allowedContractIds: readonly string[];
  allowedWasmSha256: readonly string[];
  submissionEnabled: false;
}

export interface SimulatedReceiptAction {
  operationId: string;
  receiptHandle: string;
  expectedVersion: number;
  event: 'Issued' | 'Active' | 'Partial' | 'Dispensed' | 'Revoked' | 'Expired';
  commitment: string;
}

export interface SimulatedSubmission {
  operationId: string;
  payloadDigest: string;
  state: SimulatedSubmissionState;
  attemptCount: number;
  ledgerSequence?: number;
  errorCode?: string;
}

export interface SimulatedSecretStore {
  currentVersion(alias: string): number | null;
  signDigest(alias: string, expectedVersion: number, digest: string): string;
}

export function createSimulatedSecretStore(fixtures: Record<string, { version: number; material: string }>): SimulatedSecretStore {
  return {
    currentVersion(alias) { return fixtures[alias]?.version ?? null; },
    signDigest(alias, expectedVersion, digest) {
      const fixture = fixtures[alias];
      if (!fixture) throw safeError('SIMULATED_SECRET_MISSING');
      if (fixture.version !== expectedVersion) throw safeError('SIMULATED_SECRET_ROTATED');
      return createHash('sha256').update(`synthetic-signature:${fixture.material}:${digest}`).digest('hex');
    },
  };
}

export interface SimulatedTransportResult {
  state: 'submitted' | 'confirmed' | 'unknown' | 'failed';
  ledgerSequence?: number;
  errorCode?: string;
}

export interface SimulatedTestnetTransport {
  submit(envelope: { payloadDigest: string; signature: string }, timeoutMs: number): Promise<SimulatedTransportResult>;
  reconcile(payloadDigest: string, timeoutMs: number): Promise<SimulatedTransportResult>;
}

export function validateSimulatedTestnetConfig(config: SimulatedTestnetConfig): void {
  const hash = config.contractWasmSha256.toLowerCase();
  if (config.submissionEnabled !== false) throw safeError('REAL_SUBMISSION_FORBIDDEN');
  if (config.network !== 'testnet' || config.passphrase !== TESTNET_PASSPHRASE || config.rpcUrl !== TESTNET_RPC) {
    throw safeError('TESTNET_ALLOWLIST_REJECTED');
  }
  if (!/^C[A-Z2-7]{55}$/.test(config.contractId) || !config.allowedContractIds.includes(config.contractId)) {
    throw safeError('CONTRACT_ALLOWLIST_REJECTED');
  }
  if (!/^[a-f0-9]{64}$/.test(hash) || !config.allowedWasmSha256.map(value => value.toLowerCase()).includes(hash)) {
    throw safeError('WASM_HASH_ALLOWLIST_REJECTED');
  }
}

export function createSimulatedTestnetAdapter(input: {
  config: SimulatedTestnetConfig;
  transport: SimulatedTestnetTransport;
  secrets: SimulatedSecretStore;
  signerAlias: string;
  secretVersion: number;
  timeoutMs?: number;
}) {
  validateSimulatedTestnetConfig(input.config);
  const records = new Map<string, SimulatedSubmission>();
  const timeoutMs = Math.max(1, Math.min(input.timeoutMs ?? 1_000, 10_000));

  const digestAction = (action: SimulatedReceiptAction) => createHash('sha256').update(JSON.stringify(action)).digest('hex');
  const resultFor = (prior: SimulatedSubmission | undefined, operationId: string, payloadDigest: string, result: SimulatedTransportResult) => ({
    operationId,
    payloadDigest,
    state: result.state,
    attemptCount: (prior?.attemptCount ?? 0) + 1,
    ...(result.ledgerSequence === undefined ? {} : { ledgerSequence: result.ledgerSequence }),
    ...(result.errorCode ? { errorCode: redactCode(result.errorCode) } : {}),
  } satisfies SimulatedSubmission);

  return {
    prepare(action: SimulatedReceiptAction): SimulatedSubmission {
      assertAction(action);
      const payloadDigest = digestAction(action);
      const prior = records.get(action.operationId);
      if (prior && prior.payloadDigest !== payloadDigest) throw safeError('IDEMPOTENCY_CONFLICT');
      if (prior) return { ...prior };
      const prepared = { operationId: action.operationId, payloadDigest, state: 'prepared', attemptCount: 0 } satisfies SimulatedSubmission;
      records.set(action.operationId, prepared);
      return { ...prepared };
    },
    async submit(action: SimulatedReceiptAction): Promise<SimulatedSubmission> {
      const prepared = this.prepare(action);
      if (prepared.state === 'confirmed' || prepared.state === 'submitted') return prepared;
      const signature = input.secrets.signDigest(input.signerAlias, input.secretVersion, prepared.payloadDigest);
      let result: SimulatedTransportResult;
      try {
        result = await withTimeout(input.transport.submit({ payloadDigest: prepared.payloadDigest, signature }, timeoutMs), timeoutMs);
      } catch (error) {
        if ((error as { code?: string }).code !== 'RPC_TIMEOUT_UNKNOWN') throw error;
        result = { state: 'unknown', errorCode: 'RPC_TIMEOUT_UNKNOWN' };
      }
      const next = resultFor(records.get(action.operationId), action.operationId, prepared.payloadDigest, result);
      records.set(action.operationId, next);
      return { ...next };
    },
    async reconcile(operationId: string): Promise<SimulatedSubmission> {
      const prior = records.get(operationId);
      if (!prior) throw safeError('OPERATION_NOT_FOUND');
      if (prior.state === 'confirmed' || prior.state === 'failed') return { ...prior };
      let result: SimulatedTransportResult;
      try {
        result = await withTimeout(input.transport.reconcile(prior.payloadDigest, timeoutMs), timeoutMs);
      } catch (error) {
        if ((error as { code?: string }).code !== 'RPC_TIMEOUT_UNKNOWN') throw error;
        result = { state: 'unknown', errorCode: 'RPC_TIMEOUT_UNKNOWN' };
      }
      const next = resultFor(prior, operationId, prior.payloadDigest, result);
      if (next.ledgerSequence !== undefined && prior.ledgerSequence !== undefined && next.ledgerSequence < prior.ledgerSequence) {
        next.state = 'unknown'; next.errorCode = 'LEDGER_ORDER_VIOLATION'; delete next.ledgerSequence;
      }
      records.set(operationId, next);
      return { ...next };
    },
    get(operationId: string) { const value = records.get(operationId); return value ? { ...value } : null; },
  };
}

function assertAction(action: SimulatedReceiptAction) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(action.operationId)) throw safeError('INVALID_OPERATION_ID');
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(action.receiptHandle)) throw safeError('INVALID_RECEIPT_HANDLE');
  if (!Number.isSafeInteger(action.expectedVersion) || action.expectedVersion < 0) throw safeError('INVALID_EXPECTED_VERSION');
  if (!/^[a-f0-9]{64}$/i.test(action.commitment)) throw safeError('INVALID_COMMITMENT');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(safeError('RPC_TIMEOUT_UNKNOWN')), timeoutMs); })]);
  } finally { if (timer) clearTimeout(timer); }
}

function redactCode(value: string) { return /^[A-Z0-9_]{1,64}$/.test(value) ? value : 'SIMULATED_TRANSPORT_ERROR'; }
function safeError(code: string) { return Object.assign(new Error('Simulated Testnet operation unavailable.'), { code }); }

export function syntheticContractId() { return `C${'A'.repeat(55)}`; }
export function syntheticCommitment() { return randomBytes(32).toString('hex'); }
