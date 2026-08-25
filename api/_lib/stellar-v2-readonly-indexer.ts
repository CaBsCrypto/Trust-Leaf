import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  createDurableReadonlyReceiptIndexer,
  type DurableReceiptIndexerStorePort,
} from './durable-readonly-receipt-indexer.ts';
import {
  createReceiptEventSource,
  type IndexerMetricSink,
  type LedgerCursor,
  type ReceiptEventSourceTransport,
} from './stellar-receipt-event-source.ts';

const TESTNET = 'testnet' as const;
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const CONTRACT = /^C[A-Z2-7]{55}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const HTTPS_RPC = /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s]*)?$/i;
const REPORT_CODES = new Set([
  'ATTESTATION_ALLOWLIST_REJECTED', 'ATTESTATION_UNKNOWN', 'EVENT_PAGE_LIMIT', 'EVENT_PAGINATION_REJECTED',
  'EVENT_SCHEMA_REJECTED', 'EVENT_SOURCE_REJECTED', 'INDEXER_CONCURRENT_UPDATE', 'INDEXER_REJECTED',
  'INDEXER_RETENTION_LIMIT', 'INDEXER_SEQUENCE_REJECTED', 'INDEXER_SNAPSHOT_INVALID', 'INDEXER_STORAGE_BUSY',
  'INDEXER_STORAGE_UNAVAILABLE', 'LEDGER_GAP', 'LEDGER_PARENT_UNAVAILABLE', 'LEDGER_TIMESTAMP_REJECTED',
  'PARENT_HASH_MISMATCH', 'REORG_REWIND', 'RPC_TIMEOUT', 'RPC_UNAVAILABLE', 'SOURCE_TIMEOUT', 'SOURCE_UNKNOWN',
]);

export interface StellarV2ReadonlyIndexerConfig {
  mode: 'fixture' | 'testnet-readonly';
  network: typeof TESTNET;
  networkPassphrase: string;
  rpcUrl: string;
  allowedRpcUrls: readonly string[];
  receiptContractId: string;
  allowedContractIds: readonly string[];
  receiptWasmSha256: string;
  allowedWasmSha256: readonly string[];
  startLedger: number;
  timeoutMs?: number;
  retryAttempts?: number;
  finalityDepth?: number;
  submissionEnabled: false;
  mutationsAllowed: false;
}

export interface StellarV2Attestation {
  networkPassphrase: string;
  contractId: string;
  wasmSha256: string;
}

export interface StellarV2ReadonlyTransport extends ReceiptEventSourceTransport {
  attest(timeoutMs: number): Promise<StellarV2Attestation>;
}

