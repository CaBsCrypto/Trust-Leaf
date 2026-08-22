export type ReceiptChainState = 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired';
export type ReconciliationStatus = 'pending' | 'confirmed' | 'unknown' | 'anomalous';

export interface OpaqueReceiptEvent {
  eventId: string;
  receiptId: string;
  operationId: string;
  version: number;
  state: ReceiptChainState;
}

export interface SimulatedLedger {
  sequence: number;
  hash: string;
  parentHash: string;
  closedAt: number;
  events: readonly OpaqueReceiptEvent[];
}

export interface IndexedReceiptEvent extends OpaqueReceiptEvent {
  ledgerSequence: number;
  ledgerHash: string;
  closedAt: number;
  status: ReconciliationStatus;
}

export interface RedactedAuditEntry {
  code: string;
  at: number;
  ledgerSequence?: number;
  operationRef?: string;
}

export interface ReceiptEventIndexerPort {
  ingest(ledger: SimulatedLedger): void;
  resolveUnknown(operationId: string, outcome: 'confirmed' | 'absent'): void;
  getEvent(operationId: string): IndexedReceiptEvent | undefined;
  getReceiptTimeline(receiptId: string): readonly IndexedReceiptEvent[];
  getCursor(): { sequence: number; hash: string } | null;
  getAudit(): readonly RedactedAuditEntry[];
}

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const OPAQUE_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

