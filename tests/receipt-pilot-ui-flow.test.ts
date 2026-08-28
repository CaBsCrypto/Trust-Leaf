import assert from 'node:assert/strict';
import { applyReceiptPilotOperation, createReceiptPilotFixture, publicReceiptProjection } from '../src/lib/receiptPilotDemo.ts';

let receipt = createReceiptPilotFixture();
assert.equal(publicReceiptProjection(receipt).evidenceExists, false);
receipt = applyReceiptPilotOperation(receipt, { kind: 'issue', operationId: 'issue-1' });
assert.equal(receipt.state, 'active');
assert.equal(receipt.version, 2);
assert.deepEqual(receipt.events.map(event => event.state), ['issued', 'active']);
const replay = applyReceiptPilotOperation(receipt, { kind: 'issue', operationId: 'issue-1' });
assert.deepEqual(replay, receipt, 'same operation must be idempotent');
receipt = applyReceiptPilotOperation(receipt, { kind: 'dispense-partial', units: 1, operationId: 'partial-1' });
assert.equal(receipt.state, 'partial');
assert.equal(receipt.remainingUnits, 1);
assert.equal(publicReceiptProjection(receipt).status, 'active', 'public view must not expose partial-dispensation history');
const invalid = applyReceiptPilotOperation(receipt, { kind: 'dispense-partial', units: 2, operationId: 'over-1' });
assert.deepEqual(invalid, receipt, 'over-dispensation must fail closed');
receipt = applyReceiptPilotOperation(receipt, { kind: 'dispense-partial', units: 1, operationId: 'partial-2' });
assert.equal(receipt.state, 'dispensed');
assert.equal(receipt.remainingUnits, 0);

const publicFields = Object.keys(publicReceiptProjection(receipt)).sort();
assert.deepEqual(publicFields, ['demo', 'evidenceExists', 'proofMatches', 'status']);
for (const forbidden of ['patient', 'doctor', 'diagnosis', 'dose', 'quantity', 'remainingUnits', 'wallet']) assert.ok(!publicFields.includes(forbidden));
console.log('receipt-pilot-ui-flow: state, idempotency, over-dispensation and public minimization checks passed');
