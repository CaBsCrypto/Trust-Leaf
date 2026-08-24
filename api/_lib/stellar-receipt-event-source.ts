import type { SimulatedLedger } from './receipt-indexer.ts';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface LedgerCursor { sequence: number; hash: string }
export interface ReceiptEventSourceTransport {
  readonly kind: 'fixture' | 'stellar-rpc';
  fetchNext(cursor: LedgerCursor | null, timeoutMs: number): Promise<{ status: 'ledger'; contractId: string; schemaVersion: 1; ledger: SimulatedLedger } | { status: 'caught_up' }>;
}
export interface IndexerMetricSink { increment(name: 'ledger_ingested' | 'caught_up' | 'source_unknown' | 'ingest_rejected', labels?: Readonly<Record<string, string>>): void }

export function createStellarRpcReceiptEventTransport(input: {
  rpcUrl: string; contractId: string; startLedger: number;
  server?: InstanceType<typeof StellarSdk.rpc.Server>;
}): ReceiptEventSourceTransport {
  const server = input.server ?? new StellarSdk.rpc.Server(input.rpcUrl, { allowHttp: false });
  return { kind: 'stellar-rpc', async fetchNext(cursor) {
    const sequence = cursor ? cursor.sequence + 1 : input.startLedger;
    const ledgers = await server.getLedgers({ startLedger: Math.max(1, sequence - 1), pagination: { limit: 2 } });
    const current = ledgers.ledgers.find(item => item.sequence === sequence);
    if (!current) return { status: 'caught_up' };
    // The initial checkpoint has no prior local cursor. Its parent is a sentinel;
    // every subsequent poll is cryptographically linked to the stored cursor.
    const parent = cursor?.hash ?? ledgers.ledgers.find(item => item.sequence === sequence - 1)?.hash ?? '0'.repeat(64);
    const response = await server.getEvents({ startLedger: sequence, endLedger: sequence + 1, filters: [{ type: 'contract', contractIds: [input.contractId] }], limit: 100 });
    if (response.events.some(event => event.contractId?.contractId() !== input.contractId)) throw safe('EVENT_CONTRACT_REJECTED');
    const events = response.events.map(decodeEvent).filter((event): event is NonNullable<typeof event> => event !== null);
    return { status: 'ledger', contractId: input.contractId, schemaVersion: 1 as const, ledger: {
      sequence, hash: current.hash.toLowerCase(), parentHash: parent.toLowerCase(), closedAt: Math.floor(Date.parse(current.ledgerCloseTime) / 1000), events,
    } };
  } };
}

const EVENT_STATES = new Map<string, 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired'>([['Issued', 'issued'], ['Active', 'active'], ['Partial', 'partial'], ['Dispensed', 'dispensed'], ['Revoked', 'revoked'], ['Expired', 'expired']]);
function decodeEvent(event: StellarSdk.rpc.Api.EventResponse) {
  if (!event.inSuccessfulContractCall) return null;
  const topic = StellarSdk.scValToNative(event.topic[0]);
  const state = EVENT_STATES.get(String(topic));
  if (!state) return null; // GrantChanged is intentionally outside the receipt state timeline.
  const payload = StellarSdk.scValToNative(event.value);
  if (!Array.isArray(payload) || payload.length !== 6 || Number(payload[0]) !== 1) throw safe('EVENT_SCHEMA_REJECTED');
  const receiptId = opaqueBytes(payload[1]);
  const version = Number(payload[2]);
  const operationId = opaqueBytes(payload[4]);
  if (!Number.isSafeInteger(version) || version < 1) throw safe('EVENT_SCHEMA_REJECTED');
  return { eventId: createHash('sha256').update(`${event.txHash}:${event.id}`).digest('hex'), receiptId, operationId, version, state };
}
function opaqueBytes(value: unknown) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) throw safe('EVENT_SCHEMA_REJECTED');
  return Buffer.from(value).toString('hex');
}

export function createReceiptEventSource(input: {
  mode: 'fixture' | 'testnet'; transport: ReceiptEventSourceTransport; timeoutMs?: number; metrics: IndexerMetricSink;
  contractId: string; ingest: (ledger: SimulatedLedger) => void | Promise<void>; getCursor: () => LedgerCursor | null;
}) {
  if (input.mode === 'testnet' && input.transport.kind !== 'stellar-rpc') throw safe('REAL_SOURCE_REQUIRED');
  if (input.mode === 'fixture' && input.transport.kind !== 'fixture') throw safe('FIXTURE_SOURCE_REQUIRED');
  const timeoutMs = Math.max(1, Math.min(input.timeoutMs ?? 5_000, 15_000));
  return { async pollOnce(): Promise<{ status: 'ingested' | 'caught_up' | 'unknown'; cursor: LedgerCursor | null }> {
    let response: Awaited<ReturnType<ReceiptEventSourceTransport['fetchNext']>>;
    try { response = await bounded(input.transport.fetchNext(input.getCursor(), timeoutMs), timeoutMs); }
    catch { input.metrics.increment('source_unknown', { code: 'SOURCE_TIMEOUT' }); return { status: 'unknown', cursor: input.getCursor() }; }
    if (response.status === 'caught_up') { input.metrics.increment('caught_up'); return { status: 'caught_up', cursor: input.getCursor() }; }
    if (response.contractId !== input.contractId || response.schemaVersion !== 1) {
      input.metrics.increment('ingest_rejected', { code: 'EVENT_SOURCE_ALLOWLIST_REJECTED' });
      throw safe('EVENT_SOURCE_ALLOWLIST_REJECTED');
    }
    try { await input.ingest(response.ledger); }
    catch (error) { input.metrics.increment('ingest_rejected', { code: safeCode(error) }); throw error; }
    input.metrics.increment('ledger_ingested');
    return { status: 'ingested', cursor: input.getCursor() };
  } };
}
function safeCode(error: unknown) { const code = (error as { code?: string }).code; return code && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INDEXER_ERROR'; }
function safe(code: string) { return Object.assign(new Error('Receipt event source unavailable.'), { code }); }
async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(reject, timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
