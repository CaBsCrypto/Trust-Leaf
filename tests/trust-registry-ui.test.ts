import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRUST_CHAIN_SCENARIOS,
  parseTrustChainScenario,
  trustChainSearch,
} from '../src/lib/trustRegistryReview.ts';

assert.deepEqual(Object.keys(TRUST_CHAIN_SCENARIOS).sort(), [
  'active',
  'dispensary-expired',
  'doctor-suspended',
  'eligibility-revoked',
]);
assert.equal(TRUST_CHAIN_SCENARIOS.active.chainAllowed, true);
for (const scenario of ['doctor-suspended', 'eligibility-revoked', 'dispensary-expired'] as const) {
  assert.equal(TRUST_CHAIN_SCENARIOS[scenario].chainAllowed, false);
  assert.equal(TRUST_CHAIN_SCENARIOS[scenario].receiptState, 'blocked');
}
assert.equal(parseTrustChainScenario('?scenario=eligibility-revoked'), 'eligibility-revoked');
assert.equal(parseTrustChainScenario('?scenario=forged'), 'active');
assert.equal(trustChainSearch('dispensary-expired'), '?scenario=dispensary-expired');

const ui = readFileSync(new URL('../src/components/TrustAuthorizationReview.tsx', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../soroban/contracts/trust-registry/src/lib.rs', import.meta.url), 'utf8');
const receiptV2 = readFileSync(new URL('../soroban/contracts/receipt-ledger-v2/src/lib.rs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(app, /path === '\/demo\/trust-registry'/);
assert.match(ui, /IDL local · sin deploy/);
assert.match(ui, /Sin paciente en cadena/);
assert.match(ui, /Acción bloqueada fail-closed/);
assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|WebSocket|submit|invokeContract|sendTransaction/i);

for (const source of [registry, receiptV2]) {
  for (const forbidden of [
    /rut\s*:/i,
    /email\s*:/i,
    /diagnosis|diagnóstico/i,
    /dose|dosis/i,
    /gramaje|balance/i,
    /patient\s*:\s*Address/i,
    /patient_address/i,
  ]) assert.doesNotMatch(source, forbidden);
}

assert.match(registry, /pub fn issue_actor/);
assert.match(registry, /pub fn issue_eligibility/);
assert.match(registry, /pub fn is_active/);
assert.match(registry, /expected_version/);
assert.match(registry, /OperationConflict/);
assert.match(receiptV2, /Symbol::new\(env, "is_active"\)/);
assert.match(receiptV2, /doctor_credential_id/);
assert.match(receiptV2, /eligibility_credential_id/);
assert.match(receiptV2, /dispensary_credential_id/);
assert.doesNotMatch(receiptV2, /set_doctor|set_dispensary|DataKey::Doctor|DataKey::Dispensary/);

console.log('trust-registry-ui: opaque credential chain, fail-closed scenarios and no-write/privacy gates passed');
