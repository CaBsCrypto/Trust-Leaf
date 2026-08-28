import assert from 'node:assert/strict';
import { createInMemorySyntheticOffchainVault, createLocalSyntheticKeyProvider, opaqueReceiptId, type SyntheticLifecycleState } from '../api/_lib/synthetic-offchain-vault.ts';
import { createSyntheticReceiptStore, SYNTHETIC_RECEIPT_TOKEN } from '../shared/receipt-demo-contract.ts';
import { createSyntheticReceiptLedger } from '../api/_lib/receipt-ledger.ts';
import { createReceiptService } from '../api/_lib/receipt-service.ts';

const id = opaqueReceiptId(Buffer.alloc(32, 7));
const vault = createInMemorySyntheticOffchainVault(createLocalSyntheticKeyProvider(Buffer.alloc(32, 9)));
const write = (state: SyntheticLifecycleState, version: number, remaining: number, expected: number | null) =>
  vault.put(id, expected, { fixture: true, state, version, syntheticUnitsRemaining: remaining });

write('active', 2, 2, null);
assert.equal(vault.get(id)?.state, 'active');
const serialized = JSON.stringify(vault.envelope(id));
assert.equal(serialized.includes('syntheticUnitsRemaining'), false);
assert.equal(serialized.includes('active'), false);
assert.match(vault.envelope(id)!.keyAlias, /^trustleaf-/);
assert.throws(() => vault.put(opaqueReceiptId(Buffer.alloc(32, 8)), null, {
  fixture: true, state: 'active', version: 1, syntheticUnitsRemaining: 1, patientName: 'fixture-forbidden',
} as never), /FORBIDDEN_DATA_FIELD/);

write('partial', 3, 1, 2);
assert.throws(() => write('dispensed', 4, 0, 2), /VERSION_CONFLICT/);
write('dispensed', 4, 0, 3);
assert.equal(vault.get(id)?.state, 'dispensed');

const patientQr = vault.issueQr(id, 'patient', 1_000, 60_000);
assert.equal(vault.consumeQr(patientQr, 'dispensary', 1_001), null);
assert.equal(vault.consumeQr(patientQr, 'patient', 1_001), id);
assert.equal(vault.consumeQr(patientQr, 'patient', 1_002), null);
const expiredQr = vault.issueQr(id, 'patient', 2_000, 10);
assert.equal(vault.consumeQr(expiredQr, 'patient', 2_011), null);

for (const terminal of ['revoked', 'expired'] as const) {
  const terminalId = opaqueReceiptId(Buffer.alloc(32, terminal === 'revoked' ? 11 : 12));
  vault.put(terminalId, null, { fixture: true, state: terminal, version: 3, syntheticUnitsRemaining: 2 });
  assert.equal(vault.get(terminalId)?.state, terminal);
}

const store = createSyntheticReceiptStore();
const service = createReceiptService(createSyntheticReceiptLedger(store));
store.apply({ kind: 'issue', operationId: 'trustleaf-issue-001' });
assert.equal((await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'trustleaf-qr-active')).status, 'active');
store.apply({ kind: 'dispense-partial', units: 1, operationId: 'trustleaf-partial-001' });
assert.equal((await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'trustleaf-qr-partial')).status, 'active');
const beforeReplay = store.read();
store.apply({ kind: 'dispense-partial', units: 1, operationId: 'trustleaf-partial-001' });
assert.deepEqual(store.read(), beforeReplay);
store.apply({ kind: 'dispense-partial', units: 1, operationId: 'trustleaf-dispensed-001' });
assert.equal(store.read().state, 'dispensed');
assert.deepEqual(Object.keys(await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'trustleaf-qr-final')).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);

console.log('testnet-e2e-data-qa: encrypted opaque local mapping, active/partial/dispensed/revoked/expired, QR privacy/replay and CAS passed');