export interface SanitizedV2IndexerReport {
  mode: 'fixture' | 'testnet-readonly';
  network: typeof TESTNET;
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

type RpcServer = InstanceType<typeof StellarSdk.rpc.Server>;

export function validateStellarV2ReadonlyIndexerConfig(config: StellarV2ReadonlyIndexerConfig): void {
  const hash = config.receiptWasmSha256.toLowerCase();
  if (config.mode !== 'fixture' && config.mode !== 'testnet-readonly') fail('INDEXER_MODE_REJECTED');
  if (config.network !== TESTNET || config.networkPassphrase !== TESTNET_PASSPHRASE) fail('NETWORK_ALLOWLIST_REJECTED');
  if (!HTTPS_RPC.test(config.rpcUrl) || !config.allowedRpcUrls.includes(config.rpcUrl)) fail('RPC_ALLOWLIST_REJECTED');
  if (!CONTRACT.test(config.receiptContractId) || !config.allowedContractIds.includes(config.receiptContractId)) fail('CONTRACT_ALLOWLIST_REJECTED');
  if (!SHA256.test(hash) || !config.allowedWasmSha256.map(value => value.toLowerCase()).includes(hash)) fail('WASM_ALLOWLIST_REJECTED');
  if (!Number.isSafeInteger(config.startLedger) || config.startLedger < 1) fail('START_LEDGER_REJECTED');
  if (config.submissionEnabled !== false || config.mutationsAllowed !== false) fail('READONLY_FLAGS_REQUIRED');
  if (config.timeoutMs !== undefined && (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 50 || config.timeoutMs > 15_000)) fail('TIMEOUT_POLICY_REJECTED');
  if (config.retryAttempts !== undefined && (!Number.isSafeInteger(config.retryAttempts) || config.retryAttempts < 1 || config.retryAttempts > 5)) fail('RETRY_POLICY_REJECTED');
  if (config.finalityDepth !== undefined && (!Number.isSafeInteger(config.finalityDepth) || config.finalityDepth < 1 || config.finalityDepth > 32)) fail('FINALITY_POLICY_REJECTED');
}

/** Creates a lazy, read-only RPC transport. No network request happens here. */
export function createStellarV2RpcReadonlyTransport(input: {
  rpcUrl: string;
  contractId: string;
  startLedger: number;
  maxEventPages?: number;
  server?: RpcServer;
}): StellarV2ReadonlyTransport {
  const server = input.server ?? new StellarSdk.rpc.Server(input.rpcUrl, { allowHttp: false });
  const maxEventPages = Math.max(1, Math.min(input.maxEventPages ?? 4, 10));
  return {
    kind: 'stellar-rpc',
    async attest() {
      const [network, wasm] = await Promise.all([
        server.getNetwork(),
        server.getContractWasmByContractId(input.contractId),
      ]);
      return {
        networkPassphrase: network.passphrase,
        contractId: input.contractId,
        wasmSha256: createHash('sha256').update(wasm).digest('hex'),
      };
    },
    async fetchNext(cursor) {
      const wanted = cursor ? cursor.sequence + 1 : input.startLedger;
      const queryStart = Math.max(1, (cursor?.sequence ?? input.startLedger) - 1);
      const ledgerResponse = await server.getLedgers({ startLedger: queryStart, pagination: { limit: 3 } });
      let sequence = wanted;
      const currentTip = cursor ? ledgerResponse.ledgers.find(item => item.sequence === cursor.sequence) : undefined;
      if (cursor && currentTip && currentTip.hash.toLowerCase() !== cursor.hash.toLowerCase()) sequence = cursor.sequence;
      const current = ledgerResponse.ledgers.find(item => item.sequence === sequence);
      if (!current) {
        if (ledgerResponse.latestLedger >= sequence) fail('LEDGER_GAP');
        return { status: 'caught_up' };
      }
      const parent = ledgerResponse.ledgers.find(item => item.sequence === sequence - 1);
      if (sequence > 1 && !parent) fail('LEDGER_PARENT_UNAVAILABLE');
      const events = await readEventPages(server, input.contractId, sequence, maxEventPages);
      const closedAt = Math.floor(Date.parse(current.ledgerCloseTime) / 1_000);
      if (!Number.isSafeInteger(closedAt) || closedAt < 1) fail('LEDGER_TIMESTAMP_REJECTED');
      return {
        status: 'ledger',
        contractId: input.contractId,
        schemaVersion: 1,
        ledger: {
          sequence,
          hash: current.hash.toLowerCase(),
          parentHash: parent?.hash.toLowerCase() ?? '0'.repeat(64),
          closedAt,
          events,
        },
      };
    },
  };
}

export function createStellarV2ReadonlyIndexer(input: {
  config: StellarV2ReadonlyIndexerConfig;
  transport: StellarV2ReadonlyTransport;
  store: DurableReceiptIndexerStorePort;
  metrics: IndexerMetricSink;
  wait?: (delayMs: number) => Promise<void>;
}) {
  validateStellarV2ReadonlyIndexerConfig(input.config);
  if (input.config.mode === 'testnet-readonly' && input.transport.kind !== 'stellar-rpc') fail('REAL_SOURCE_REQUIRED');
  if (input.config.mode === 'fixture' && input.transport.kind !== 'fixture') fail('FIXTURE_SOURCE_REQUIRED');
  const timeoutMs = input.config.timeoutMs ?? 5_000;
  const retryAttempts = input.config.retryAttempts ?? 3;
  const wait = input.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay)));
  const indexer = createDurableReadonlyReceiptIndexer({ store: input.store, finalityDepth: input.config.finalityDepth });
  let recovered = false;
  let attested = false;
  let pollStatus: SanitizedV2IndexerReport['pollStatus'] = 'not-started';
  let attempts = 0;
  let code: string | undefined;
  const source = createReceiptEventSource({
    mode: input.config.mode === 'fixture' ? 'fixture' : 'testnet',
    transport: input.transport,
    timeoutMs,
    metrics: input.metrics,
    contractId: input.config.receiptContractId,
    ingest: async ledger => { await indexer.ingest(ledger); },
    getCursor: indexer.getCursor,
  });

  const report = (): SanitizedV2IndexerReport => {
    const health = indexer.getHealth();
    const result: SanitizedV2IndexerReport = {
      mode: input.config.mode,
      network: TESTNET,
      ready: recovered && attested && (pollStatus === 'ingested' || pollStatus === 'caught-up'),
      durable: health.durable,
      recovered,
      attested,
      pollStatus,
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
      let attestation: StellarV2Attestation;
      try {
        attestation = await bounded(input.transport.attest(timeoutMs), timeoutMs);
      } catch (error) {
        code = safeCode(error, 'ATTESTATION_UNKNOWN');
        pollStatus = 'unknown';
        return report();
      }
      if (attestation.networkPassphrase !== input.config.networkPassphrase
        || attestation.contractId !== input.config.receiptContractId
        || attestation.wasmSha256.toLowerCase() !== input.config.receiptWasmSha256.toLowerCase()) {
        code = 'ATTESTATION_ALLOWLIST_REJECTED';
        pollStatus = 'rejected';
        return report();
      }
      attested = true;
      code = undefined;
      return report();
    },
    async pollOnce() {
      if (!recovered || !attested) fail('INDEXER_NOT_ATTESTED');
      for (attempts = 1; attempts <= retryAttempts; attempts += 1) {
        try {
          const result = await source.pollOnce();
          if (result.status !== 'unknown') {
            pollStatus = result.status === 'caught_up' ? 'caught-up' : 'ingested';
            code = undefined;
            return report();
          }
          code = 'SOURCE_UNKNOWN';
        } catch (error) {
          const candidate = safeCode(error, 'INDEXER_REJECTED');
          if (candidate === 'PARENT_HASH_MISMATCH') {
            const cursor = indexer.getCursor();
            if (cursor) {
              await indexer.rewindFrom(Math.max(input.config.startLedger, cursor.sequence - 1));
              code = 'REORG_REWIND';
              if (attempts < retryAttempts) continue;
            }
          }
          if (!['SOURCE_TIMEOUT', 'RPC_UNAVAILABLE', 'SOURCE_UNKNOWN'].includes(candidate)) {
            code = candidate;
            pollStatus = 'rejected';
            return report();
          }
          code = candidate;
        }
        if (attempts < retryAttempts) await wait(Math.min(250 * (2 ** (attempts - 1)), 1_000));
      }
      attempts = retryAttempts;
      pollStatus = 'unknown';
      return report();
    },
    getReceiptTimeline: indexer.getReceiptTimeline,
    getCursor: indexer.getCursor,
    getReport: report,
  };
}

