import { createHash } from 'node:crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  createDurableReadonlyReceiptIndexer,
  type DurableReceiptIndexerStorePort,
} from './durable-readonly-receipt-indexer.ts';
import {
  createReceiptEventSource,
  createStellarRpcReceiptEventTransport,
  type IndexerMetricSink,
  type ReceiptEventSourceTransport,
} from './stellar-receipt-event-source.ts';
import { DEPLOYED_RECEIPT_CONTRACT_ID } from './readonly-receipt-verifier.ts';

export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const STELLAR_TESTNET_RPC_URL = 'https://soroban-testnet.stellar.org';
export const DEPLOYED_RECEIPT_WASM_SHA256 = '718467336c29d771af93612ecaa3954ec3bd14837ad2c219587e5b75e591e370';
export const DEPLOYED_RECEIPT_START_LEDGER = 4_282_700;
export const DEPLOYED_RECEIPT_EVIDENCE_THROUGH_LEDGER = 4_282_756;

const CONTRACT = /^C[A-Z2-7]{55}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const HTTPS_RPC = /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s]*)?$/i;
const SAFE_CODES = new Set([
  'ATTESTATION_ALLOWLIST_REJECTED', 'ATTESTATION_UNKNOWN', 'CONTRACT_ALLOWLIST_REJECTED',
  'EVENT_SCHEMA_REJECTED', 'EVENT_SOURCE_ALLOWLIST_REJECTED', 'INDEXER_CONCURRENT_UPDATE',
  'INDEXER_REJECTED', 'INDEXER_RETENTION_LIMIT', 'INDEXER_SEQUENCE_REJECTED',
  'INDEXER_SNAPSHOT_INVALID', 'INDEXER_STORAGE_BUSY', 'INDEXER_STORAGE_UNAVAILABLE',
  'LEDGER_GAP', 'NETWORK_ALLOWLIST_REJECTED', 'READONLY_FLAGS_REQUIRED', 'REORG_REPLACED',
  'RPC_ALLOWLIST_REJECTED', 'SOURCE_TIMEOUT', 'SOURCE_UNKNOWN', 'START_LEDGER_REJECTED',
  'TIMEOUT_POLICY_REJECTED', 'RETRY_POLICY_REJECTED', 'WASM_ALLOWLIST_REJECTED',
]);

type RpcServer = InstanceType<typeof StellarSdk.rpc.Server>;

export interface StellarV1DurableReaderConfig {
  mode: 'testnet-readonly';
  network: 'testnet';
  networkPassphrase: string;
  rpcUrl: string;
  allowedRpcUrls: readonly string[];
  receiptContractId: string;
  allowedContractIds: readonly string[];
  receiptWasmSha256: string;
  allowedWasmSha256: readonly string[];
  startLedger: number;
  timeoutMs: number;
  retryAttempts: number;
  finalityDepth: number;
  submissionEnabled: false;
  mutationsAllowed: false;
}

export interface SanitizedV1ReaderReport {
  mode: 'testnet-readonly';
  network: 'testnet';
  ready: boolean;
  durable: boolean;
  recovered: boolean;
  attested: boolean;
  pollStatus: 'not-started' | 'ingested' | 'caught-up' | 'unknown' | 'rejected';
  retryAttempts: number;
  cursorPresent: boolean;
  submissionAttempts: 0;
  mutationsAllowed: false;
  code?: string;
}

/**
 * Loads only the already-reviewed ReceiptLedger V1 Testnet evidence packet.
 * The explicit live-read switch is checked by the operator script, not here;
 * constructing this configuration or service performs no network request.
 */
