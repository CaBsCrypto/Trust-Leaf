import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { createLocalFileDurableReceiptIndexerStore, createMemoryDurableReceiptIndexerStore } from '../api/_lib/durable-readonly-receipt-indexer.ts';
import { createStellarV2ReadonlyIndexer, createStellarV2RpcReadonlyTransport, validateStellarV2ReadonlyIndexerConfig, type StellarV2ReadonlyIndexerConfig, type StellarV2ReadonlyTransport } from '../api/_lib/stellar-v2-readonly-indexer.ts';

const contractId = `C${'A'.repeat(55)}`;
const rpcUrl = 'https://soroban-testnet.stellar.org';
const wasm = Buffer.from('synthetic receipt ledger v2 wasm fixture');
const wasmSha256 = createHash('sha256').update(wasm).digest('hex');
const config: StellarV2ReadonlyIndexerConfig = {
  mode: 'testnet-readonly', network: 'testnet', networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl, allowedRpcUrls: [rpcUrl], receiptContractId: contractId, allowedContractIds: [contractId],
  receiptWasmSha256: wasmSha256, allowedWasmSha256: [wasmSha256], startLedger: 10,
  timeoutMs: 100, retryAttempts: 3, finalityDepth: 2, submissionEnabled: false, mutationsAllowed: false,
};
validateStellarV2ReadonlyIndexerConfig(config);
for (const candidate of [
  { ...config, rpcUrl: 'https://evil.invalid' }, { ...config, receiptContractId: `C${'B'.repeat(55)}` },
  { ...config, receiptWasmSha256: 'f'.repeat(64) }, { ...config, networkPassphrase: 'Public Global Stellar Network ; September 2015' },
  { ...config, submissionEnabled: true as false }, { ...config, mutationsAllowed: true as false },
]) assert.throws(() => validateStellarV2ReadonlyIndexerConfig(candidate));

