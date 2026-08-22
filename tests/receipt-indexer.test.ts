import assert from 'node:assert/strict';
import { createSimulatedReceiptIndexer, reconcileWithBoundedRetry, type OpaqueReceiptEvent } from '../api/_lib/receipt-indexer.ts';

const hash = (digit: string) => digit.repeat(64);
const receiptId = 'opaque_receipt_01';
const event = (version: number, state: OpaqueReceiptEvent['state'], suffix = String(version)): OpaqueReceiptEvent => ({
  eventId: `opaque_event_${suffix.padStart(4, '0')}`,
  receiptId,
  operationId: `opaque_operation_${suffix.padStart(4, '0')}`,
  version,
  state,
});
const ledger = (sequence: number, ledgerHash: string, parentHash: string, events: OpaqueReceiptEvent[] = []) => ({ sequence, hash: ledgerHash, parentHash, closedAt: 1_700_000_000 + sequence, events });

const indexer = createSimulatedReceiptIndexer({ finalityDepth: 2 });
indexer.ingest(ledger(1, hash('1'), hash('0'), [event(1, 'issued')]));
assert.equal(indexer.getEvent('opaque_operation_0001')?.status, 'pending');
indexer.ingest(ledger(2, hash('2'), hash('1'), [event(2, 'active')]));
assert.equal(indexer.getEvent('opaque_operation_0001')?.status, 'confirmed');
assert.equal(indexer.getEvent('opaque_operation_0002')?.status, 'pending');
assert.deepEqual(indexer.getCursor(), { sequence: 2, hash: hash('2') });

indexer.ingest(ledger(2, hash('2'), hash('1'), [event(2, 'active')]));
assert.equal(indexer.getReceiptTimeline(receiptId).length, 2, 'same ledger replay must be idempotent');
assert.throws(() => indexer.ingest(ledger(4, hash('4'), hash('3'))), (error: any) => error.code === 'LEDGER_GAP');
assert.deepEqual(indexer.getCursor(), { sequence: 2, hash: hash('2') }, 'gap must not advance cursor');
assert.throws(() => indexer.ingest(ledger(3, hash('3'), hash('9'))), (error: any) => error.code === 'PARENT_HASH_MISMATCH');

indexer.ingest(ledger(3, hash('3'), hash('2'), [event(3, 'partial')]));
indexer.ingest(ledger(3, hash('a'), hash('2'), [event(3, 'revoked', 'fork')]));
assert.equal(indexer.getEvent('opaque_operation_0003')?.status, 'unknown', 'orphan event remains explicit unknown evidence');
assert.equal(indexer.getEvent('opaque_operation_fork')?.status, 'pending');
assert.deepEqual(indexer.getCursor(), { sequence: 3, hash: hash('a') });
assert.throws(() => indexer.resolveUnknown('opaque_operation_0003', 'confirmed'), (error: any) => error.code === 'NON_CANONICAL_CONFIRMATION_REJECTED');
indexer.resolveUnknown('opaque_operation_0003', 'absent');
assert.equal(indexer.getEvent('opaque_operation_0003'), undefined);

assert.throws(() => indexer.ingest(ledger(4, hash('4'), hash('a'), [{ ...event(4, 'dispensed'), operationId: 'opaque_operation_fork' }])), (error: any) => error.code === 'IDEMPOTENCY_CONFLICT');
assert.equal(indexer.getEvent('opaque_operation_fork')?.status, 'pending', 'failed ingest must not mutate prior event');
assert.throws(() => indexer.ingest(ledger(4, hash('4'), hash('a'), [event(7, 'dispensed', 'gap')])), (error: any) => error.code === 'EVENT_VERSION_GAP');

const atomic = createSimulatedReceiptIndexer();
assert.throws(
  () => atomic.ingest(ledger(1, hash('b'), hash('0'), [event(1, 'issued', 'atomic1'), event(7, 'dispensed', 'atomic7')])),
  (error: any) => error.code === 'EVENT_VERSION_GAP',
);
assert.equal(atomic.getCursor(), null, 'invalid ledger must not advance cursor');
assert.equal(atomic.getReceiptTimeline(receiptId).length, 0, 'v1 must not leak from rejected v1+v7 ledger');
assert.equal(atomic.getEvent('opaque_operation_atomic1'), undefined, 'operation index must commit atomically');

const returned = indexer.getEvent('opaque_operation_0001');
assert.ok(returned);
returned.status = 'anomalous';
returned.state = 'revoked';
assert.equal(indexer.getEvent('opaque_operation_0001')?.status, 'confirmed', 'getEvent must return a defensive copy');
assert.equal(indexer.getEvent('opaque_operation_0001')?.state, 'issued', 'caller mutation must not alter indexed event');

const unsafe = JSON.stringify(indexer.getAudit());
assert.equal(unsafe.includes('opaque_operation_'), false, 'audit must contain only redacted operation references');
assert.ok(indexer.getAudit().some((entry) => entry.code === 'REORG_ROLLBACK'));

let calls = 0;
const resolved = await reconcileWithBoundedRetry(async () => { calls += 1; if (calls < 3) throw new Error('timeout containing secret=never-log'); return 'canonical'; }, { attempts: 3 });
assert.deepEqual(resolved, { status: 'resolved', value: 'canonical', attempts: 3 });
calls = 0;
const unknown = await reconcileWithBoundedRetry(async () => { calls += 1; throw new Error('rpc unavailable'); }, { attempts: 2 });
assert.deepEqual(unknown, { status: 'unknown', attempts: 2, code: 'RETRY_EXHAUSTED' });
assert.equal(calls, 2, 'retry must be bounded');
const terminal = await reconcileWithBoundedRetry(async () => { throw Object.assign(new Error('forbidden'), { code: 'AUTH' }); }, { attempts: 8, retryable: (error: any) => error.code !== 'AUTH' });
assert.deepEqual(terminal, { status: 'unknown', attempts: 1, code: 'RETRY_EXHAUSTED' });

console.log('receipt-indexer: cursor, finality, gaps, reorg, idempotency, unknown and redacted audit passed');