export function loadDeployedV1ReaderConfig(env: NodeJS.ProcessEnv): StellarV1DurableReaderConfig {
  const timeoutMs = parseBoundedInteger(env.TRUSTLEAF_V1_READONLY_TIMEOUT_MS ?? '5000', 100, 15_000, 'TIMEOUT_POLICY_REJECTED');
  const retryAttempts = parseBoundedInteger(env.TRUSTLEAF_V1_READONLY_RETRY_ATTEMPTS ?? '3', 1, 5, 'RETRY_POLICY_REJECTED');
  const finalityDepth = parseBoundedInteger(env.TRUSTLEAF_V1_READONLY_FINALITY_DEPTH ?? '2', 1, 32, 'FINALITY_POLICY_REJECTED');
  const startLedger = parseBoundedInteger(env.STELLAR_RECEIPT_START_LEDGER ?? '', 1, Number.MAX_SAFE_INTEGER, 'START_LEDGER_REJECTED');
  const config: StellarV1DurableReaderConfig = {
    mode: 'testnet-readonly',
    network: 'testnet',
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE ?? '',
    rpcUrl: env.STELLAR_RPC_URL ?? '',
    allowedRpcUrls: [STELLAR_TESTNET_RPC_URL],
    receiptContractId: env.STELLAR_RECEIPT_CONTRACT_ID ?? '',
    allowedContractIds: [DEPLOYED_RECEIPT_CONTRACT_ID],
    receiptWasmSha256: (env.STELLAR_RECEIPT_WASM_SHA256 ?? '').toLowerCase(),
    allowedWasmSha256: [DEPLOYED_RECEIPT_WASM_SHA256],
    startLedger,
    timeoutMs,
    retryAttempts,
    finalityDepth,
    submissionEnabled: env.TRUSTLEAF_TESTNET_SUBMIT_ENABLED === 'false' ? false : fail('READONLY_FLAGS_REQUIRED'),
    mutationsAllowed: env.TRUSTLEAF_ALLOW_TESTNET_MUTATIONS === 'false' ? false : fail('READONLY_FLAGS_REQUIRED'),
  };
  validateStellarV1DurableReaderConfig(config);
  if (config.rpcUrl !== STELLAR_TESTNET_RPC_URL
    || config.receiptContractId !== DEPLOYED_RECEIPT_CONTRACT_ID
    || config.receiptWasmSha256 !== DEPLOYED_RECEIPT_WASM_SHA256
    || config.startLedger !== DEPLOYED_RECEIPT_START_LEDGER) fail('ATTESTATION_ALLOWLIST_REJECTED');
  return config;
}

export function validateStellarV1DurableReaderConfig(config: StellarV1DurableReaderConfig): void {
  const wasmSha256 = config.receiptWasmSha256.toLowerCase();
  if (config.mode !== 'testnet-readonly' || config.network !== 'testnet'
    || config.networkPassphrase !== STELLAR_TESTNET_PASSPHRASE) fail('NETWORK_ALLOWLIST_REJECTED');
  if (!HTTPS_RPC.test(config.rpcUrl) || !config.allowedRpcUrls.includes(config.rpcUrl)) fail('RPC_ALLOWLIST_REJECTED');
  if (!CONTRACT.test(config.receiptContractId) || !config.allowedContractIds.includes(config.receiptContractId)) fail('CONTRACT_ALLOWLIST_REJECTED');
  if (!SHA256.test(wasmSha256) || !config.allowedWasmSha256.map(value => value.toLowerCase()).includes(wasmSha256)) fail('WASM_ALLOWLIST_REJECTED');
  if (!Number.isSafeInteger(config.startLedger) || config.startLedger < 1) fail('START_LEDGER_REJECTED');
  if (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 15_000) fail('TIMEOUT_POLICY_REJECTED');
  if (!Number.isSafeInteger(config.retryAttempts) || config.retryAttempts < 1 || config.retryAttempts > 5) fail('RETRY_POLICY_REJECTED');
  if (!Number.isSafeInteger(config.finalityDepth) || config.finalityDepth < 1 || config.finalityDepth > 32) fail('FINALITY_POLICY_REJECTED');
  if (config.submissionEnabled !== false || config.mutationsAllowed !== false) fail('READONLY_FLAGS_REQUIRED');
}

/** Builds the V1 transport and reader lazily. Network access begins at start(). */
export function createStellarV1RpcDurableReader(input: {
  config: StellarV1DurableReaderConfig;
  store: DurableReceiptIndexerStorePort;
  metrics: IndexerMetricSink;
  server?: RpcServer;
  wait?: (delayMs: number) => Promise<void>;
}) {
  const server = input.server ?? new StellarSdk.rpc.Server(input.config.rpcUrl, { allowHttp: false });
  const transport = createStellarRpcReceiptEventTransport({
    rpcUrl: input.config.rpcUrl,
    contractId: input.config.receiptContractId,
    startLedger: input.config.startLedger,
    server,
  });
  return createStellarV1DurableReader({
    ...input,
    transport,
    attest: async () => {
      const [network, wasm] = await Promise.all([
        server.getNetwork(),
        server.getContractWasmByContractId(input.config.receiptContractId),
      ]);
      return {
        networkPassphrase: network.passphrase,
        contractId: input.config.receiptContractId,
        wasmSha256: createHash('sha256').update(wasm).digest('hex'),
      };
    },
  });
}

