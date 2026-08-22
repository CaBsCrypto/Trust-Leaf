import assert from 'node:assert/strict';
import { createSyntheticReceiptStore, SYNTHETIC_RECEIPT_TOKEN } from '../shared/receipt-demo-contract.ts';
import { createSyntheticReceiptLedger } from '../api/_lib/receipt-ledger.ts';
import { createReceiptService } from '../api/_lib/receipt-service.ts';

const forbidden = /remaining|unit|event|version|handle|patient|doctor|diagnos|dose|gram|wallet|address/i;
function assertMinimized(value: unknown) {
  assert.deepEqual(Object.keys(value as object).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);
  assert.equal(forbidden.test(JSON.stringify(value)), false);
}

const store = createSyntheticReceiptStore();
const service = createReceiptService(createSyntheticReceiptLedger(store));
assert.equal((await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'draft-read')).status, 'unavailable');
let receipt = store.apply({ kind: 'issue', operationId: 'issue-e2e' });
assert.equal(receipt.state, 'active');
assert.equal(receipt.version, 2);
assert.deepEqual(receipt.events.map(event => event.state), ['issued', 'active']);
let publicView = await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'active-read');
assert.equal(publicView.status, 'active');
assertMinimized(publicView);
let detail = await service.getOperational(receipt.handle, { authenticated: true, actorId: 'doctor-e2e', roles: ['doctor'], receiptHandles: [receipt.handle] });
assert.equal(detail.version, 2);
assert.equal(detail.remainingUnits, 2);

receipt = store.apply({ kind: 'dispense-partial', units: 1, operationId: 'partial-e2e' });
assert.equal(receipt.state, 'partial');
publicView = await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'partial-read');
assert.equal(publicView.status, 'active');
assertMinimized(publicView);
detail = await service.getOperational(receipt.handle, { authenticated: true, actorId: 'dispensary-e2e', roles: ['dispensary'], receiptHandles: [receipt.handle] });
assert.equal(detail.state, 'partial');
assert.equal(detail.remainingUnits, 1);
assert.deepEqual(store.apply({ kind: 'dispense-partial', units: 1, operationId: 'partial-e2e' }), receipt);

store.apply({ kind: 'revoke', operationId: 'revoke-e2e' });
publicView = await service.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'revoke-read');
assert.equal(publicView.status, 'revoked');
assertMinimized(publicView);

const expiryStore = createSyntheticReceiptStore();
expiryStore.apply({ kind: 'issue', operationId: 'issue-expiry' });
expiryStore.apply({ kind: 'expire', operationId: 'expire-e2e' });
const expiryService = createReceiptService(createSyntheticReceiptLedger(expiryStore));
const expired = await expiryService.verifyPublic(SYNTHETIC_RECEIPT_TOKEN, 'expire-read');
assert.equal(expired.status, 'expired');
assertMinimized(expired);
console.log('receipt-shared-state-e2e: issue/active, partial, revoke, expire, role detail and minimized public projection passed');