const receiptBytes = Buffer.alloc(32, 1);
const event = (sequence: number, state: number, version: number) => ({
  id: `event-${sequence}-${version}`, ledger: sequence, ledgerClosedAt: '2026-08-25T12:00:00Z', transactionIndex: 1,
  operationIndex: 1, type: 'contract', contractId: { contractId: () => contractId }, txHash: String(sequence).repeat(64).slice(0, 64),
  inSuccessfulContractCall: true, topic: [nativeToScVal('ReceiptChanged', { type: 'symbol' })],
  value: nativeToScVal([2, receiptBytes, state, version, Buffer.alloc(32, 3), Buffer.alloc(32, 4), Buffer.alloc(32, 5), Buffer.alloc(32, version + 1), `G${'A'.repeat(55)}`]),
});
let ledgerRound = 0, networkCalls = 0;
const server = {
  async getNetwork() { networkCalls += 1; return { passphrase: config.networkPassphrase, protocolVersion: '25' }; },
  async getContractWasmByContractId() { networkCalls += 1; return wasm; },
  async getLedgers() {
    ledgerRound += 1;
    const parent = { sequence: 9, hash: '9'.repeat(64), ledgerCloseTime: '2026-08-25T11:59:55Z' };
    if (ledgerRound === 1) return { latestLedger: 10, ledgers: [parent, { sequence: 10, hash: 'a'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:00Z' }] };
    if (ledgerRound === 2) return { latestLedger: 10, ledgers: [parent, { sequence: 10, hash: 'b'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:01Z' }] };
    return { latestLedger: 11, ledgers: [parent, { sequence: 10, hash: 'b'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:01Z' }, { sequence: 11, hash: 'c'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:06Z' }] };
  },
  async getEvents(request: { startLedger?: number }) {
    const sequence = request.startLedger ?? 10;
    return { cursor: `cursor-${ledgerRound}`, events: [event(sequence, sequence === 11 ? 2 : 1, sequence === 11 ? 2 : 1)] };
  },
};
const transport = createStellarV2RpcReadonlyTransport({ rpcUrl, contractId, startLedger: 10, server: server as never });
assert.equal(networkCalls, 0, 'transport construction must be lazy');
const stateDirectory = await mkdtemp(join(tmpdir(), 'trustleaf-v2-indexer-'));
try {
  const store = createLocalFileDurableReceiptIndexerStore({ stateDirectory, lockDelayMs: 1 });
  const service = createStellarV2ReadonlyIndexer({ config, transport, store, metrics: { increment() {} }, wait: async () => undefined });
  assert.equal((await service.start()).attested, true);
  assert.equal(networkCalls, 2);
  const firstPoll = await service.pollOnce();
  assert.equal(firstPoll.pollStatus, 'ingested', JSON.stringify(firstPoll));
  assert.equal(service.getCursor()?.hash, 'a'.repeat(64));
  assert.equal((await service.pollOnce()).pollStatus, 'ingested');
  assert.equal(service.getCursor()?.hash, 'b'.repeat(64), 'tip reorg must replace canonical ledger');
  assert.equal((await service.pollOnce()).pollStatus, 'ingested');
  assert.deepEqual(service.getReceiptTimeline(receiptBytes.toString('hex')).map(item => item.state), ['issued', 'active']);
  const journal = await readFile(join(stateDirectory, 'receipt-indexer-v2.json'), 'utf8');
  for (const forbidden of ['http', '@', 'secret']) assert.equal(journal.toLowerCase().includes(forbidden), false);
  const restarted = createStellarV2ReadonlyIndexer({ config, transport, store: createLocalFileDurableReceiptIndexerStore({ stateDirectory }), metrics: { increment() {} } });
  await restarted.start();
  assert.equal(restarted.getCursor()?.sequence, 11, 'durable cursor must recover after restart');
} finally { await rm(stateDirectory, { recursive: true, force: true }); }

const fixture: StellarV2ReadonlyTransport = { kind: 'fixture', async attest() { return { networkPassphrase: config.networkPassphrase, contractId, wasmSha256 }; }, async fetchNext() { return { status: 'caught_up' }; } };
assert.throws(() => createStellarV2ReadonlyIndexer({ config, transport: fixture, store: createMemoryDurableReceiptIndexerStore(), metrics: { increment() {} } }), (error: any) => error.code === 'REAL_SOURCE_REQUIRED');
let attempts = 0;
const retryTransport: StellarV2ReadonlyTransport = { kind: 'fixture', async attest() { return { networkPassphrase: config.networkPassphrase, contractId, wasmSha256 }; }, async fetchNext() { attempts += 1; throw Object.assign(new Error('patient@example.test secret'), { code: 'RPC_UNAVAILABLE' }); } };
const retry = createStellarV2ReadonlyIndexer({ config: { ...config, mode: 'fixture' }, transport: retryTransport, store: createMemoryDurableReceiptIndexerStore(), metrics: { increment() {} }, wait: async () => undefined });
await retry.start();
const unknown = await retry.pollOnce();
assert.equal(unknown.pollStatus, 'unknown'); assert.equal(attempts, 3); assert.equal(unknown.retryAttempts, 3);
const serialized = JSON.stringify(unknown);
for (const forbidden of ['@', 'secret', contractId, rpcUrl]) assert.equal(serialized.includes(forbidden), false);
const mismatch: StellarV2ReadonlyTransport = { ...fixture, async attest() { return { networkPassphrase: config.networkPassphrase, contractId, wasmSha256: 'f'.repeat(64) }; } };
const rejected = createStellarV2ReadonlyIndexer({ config: { ...config, mode: 'fixture' }, transport: mismatch, store: createMemoryDurableReceiptIndexerStore(), metrics: { increment() {} } });
assert.equal((await rejected.start()).pollStatus, 'rejected');
await assert.rejects(() => rejected.pollOnce(), (error: any) => error.code === 'INDEXER_NOT_ATTESTED');
console.log('stellar-v2-readonly-indexer: allowlists, attestation, durable cursor, V2 decode, tip reorg, retry and redaction passed');