export function createStellarV1DurableReader(input: {
  config: StellarV1DurableReaderConfig;
  store: DurableReceiptIndexerStorePort;
  metrics: IndexerMetricSink;
  transport: ReceiptEventSourceTransport;
  attest: () => Promise<{ networkPassphrase: string; contractId: string; wasmSha256: string }>;
  wait?: (delayMs: number) => Promise<void>;
}) {
  validateStellarV1DurableReaderConfig(input.config);
  if (input.transport.kind !== 'stellar-rpc') fail('RPC_ALLOWLIST_REJECTED');
  const indexer = createDurableReadonlyReceiptIndexer({ store: input.store, finalityDepth: input.config.finalityDepth });
  const wait = input.wait ?? (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)));
  let recovered = false;
  let attested = false;
  let status: SanitizedV1ReaderReport['pollStatus'] = 'not-started';
  let attempts = 0;
  let code: string | undefined;
  let cursorBeforePoll: { sequence: number; hash: string } | null = null;
  const source = createReceiptEventSource({
    mode: 'testnet',
    transport: input.transport,
    timeoutMs: input.config.timeoutMs,
    metrics: input.metrics,
    contractId: input.config.receiptContractId,
    ingest: async ledger => { await indexer.ingest(ledger); },
    getCursor: indexer.getCursor,
  });

  const report = (): SanitizedV1ReaderReport => {
    const health = indexer.getHealth();
    const result: SanitizedV1ReaderReport = {
      mode: 'testnet-readonly',
      network: 'testnet',
      ready: recovered && attested && (status === 'ingested' || status === 'caught-up'),
      durable: health.durable,
      recovered,
      attested,
      pollStatus: status,
      retryAttempts: attempts,
      cursorPresent: indexer.getCursor() !== null,
      submissionAttempts: 0,
      mutationsAllowed: false,
      code,
    };
    assertSanitizedReport(result);
    return result;
  };

  return {
    async start() {
      await indexer.recover();
      recovered = true;
      try {
        const attestation = await bounded(input.attest(), input.config.timeoutMs);
        if (attestation.networkPassphrase !== input.config.networkPassphrase
          || attestation.contractId !== input.config.receiptContractId
          || attestation.wasmSha256.toLowerCase() !== input.config.receiptWasmSha256.toLowerCase()) {
          status = 'rejected';
          code = 'ATTESTATION_ALLOWLIST_REJECTED';
          return report();
        }
      } catch (error) {
        status = 'unknown';
        code = safeCode(error, 'ATTESTATION_UNKNOWN');
        return report();
      }
      attested = true;
      code = undefined;
      return report();
    },
    async pollOnce() {
      if (!recovered || !attested) fail('ATTESTATION_UNKNOWN');
      cursorBeforePoll = indexer.getCursor();
      for (attempts = 1; attempts <= input.config.retryAttempts; attempts += 1) {
        try {
          const result = await source.pollOnce();
          if (result.status !== 'unknown') {
            status = result.status === 'caught_up' ? 'caught-up' : 'ingested';
            const cursor = indexer.getCursor();
            code = cursorBeforePoll && cursor?.sequence === cursorBeforePoll.sequence && cursor.hash !== cursorBeforePoll.hash
              ? 'REORG_REPLACED'
              : undefined;
            return report();
          }
          code = 'SOURCE_UNKNOWN';
        } catch (error) {
          const candidate = safeCode(error, 'INDEXER_REJECTED');
          if (!['SOURCE_TIMEOUT', 'SOURCE_UNKNOWN'].includes(candidate)) {
            status = 'rejected';
            code = candidate;
            return report();
          }
          code = candidate;
        }
        if (attempts < input.config.retryAttempts) await wait(Math.min(250 * (2 ** (attempts - 1)), 1_000));
      }
      attempts = input.config.retryAttempts;
      status = 'unknown';
      return report();
    },
    getReceiptTimeline: indexer.getReceiptTimeline,
    getCursor: indexer.getCursor,
    getReport: report,
  };
}

function assertSanitizedReport(report: SanitizedV1ReaderReport) {
  const serialized = JSON.stringify(report);
  if (serialized.length > 2_048
    || /https?:\/\/|\bC[A-Z2-7]{55}\b|\bG[A-Z2-7]{55}\b|\bS[A-Z2-7]{55}\b|\b[a-f0-9]{64}\b|@/i.test(serialized)
    || /secret|seed|private.?key|xdr|signature|contract.?id|receipt.?id|event.?id|event.?body/i.test(serialized)
    || report.submissionAttempts !== 0 || report.mutationsAllowed !== false) fail('UNSAFE_READER_REPORT');
}

function parseBoundedInteger(raw: string, minimum: number, maximum: number, code: string) {
  if (!/^\d+$/.test(raw)) fail(code);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}
function safeCode(error: unknown, fallback: string) {
  const candidate = (error as { code?: unknown })?.code;
  return typeof candidate === 'string' && SAFE_CODES.has(candidate) ? candidate : fallback;
}
function fail(code: string): never {
  throw Object.assign(new Error('ReceiptLedger V1 read-only evidence unavailable.'), { code });
}
async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Read-only operation timed out.'), { code: 'SOURCE_TIMEOUT' })), timeoutMs);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
