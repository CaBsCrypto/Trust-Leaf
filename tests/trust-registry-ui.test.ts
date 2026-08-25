import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRUST_CHAIN_SCENARIOS,
  parseTrustChainScenario,
  trustChainSearch,
  type TrustChainScenario,
} from '../src/lib/trustRegistryReview.ts';

const REQUIRED_SCENARIOS: readonly TrustChainScenario[] = [
  'doctor-validated',
  'doctor-suspended',
  'dispensary-validated',
  'dispensary-expired',
  'patient-eligible',
  'eligibility-revoked',
  'receipt-issued',
  'receipt-active',
  'receipt-partial',
  'receipt-dispensed',
  'receipt-revoked',
  'admin-audit',
];

for (const scenario of REQUIRED_SCENARIOS) {
  const fixture = TRUST_CHAIN_SCENARIOS[scenario];
  assert.equal(fixture.scenario, scenario);
  assert.ok(fixture.actorRole);
  assert.ok(fixture.stepLabel);
  assert.ok(fixture.outcomeLabel);
  assert.ok(fixture.expectedEvent);
  assert.ok(fixture.credentials.length === 3);
  assert.ok(fixture.audit.length >= 1);
  assert.ok(fixture.receiptRef.startsWith('rcpt_v2_'));
}

assert.equal(TRUST_CHAIN_SCENARIOS.active.receiptState, 'active', 'legacy active deep-link remains compatible');
assert.equal(TRUST_CHAIN_SCENARIOS['doctor-validated'].credentials[0].state, 'active');
assert.equal(TRUST_CHAIN_SCENARIOS['doctor-suspended'].credentials[0].state, 'suspended');
assert.equal(TRUST_CHAIN_SCENARIOS['dispensary-validated'].credentials[2].state, 'active');
assert.equal(TRUST_CHAIN_SCENARIOS['dispensary-expired'].credentials[2].state, 'expired');
assert.equal(TRUST_CHAIN_SCENARIOS['patient-eligible'].credentials[1].state, 'active');
assert.equal(TRUST_CHAIN_SCENARIOS['eligibility-revoked'].credentials[1].state, 'revoked');

const receiptStates = ['issued', 'active', 'partial', 'dispensed', 'revoked'] as const;
for (const state of receiptStates) {
  assert.equal(TRUST_CHAIN_SCENARIOS[`receipt-${state}`].receiptState, state);
}

for (const scenario of ['doctor-suspended', 'dispensary-expired', 'eligibility-revoked', 'receipt-revoked'] as const) {
  assert.equal(TRUST_CHAIN_SCENARIOS[scenario].chainAllowed, false);
}

assert.deepEqual(TRUST_CHAIN_SCENARIOS['admin-audit'].audit.map(event => event.version), [1, 2, 3]);
assert.equal(parseTrustChainScenario('?scenario=receipt-partial'), 'receipt-partial');
assert.equal(parseTrustChainScenario('?scenario=forged'), 'active');
assert.equal(trustChainSearch('dispensary-expired'), '?scenario=dispensary-expired');

const ui = readFileSync(new URL('../src/components/TrustAuthorizationReview.tsx', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../soroban/contracts/trust-registry/src/lib.rs', import.meta.url), 'utf8');
const receiptV2 = readFileSync(new URL('../soroban/contracts/receipt-ledger-v2/src/lib.rs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

assert.match(app, /path === '\/demo\/trust-registry'/);
assert.match(ui, /Fixture local · sin deploy/);
assert.match(ui, /Evidencia Testnet V2 · pendiente/);
assert.match(ui, /No configurados; validar contra manifest aprobado/);
assert.match(ui, /Auditoría técnica mínima/);
assert.match(ui, /aria-live="polite"/);
assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|WebSocket|invokeContract|sendTransaction|signTransaction/i);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /:focus-visible/);

const serializedFixtures = JSON.stringify(TRUST_CHAIN_SCENARIOS);
for (const forbidden of [
  /@/,
  /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/,
  /diagnosis|diagnóstico|dose|dosis|gramaje|balance|wallet|address|secret|private.?key/i,
]) assert.doesNotMatch(serializedFixtures, forbidden);

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

console.log('trust-registry-ui: 12 role/state scenarios, evidence gate, accessibility and privacy checks passed');
