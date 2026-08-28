import { createHash } from 'node:crypto';
import { TESTNET_PASSPHRASE, TESTNET_RPC } from './simulated-testnet-adapter.ts';

export type RpcOperationState = 'prepared' | 'simulated' | 'signed' | 'submitted' | 'confirmed' | 'unknown' | 'failed';

export interface StellarRpcConfig {
  mode: 'testnet' | 'fixture';
  networkPassphrase: string;
  rpcUrl: string;
  allowedRpcUrls: readonly string[];
  contractId: string;
  allowedContractIds: readonly string[];
  wasmSha256: string;
  allowedWasmSha256: readonly string[];
  submissionEnabled: boolean;
  submissionAuthorization?: { operationId: string; expiresAt: number; maxSubmissions: 1 };
  timeoutMs?: number;
  confirmationLedgers?: number;
}

export interface OpaqueContractInvocation {
  operationId: string;
  receiptHandle: string;
  expectedVersion: number;
  actor: string;
  functionName: 'issue' | 'activate' | 'record_partial' | 'mark_dispensed' | 'revoke' | 'expire';
  commitment: string;
}

export interface UnsignedEnvelope { xdr: string; transactionHash: string }
export interface SignedEnvelope extends UnsignedEnvelope { signedXdr: string; signerKeyVersion: number }
export interface SimulationResult { status: 'ready' | 'failed'; envelope?: UnsignedEnvelope; errorCode?: string }
export interface SubmissionResult { status: 'submitted' | 'confirmed' | 'failed'; transactionHash: string; ledgerSequence?: number; errorCode?: string }
export interface ConfirmationResult { status: 'pending' | 'confirmed' | 'not_found' | 'failed'; transactionHash: string; ledgerSequence?: number; errorCode?: string }

export interface StellarRpcTransport {
  readonly kind: 'fixture' | 'stellar-rpc';
  simulate(invocation: OpaqueContractInvocation, timeoutMs: number): Promise<SimulationResult>;
  submit(envelope: SignedEnvelope, timeoutMs: number): Promise<SubmissionResult>;
  confirm(transactionHash: string, timeoutMs: number): Promise<ConfirmationResult>;
}

export interface EnvelopeSigner {
  sign(envelope: UnsignedEnvelope): Promise<{ signedXdr: string; keyVersion: number }>;
}

export interface RpcOperationRecord {
  operationId: string;
  invocationDigest: string;
  state: RpcOperationState;
  simulateAttempts: number;
  submitAttempts: number;
  confirmAttempts: number;
  transactionHash?: string;
  ledgerSequence?: number;
  errorCode?: string;
}

const CONTRACT = /^C[A-Z2-7]{55}$/;
const HASH = /^[a-f0-9]{64}$/;
const OPAQUE = /^[A-Za-z0-9_-]{16,128}$/;

export function validateStellarRpcConfig(config: StellarRpcConfig): void {
  const wasm = config.wasmSha256.toLowerCase();
  if (config.networkPassphrase !== TESTNET_PASSPHRASE) fail('NETWORK_PASSPHRASE_REJECTED');
  if (config.rpcUrl !== TESTNET_RPC || !config.allowedRpcUrls.includes(config.rpcUrl)) fail('RPC_URL_ALLOWLIST_REJECTED');
  if (!CONTRACT.test(config.contractId) || !config.allowedContractIds.includes(config.contractId)) fail('CONTRACT_ALLOWLIST_REJECTED');
  if (!HASH.test(wasm) || !config.allowedWasmSha256.map(value => value.toLowerCase()).includes(wasm)) fail('WASM_HASH_ALLOWLIST_REJECTED');
  if (config.mode === 'testnet' && config.submissionEnabled && (!config.submissionAuthorization || config.submissionAuthorization.maxSubmissions !== 1 || !OPAQUE.test(config.submissionAuthorization.operationId) || config.submissionAuthorization.expiresAt <= Date.now())) fail('TESTNET_SUBMISSION_GATE_CLOSED');
}