async function readEventPages(server: RpcServer, contractId: string, sequence: number, maxPages: number) {
  const events: ReturnType<typeof decodeV2ReceiptEvent>[] = [];
  let cursor: string | undefined;
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await server.getEvents(cursor
      ? { cursor, filters: [{ type: 'contract', contractIds: [contractId] }], limit: 100 }
      : { startLedger: sequence, endLedger: sequence + 1, filters: [{ type: 'contract', contractIds: [contractId] }], limit: 100 });
    for (const event of response.events) {
      if (event.ledger > sequence) return events.filter((item): item is NonNullable<typeof item> => item !== null);
      if (event.ledger !== sequence || event.contractId?.contractId() !== contractId) fail('EVENT_SOURCE_REJECTED');
      events.push(decodeV2ReceiptEvent(event));
    }
    if (response.events.length < 100) return events.filter((item): item is NonNullable<typeof item> => item !== null);
    cursor = response.cursor;
    if (!cursor) fail('EVENT_PAGINATION_REJECTED');
  }
  return fail('EVENT_PAGE_LIMIT');
}

function decodeV2ReceiptEvent(event: StellarSdk.rpc.Api.EventResponse) {
  if (!event.inSuccessfulContractCall) return null;
  if (String(StellarSdk.scValToNative(event.topic[0])) !== 'ReceiptChanged') return null;
  const value = StellarSdk.scValToNative(event.value);
  if (!Array.isArray(value) || value.length !== 9 || Number(value[0]) !== 2) fail('EVENT_SCHEMA_REJECTED');
  const state = new Map<number, 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired'>([
    [1, 'issued'], [2, 'active'], [3, 'partial'], [4, 'dispensed'], [5, 'revoked'], [6, 'expired'],
  ]).get(Number(value[2]));
  const receiptId = opaqueBytes(value[1]);
  const version = Number(value[3]);
  const operationId = opaqueBytes(value[7]);
  if (!state || !Number.isSafeInteger(version) || version < 1) fail('EVENT_SCHEMA_REJECTED');
  return {
    eventId: createHash('sha256').update(`${event.txHash}:${event.id}`).digest('hex'),
    receiptId,
    operationId,
    version,
    state,
  };
}

function opaqueBytes(value: unknown) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) fail('EVENT_SCHEMA_REJECTED');
  return Buffer.from(value).toString('hex');
}

function assertSanitizedReport(report: SanitizedV2IndexerReport) {
  const serialized = JSON.stringify(report);
  if (serialized.length > 2_048
    || /https?:\/\/|\bC[A-Z2-7]{55}\b|\bG[A-Z2-7]{55}\b|\bS[A-Z2-7]{55}\b|\b[a-f0-9]{64}\b|@/i.test(serialized)
    || /secret|seed|private.?key|xdr|signature|contract.?id|receipt.?id/i.test(serialized)
    || report.submissionAttempts !== 0 || report.mutationsAllowed !== false) fail('UNSAFE_INDEXER_REPORT');
}

function safeCode(error: unknown, fallback: string) {
  const value = (error as { code?: unknown })?.code;
  return typeof value === 'string' && REPORT_CODES.has(value) ? value : fallback;
}
function fail(code: string): never { throw Object.assign(new Error('Stellar V2 read-only indexer unavailable.'), { code }); }
async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Read-only RPC timed out.'), { code: 'RPC_TIMEOUT' })), timeoutMs);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
