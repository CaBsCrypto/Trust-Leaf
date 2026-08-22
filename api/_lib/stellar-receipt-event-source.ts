import type { SimulatedLedger } from './receipt-indexer.ts';

export interface LedgerCursor { sequence: number; hash: string }
export interface ReceiptEventSourceTransport {
  readonly kind: 'fixture' | 'stellar-rpc';
  fetchNext(cursor: LedgerCursor | null, timeoutMs: number): Promise<{ status: 'ledger'; contractId: string; schemaVersion: 1; ledger: SimulatedLedger } | { status: 'caught_up' }>;
}
export interface IndexerMetricSink { increment(name: 'ledger_ingested' | 'caught_up' | 'source_unknown' | 'ingest_rejected', labels?: Readonly<Record<string, string>>): void }

export function createReceiptEventSource(input: {
  mode: 'fixture' | 'testnet'; transport: ReceiptEventSourceTransport; timeoutMs?: number; metrics: IndexerMetricSink;
  contractId: string; ingest: (ledger: SimulatedLedger) => void; getCursor: () => LedgerCursor | null;
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
    try { input.ingest(response.ledger); }
    catch (error) { input.metrics.increment('ingest_rejected', { code: safeCode(error) }); throw error; }
    input.metrics.increment('ledger_ingested');
    return { status: 'ingested', cursor: input.getCursor() };
  } };
}
function safeCode(error: unknown) { const code = (error as { code?: string }).code; return code && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INDEXER_ERROR'; }
function safe(code: string) { return Object.assign(new Error('Receipt event source unavailable.'), { code }); }
async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(reject, timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