export function createStellarRpcAdapter(input: { config: StellarRpcConfig; transport: StellarRpcTransport; signer: EnvelopeSigner }) {
  validateStellarRpcConfig(input.config);
  if (input.config.mode === 'testnet' && input.transport.kind !== 'stellar-rpc') fail('REAL_TRANSPORT_REQUIRED');
  if (input.config.mode === 'fixture' && input.transport.kind !== 'fixture') fail('FIXTURE_TRANSPORT_REQUIRED');
  const timeoutMs = Math.max(1, Math.min(input.config.timeoutMs ?? 5_000, 15_000));
  const records = new Map<string, RpcOperationRecord>();
  const envelopes = new Map<string, UnsignedEnvelope | SignedEnvelope>();
  let authorizedSubmissions = 0;
  const digest = (invocation: OpaqueContractInvocation) => createHash('sha256').update(JSON.stringify(invocation)).digest('hex');

  const prepare = (invocation: OpaqueContractInvocation): RpcOperationRecord => {
    assertInvocation(invocation);
    const invocationDigest = digest(invocation);
    const prior = records.get(invocation.operationId);
    if (prior && prior.invocationDigest !== invocationDigest) fail('IDEMPOTENCY_CONFLICT');
    if (prior) return { ...prior };
    const record: RpcOperationRecord = { operationId: invocation.operationId, invocationDigest, state: 'prepared', simulateAttempts: 0, submitAttempts: 0, confirmAttempts: 0 };
    records.set(invocation.operationId, record);
    return { ...record };
  };

  const simulate = async (invocation: OpaqueContractInvocation): Promise<RpcOperationRecord> => {
    const prior = prepare(invocation);
    if (prior.state !== 'prepared' && prior.state !== 'failed') return prior;
    let result: SimulationResult;
    try { result = await bounded(input.transport.simulate(invocation, timeoutMs), timeoutMs); }
    catch { return update(prior, { state: 'unknown', simulateAttempts: prior.simulateAttempts + 1, errorCode: 'RPC_TIMEOUT_UNKNOWN' }); }
    if (result.status !== 'ready' || !result.envelope) return update(prior, { state: 'failed', simulateAttempts: prior.simulateAttempts + 1, errorCode: redact(result.errorCode) });
    if (!HASH.test(result.envelope.transactionHash) || !result.envelope.xdr) fail('INVALID_SIMULATION_RESPONSE');
    envelopes.set(prior.operationId, { ...result.envelope });
    return update(prior, { state: 'simulated', simulateAttempts: prior.simulateAttempts + 1, transactionHash: result.envelope.transactionHash, errorCode: undefined });
  };

  const sign = async (operationId: string): Promise<RpcOperationRecord> => {
    const prior = required(operationId);
    if (['signed', 'submitted', 'confirmed'].includes(prior.state)) return { ...prior };
    if (prior.state !== 'simulated') fail('OPERATION_NOT_SIMULATED');
    const unsigned = envelopes.get(operationId) as UnsignedEnvelope;
    const signature = await input.signer.sign({ ...unsigned });
    if (!signature.signedXdr || !Number.isSafeInteger(signature.keyVersion) || signature.keyVersion < 1) fail('SIGNER_RESPONSE_REJECTED');
    envelopes.set(operationId, { ...unsigned, signedXdr: signature.signedXdr, signerKeyVersion: signature.keyVersion });
    return update(prior, { state: 'signed' });
  };

  const submit = async (operationId: string): Promise<RpcOperationRecord> => {
    const prior = required(operationId);
    if (prior.state === 'submitted' || prior.state === 'confirmed') return { ...prior };
    if (prior.state === 'unknown') return confirm(operationId);
    if (prior.state !== 'signed') fail('OPERATION_NOT_SIGNED');
    if (!input.config.submissionEnabled) fail('SUBMISSION_GATE_CLOSED');
    const authorization = input.config.submissionAuthorization;
    if (input.config.mode === 'testnet' && (!authorization || authorization.operationId !== operationId || authorization.expiresAt <= Date.now() || authorizedSubmissions >= authorization.maxSubmissions)) fail('SUBMISSION_AUTHORIZATION_REJECTED');
    authorizedSubmissions += 1;
    let result: SubmissionResult;
    try { result = await bounded(input.transport.submit(envelopes.get(operationId) as SignedEnvelope, timeoutMs), timeoutMs); }
    catch { return update(prior, { state: 'unknown', submitAttempts: prior.submitAttempts + 1, errorCode: 'RPC_TIMEOUT_UNKNOWN' }); }
    return update(prior, { state: result.status, submitAttempts: prior.submitAttempts + 1, transactionHash: result.transactionHash, ledgerSequence: result.ledgerSequence, errorCode: redact(result.errorCode) });
  };

  const confirm = async (operationId: string): Promise<RpcOperationRecord> => {
    const prior = required(operationId);
    if (prior.state === 'confirmed' || prior.state === 'failed') return { ...prior };
    if (!prior.transactionHash || !['submitted', 'unknown'].includes(prior.state)) fail('OPERATION_NOT_SUBMITTED');
    let result: ConfirmationResult;
    try { result = await bounded(input.transport.confirm(prior.transactionHash, timeoutMs), timeoutMs); }
    catch { return update(prior, { state: 'unknown', confirmAttempts: prior.confirmAttempts + 1, errorCode: 'RPC_TIMEOUT_UNKNOWN' }); }
    const state: RpcOperationState = result.status === 'confirmed' ? 'confirmed' : result.status === 'failed' ? 'failed' : 'unknown';
    return update(prior, { state, confirmAttempts: prior.confirmAttempts + 1, ledgerSequence: result.ledgerSequence, errorCode: result.status === 'not_found' ? 'TX_NOT_YET_OBSERVED' : redact(result.errorCode) });
  };

  function required(operationId: string) { const value = records.get(operationId); if (!value) fail('OPERATION_NOT_FOUND'); return value!; }
  function update(prior: RpcOperationRecord, patch: Partial<RpcOperationRecord>) { const next = { ...prior, ...patch }; records.set(prior.operationId, next); return { ...next }; }
  return { prepare, simulate, sign, submit, confirm, get: (operationId: string) => records.has(operationId) ? { ...records.get(operationId)! } : null };
}

function assertInvocation(value: OpaqueContractInvocation) {
  if (!OPAQUE.test(value.operationId) || !OPAQUE.test(value.receiptHandle)) fail('INVALID_OPAQUE_IDENTIFIER');
  if (!/^G[A-Z2-7]{55}$/.test(value.actor)) fail('INVALID_ACTOR');
  if (!Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 0 || !HASH.test(value.commitment.toLowerCase())) fail('INVALID_INVOCATION');
  if ((value.functionName === 'issue' && value.expectedVersion !== 0) || (value.functionName !== 'issue' && value.expectedVersion < 1)) fail('INVALID_EXPECTED_VERSION');
}
function redact(value?: string) { return value && /^[A-Z0-9_]{1,64}$/.test(value) ? value : value ? 'RPC_ERROR_REDACTED' : undefined; }
function fail(code: string): never { throw Object.assign(new Error('Stellar operation unavailable.'), { code }); }
async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(reject, timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
