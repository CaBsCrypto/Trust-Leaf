import assert from 'node:assert/strict';
import { createSimulatedReceiptIndexer } from '../api/_lib/receipt-indexer.ts';
import { createReceiptEventSource } from '../api/_lib/stellar-receipt-event-source.ts';
import { syntheticContractId } from '../api/_lib/simulated-testnet-adapter.ts';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { createStellarRpcReceiptEventTransport } from '../api/_lib/stellar-receipt-event-source.ts';
const contractId = syntheticContractId(), indexer = createSimulatedReceiptIndexer({ finalityDepth: 2 });
const counts: Record<string, number> = {}; const metrics = { increment(name: string) { counts[name] = (counts[name] ?? 0) + 1; } } as any;
const source = createReceiptEventSource({ mode: 'fixture', contractId, metrics, ingest: indexer.ingest, getCursor: indexer.getCursor, transport: { kind: 'fixture', async fetchNext() { return { status: 'ledger', contractId, schemaVersion: 1, ledger: { sequence: 1, hash: '1'.repeat(64), parentHash: '0'.repeat(64), closedAt: 1, events: [{ eventId: 'opaque_event_0001', receiptId: 'opaque_receipt_0001', operationId: 'opaque_operation_0001', version: 1, state: 'issued' }] } }; } } });
assert.equal((await source.pollOnce()).status, 'ingested'); assert.equal(counts.ledger_ingested, 1); assert.equal(indexer.getCursor()?.sequence, 1);
const rejected = createReceiptEventSource({ mode: 'fixture', contractId, metrics, ingest: indexer.ingest, getCursor: indexer.getCursor, transport: { kind: 'fixture', async fetchNext() { return { status: 'ledger', contractId: `C${'B'.repeat(55)}`, schemaVersion: 1, ledger: { sequence: 2, hash: '2'.repeat(64), parentHash: '1'.repeat(64), closedAt: 2, events: [] } }; } } });
await assert.rejects(() => rejected.pollOnce(), (error: any) => error.code === 'EVENT_SOURCE_ALLOWLIST_REJECTED'); assert.equal(indexer.getCursor()?.sequence, 1);
const timeout = createReceiptEventSource({ mode: 'fixture', contractId, timeoutMs: 2, metrics, ingest: indexer.ingest, getCursor: indexer.getCursor, transport: { kind: 'fixture', async fetchNext() { return new Promise(() => undefined); } } });
assert.equal((await timeout.pollOnce()).status, 'unknown'); assert.equal(counts.source_unknown, 1);
assert.throws(() => createReceiptEventSource({ mode: 'testnet', contractId, metrics, ingest: indexer.ingest, getCursor: indexer.getCursor, transport: { kind: 'fixture', async fetchNext() { return { status: 'caught_up' }; } } }), (error: any) => error.code === 'REAL_SOURCE_REQUIRED');
const rpcTransport = createStellarRpcReceiptEventTransport({ rpcUrl: 'https://soroban-testnet.stellar.org', contractId, startLedger: 10, server: {
  async getLedgers() { return { ledgers: [{ sequence: 10, hash: 'a'.repeat(64), ledgerCloseTime: '2026-08-22T00:00:00Z' }], latestLedger: 10 }; },
  async getEvents() { return { events: [{ id: 'event-1', contractId: { contractId: () => contractId }, txHash: 'b'.repeat(64), inSuccessfulContractCall: true, topic: [nativeToScVal('Issued', { type: 'symbol' })], value: nativeToScVal([1, Buffer.alloc(32, 1), 1, Buffer.alloc(32, 2), Buffer.alloc(32, 3), 'actor']) }] }; },
} as any });
const decoded = await rpcTransport.fetchNext(null, 5_000);
assert.equal(decoded.status, 'ledger');
if (decoded.status === 'ledger') { assert.equal(decoded.schemaVersion, 1); assert.equal(decoded.ledger.events[0].state, 'issued'); assert.equal(decoded.ledger.events[0].receiptId, '01'.repeat(32)); }
let ledgerRequest: any;
const initialCheckpoint = createStellarRpcReceiptEventTransport({ rpcUrl: 'https://soroban-testnet.stellar.org', contractId, startLedger: 10, server: {
  async getLedgers(request: any) { ledgerRequest = request; return { ledgers: [{ sequence: 9, hash: '9'.repeat(64), ledgerCloseTime: '2026-08-21T23:59:55Z' }, { sequence: 10, hash: 'a'.repeat(64), ledgerCloseTime: '2026-08-22T00:00:00Z' }], latestLedger: 10 }; },
  async getEvents() { return { events: [] }; },
} as any });
assert.equal((await initialCheckpoint.fetchNext(null, 5_000)).status, 'ledger', 'initial checkpoint must not report caught_up when the requested ledger follows its parent');
assert.equal(ledgerRequest.pagination.limit, 2, 'initial checkpoint must fetch parent and requested ledger');
console.log('stellar receipt event source passed');