function safeRef(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `ref_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validEvent(event: OpaqueReceiptEvent) {
  return OPAQUE_PATTERN.test(event.eventId)
    && OPAQUE_PATTERN.test(event.receiptId)
    && OPAQUE_PATTERN.test(event.operationId)
    && Number.isSafeInteger(event.version)
    && event.version > 0;
}

export function createSimulatedReceiptIndexer(options: { finalityDepth?: number; auditLimit?: number } = {}): ReceiptEventIndexerPort {
  const finalityDepth = Math.max(1, Math.min(options.finalityDepth ?? 3, 32));
  const auditLimit = Math.max(16, Math.min(options.auditLimit ?? 256, 2_048));
  const ledgers = new Map<number, SimulatedLedger>();
  const events = new Map<string, IndexedReceiptEvent>();
  const operations = new Map<string, string>();
  const audit: RedactedAuditEntry[] = [];
  let cursor: { sequence: number; hash: string } | null = null;

  const record = (code: string, context: { ledgerSequence?: number; operationId?: string } = {}) => {
    audit.push({ code, at: Date.now(), ledgerSequence: context.ledgerSequence, operationRef: context.operationId ? safeRef(context.operationId) : undefined });
    while (audit.length > auditLimit) audit.shift();
  };
  const refreshFinality = () => {
    if (!cursor) return;
    const finalizedThrough = cursor.sequence - finalityDepth + 1;
    for (const event of events.values()) {
      if (event.status === 'pending' && event.ledgerSequence <= finalizedThrough) event.status = 'confirmed';
    }
  };
  const rollbackFrom = (sequence: number) => {
    for (const [ledgerSequence] of [...ledgers]) if (ledgerSequence >= sequence) ledgers.delete(ledgerSequence);
    for (const [operationId, event] of [...events]) {
      if (event.ledgerSequence < sequence) continue;
      event.status = 'unknown';
      operations.delete(operationId);
    }
    const remaining = [...ledgers.values()].sort((left, right) => right.sequence - left.sequence)[0];
    cursor = remaining ? { sequence: remaining.sequence, hash: remaining.hash } : null;
    record('REORG_ROLLBACK', { ledgerSequence: sequence });
  };

  return {
    ingest(ledger) {
      if (!Number.isSafeInteger(ledger.sequence) || ledger.sequence < 1 || !HASH_PATTERN.test(ledger.hash) || !HASH_PATTERN.test(ledger.parentHash)) {
        record('INVALID_LEDGER_ENVELOPE', { ledgerSequence: ledger.sequence });
        throw Object.assign(new Error('Invalid simulated ledger envelope.'), { code: 'INVALID_LEDGER_ENVELOPE' });
      }
      for (const event of ledger.events) {
        if (!validEvent(event)) {
          record('INVALID_OPAQUE_EVENT', { ledgerSequence: ledger.sequence, operationId: event.operationId });
          throw Object.assign(new Error('Invalid opaque receipt event.'), { code: 'INVALID_OPAQUE_EVENT' });
        }
      }
      const sameHeight = ledgers.get(ledger.sequence);
      if (sameHeight?.hash === ledger.hash) return;
      if (sameHeight && sameHeight.hash !== ledger.hash) rollbackFrom(ledger.sequence);
      if (cursor && ledger.sequence !== cursor.sequence + 1) {
        record('LEDGER_GAP', { ledgerSequence: ledger.sequence });
        throw Object.assign(new Error('Ledger sequence gap; reconciliation required.'), { code: 'LEDGER_GAP' });
      }
      if (cursor && ledger.parentHash !== cursor.hash) {
        record('PARENT_HASH_MISMATCH', { ledgerSequence: ledger.sequence });
        throw Object.assign(new Error('Ledger parent mismatch; reconciliation required.'), { code: 'PARENT_HASH_MISMATCH' });
      }
      const seenInLedger = new Set<string>();
      for (const event of ledger.events) {
        if (seenInLedger.has(event.operationId)) continue;
        seenInLedger.add(event.operationId);
        const priorEventId = operations.get(event.operationId);
        if (priorEventId) {
          const prior = events.get(priorEventId)!;
          if (prior.eventId !== event.eventId || prior.receiptId !== event.receiptId || prior.version !== event.version || prior.state !== event.state) {
            prior.status = 'anomalous';
            record('IDEMPOTENCY_CONFLICT', { ledgerSequence: ledger.sequence, operationId: event.operationId });
            throw Object.assign(new Error('Idempotency conflict.'), { code: 'IDEMPOTENCY_CONFLICT' });
          }
          continue;
        }
        const receiptEvents = [...events.values()].filter((candidate) => candidate.receiptId === event.receiptId && candidate.status !== 'unknown');
        const latestVersion = Math.max(0, ...receiptEvents.map((candidate) => candidate.version));
        if (event.version !== latestVersion + 1) {
          record('EVENT_VERSION_GAP', { ledgerSequence: ledger.sequence, operationId: event.operationId });
          throw Object.assign(new Error('Receipt event version is not contiguous.'), { code: 'EVENT_VERSION_GAP' });
        }
        events.set(event.eventId, { ...event, ledgerSequence: ledger.sequence, ledgerHash: ledger.hash, closedAt: ledger.closedAt, status: 'pending' });
        operations.set(event.operationId, event.eventId);
      }
      ledgers.set(ledger.sequence, { ...ledger, events: [...ledger.events] });
      cursor = { sequence: ledger.sequence, hash: ledger.hash };
      refreshFinality();
    },
    resolveUnknown(operationId, outcome) {
      const match = [...events.values()].find((event) => event.operationId === operationId);
      if (!match || match.status !== 'unknown') {
        record('UNKNOWN_RESOLUTION_REJECTED', { operationId });
        throw Object.assign(new Error('Operation is not awaiting reconciliation.'), { code: 'UNKNOWN_RESOLUTION_REJECTED' });
      }
      if (outcome === 'confirmed') {
        const canonical = ledgers.get(match.ledgerSequence);
        if (!canonical || canonical.hash !== match.ledgerHash) {
          record('NON_CANONICAL_CONFIRMATION_REJECTED', { operationId });
          throw Object.assign(new Error('Cannot confirm a non-canonical event.'), { code: 'NON_CANONICAL_CONFIRMATION_REJECTED' });
        }
        match.status = 'confirmed';
        operations.set(operationId, match.eventId);
      } else {
        events.delete(match.eventId);
      }
    },
    getEvent(operationId) { return [...events.values()].find((event) => event.operationId === operationId); },
    getReceiptTimeline(receiptId) { return [...events.values()].filter((event) => event.receiptId === receiptId).sort((left, right) => left.version - right.version).map((event) => ({ ...event })); },
    getCursor() { return cursor ? { ...cursor } : null; },
    getAudit() { return audit.map((entry) => ({ ...entry })); },
  };
}

export async function reconcileWithBoundedRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; retryable?: (error: unknown) => boolean } = {},
): Promise<{ status: 'resolved'; value: T; attempts: number } | { status: 'unknown'; attempts: number; code: 'RETRY_EXHAUSTED' }> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 8));
  const retryable = options.retryable ?? (() => true);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return { status: 'resolved', value: await operation(), attempts: attempt }; }
    catch (error) {
      if (!retryable(error) || attempt === attempts) return { status: 'unknown', attempts: attempt, code: 'RETRY_EXHAUSTED' };
    }
  }
  return { status: 'unknown', attempts, code: 'RETRY_EXHAUSTED' };
}
