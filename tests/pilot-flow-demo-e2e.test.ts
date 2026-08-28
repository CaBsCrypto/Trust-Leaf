import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INITIAL_PILOT_FLOW,
  advancePilotFlow,
  type PilotAction,
  type PilotFlowState,
} from '../src/features/pilot-flow/pilotFlowMachine.ts';
import { PILOT_PHASES, PILOT_QR_HANDLE, pilotPublicProjection } from '../src/features/pilot-flow/pilotFlowFixtures.ts';

const journey: PilotAction[] = [
  { type: 'doctor-request-access', actor: 'doctor' },
  { type: 'admin-approve-doctor', actor: 'admin' },
  { type: 'doctor-publish-availability', actor: 'doctor' },
  { type: 'patient-book', actor: 'patient' },
  { type: 'doctor-complete-consultation', actor: 'doctor', consent: true, syntheticEligible: true },
  { type: 'doctor-prepare-receipt', actor: 'doctor' },
  { type: 'patient-open-directory', actor: 'patient' },
  { type: 'dispensary-record-partial', actor: 'dispensary', qrHandle: PILOT_QR_HANDLE },
  { type: 'dispensary-record-total', actor: 'dispensary', qrHandle: PILOT_QR_HANDLE },
  { type: 'admin-open-audit', actor: 'admin' },
];

const expectedPhases = [
  'doctor-requested',
  'doctor-operational',
  'availability-published',
  'appointment-booked',
  'consultation-complete',
  'receipt-active',
  'directory-enabled',
  'dispense-partial',
  'dispense-complete',
  'admin-audit',
];

let state: PilotFlowState = INITIAL_PILOT_FLOW;
journey.forEach((action, index) => {
  state = advancePilotFlow(state, action);
  assert.equal(state.phase, expectedPhases[index], `transition ${index + 1} must reach its expected phase`);
  assert.equal(state.version, index + 1);
  assert.equal(state.lastError, null);
});
assert.equal(state.audit.length, 10);
assert.deepEqual(state.audit.map(entry => entry.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const assertRejected = (start: PilotFlowState, action: PilotAction, message: RegExp) => {
  const result = advancePilotFlow(start, action);
  assert.equal(result.phase, start.phase);
  assert.equal(result.version, start.version);
  assert.deepEqual(result.audit, start.audit);
  assert.match(result.lastError ?? '', message);
};

assertRejected(INITIAL_PILOT_FLOW, { type: 'doctor-request-access', actor: 'patient' }, /rol activo/);
assertRejected(INITIAL_PILOT_FLOW, { type: 'admin-approve-doctor', actor: 'admin' }, /fuera de orden/);

const booked = journey.slice(0, 4).reduce(advancePilotFlow, INITIAL_PILOT_FLOW);
assertRejected(booked, { type: 'doctor-complete-consultation', actor: 'doctor', consent: false, syntheticEligible: true }, /Consentimiento/);
assertRejected(booked, { type: 'doctor-complete-consultation', actor: 'doctor', consent: true, syntheticEligible: false }, /Consentimiento/);

const directory = journey.slice(0, 7).reduce(advancePilotFlow, INITIAL_PILOT_FLOW);
assertRejected(directory, { type: 'dispensary-record-partial', actor: 'dispensary', qrHandle: `${PILOT_QR_HANDLE}tampered` }, /QR inválido/);

const complete = journey.slice(0, 9).reduce(advancePilotFlow, INITIAL_PILOT_FLOW);
assertRejected(complete, { type: 'dispensary-record-total', actor: 'dispensary', qrHandle: PILOT_QR_HANDLE }, /fuera de orden/);
assertRejected(complete, { type: 'reset', actor: 'doctor' }, /Sólo el rol admin/);
assert.deepEqual(advancePilotFlow(complete, { type: 'reset', actor: 'admin' }), INITIAL_PILOT_FLOW);

assert.equal(PILOT_PHASES.length, 11, 'step 9 deliberately has partial and total snapshots');
assert.deepEqual([...new Set(PILOT_PHASES.map(item => item.journeyStep))], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(pilotPublicProjection('directory-enabled', PILOT_QR_HANDLE), { demo: true, evidenceExists: true, proofMatches: true, status: 'active' });
assert.deepEqual(pilotPublicProjection('dispense-partial', PILOT_QR_HANDLE), { demo: true, evidenceExists: true, proofMatches: true, status: 'active' });
assert.deepEqual(pilotPublicProjection('dispense-complete', PILOT_QR_HANDLE), { demo: true, evidenceExists: true, proofMatches: true, status: 'unavailable' });
assert.deepEqual(pilotPublicProjection('directory-enabled', `${PILOT_QR_HANDLE}.altered`), { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });

const app = readFileSync(new URL('../src/PublicDemoApp.tsx', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/features/pilot-flow/PilotFlowPage.tsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/features/pilot-flow/pilotFlowMachine.ts', import.meta.url), 'utf8');
const fixtures = readFileSync(new URL('../src/features/pilot-flow/pilotFlowFixtures.ts', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../docs/internal/pilot-flow-visual-review-runbook.md', import.meta.url), 'utf8');
const blueprint = readFileSync(new URL('../docs/internal/pilot-flow-visual-blueprint.md', import.meta.url), 'utf8');

assert.match(app, /\/demo\/pilot-flow/);
assert.match(app, /ReceiptPilotFlow/);
assert.match(entry, /import PublicDemoApp from '\.\/PublicDemoApp'/);
assert.doesNotMatch(entry, /App\.tsx/);
assert.match(ui, /aria-label="Rol activo"/);
assert.match(ui, /role="progressbar"/);
assert.match(ui, /role="alert"/);
assert.match(ui, /Reiniciar fixtures/);
assert.match(ui, /disabled=\{activeRole !== 'admin'\}/);
assert.match(ui, /dispatch\(\{ type: 'reset', actor: activeRole \}\)/);
assert.match(ui, /Consentimiento demo confirmado/);
assert.match(ui, /Decisión sintética marcada/);
assert.match(ui, /Manipulado · prueba negativa/);
assert.match(ui, /Reintentar verificación/);
assert.match(ui, /qrAttempted && state\.lastError/);
assert.match(ui, /Intentar reutilizar QR · negativo/);
assert.match(ui, /data-public-verification-status/);
assert.match(ui, /actor_doc_A7k…R2/);
assert.match(ui, /actor_store_Q4m…T8/);
assert.match(ui, /aria-live="polite"/);
assert.match(ui, /proyección pública existente devuelve únicamente existencia, coincidencia y estado/);
assert.match(ui, /ReceiptLedger V1/);
assert.match(ui, /Evidencia histórica separada/);
assert.match(ui, /ReceiptLedgerV2/);
assert.match(ui, /Evidencia Testnet pendiente/);
assert.match(runbook, /\/demo\/pilot-flow/);
assert.match(blueprint, /TrustRegistry/);
assert.match(blueprint, /ReceiptLedgerV2/);
assert.match(globalStyles, /prefers-reduced-motion:\s*reduce/);

for (const productSurface of [ui, fixtures]) {
  assert.doesNotMatch(productSurface, /\bRUT\b|e-?mail|wallet|diagn[oó]stico|dosis|gram(?:o|os|aje)|legalmente v[aá]lid|autenticidad inmutable/i);
}

assert.doesNotMatch(fixtures, /from '\.\/pilotFlowMachine/);

for (const source of [ui, model, fixtures, runbook, blueprint]) {
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendTransaction|signTransaction|secret.?key|seed phrase/i);
  assert.doesNotMatch(source, /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b|@(?:gmail|outlook|hotmail)\./i);
}

console.log('pilot-flow-demo-e2e: 10-step journey, role gates, privacy negatives and isolated route passed');
