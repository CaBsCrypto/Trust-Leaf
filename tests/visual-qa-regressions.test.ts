import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoPublicReceiptVerifier, resetPublicVerificationDemoState } from '../src/lib/publicVerification.ts';
import { sharedSyntheticReceiptStore, SYNTHETIC_RECEIPT_TOKEN } from '../shared/receipt-demo-contract.ts';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const pilot = readFileSync(new URL('../src/components/ReceiptPilotFlow.tsx', import.meta.url), 'utf8');
const trustAuth = readFileSync(new URL('../src/lib/trustAuth.ts', import.meta.url), 'utf8');

resetPublicVerificationDemoState();
const receipt = sharedSyntheticReceiptStore.read();
assert.equal(receipt.state, 'active', 'the synthetic patient QR fixture must be active');
const publicResult = await demoPublicReceiptVerifier.verify(SYNTHETIC_RECEIPT_TOKEN, 'visual-qa-active-qr');
assert.deepEqual(publicResult, { demo: true, evidenceExists: true, proofMatches: true, status: 'active' });
assert.deepEqual(Object.keys(publicResult).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);

assert.match(pilot, /onVerify: \(token: string\) => void/, 'pilot must use SPA navigation supplied by App');
assert.match(pilot, /onVerify\(view\.publicToken!\)/, 'patient action must pass only the opaque token');
assert.doesNotMatch(pilot, /href=\{`\/verify\//, 'patient QR action must not reload and reset the in-memory fixture');
assert.match(app, /onVerify=\{\(token\) => navigate\(`\/verify\//, 'App must preserve shared state during verifier navigation');

const adminGateStart = app.indexOf('function AdminAuthGate(');
const adminGateEnd = app.indexOf('\nfunction ', adminGateStart + 1);
assert.ok(adminGateStart >= 0 && adminGateEnd > adminGateStart, 'AdminAuthGate source must be discoverable');
const adminGate = app.slice(adminGateStart, adminGateEnd);
assert.doesNotMatch(adminGate, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'public admin gate must not expose an email address');
assert.doesNotMatch(adminGate, /Email con permisos/i, 'public admin gate must not advertise authorization configuration');
assert.match(adminGate, /lista administrativa privada/, 'public gate should describe authorization without identifying an account');
assert.doesNotMatch(trustAuth, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'client auth module must not embed an administrative email');
assert.doesNotMatch(trustAuth, /user\.email\?\.toLowerCase\(\)\s*===/, 'email identity must not bypass the private allowlist');
assert.match(trustAuth, /getDoc\(doc\(db, 'appAdministrators', user\.uid\)\)/, 'admin authorization must fail closed through the private UID allowlist');

console.log('visual-qa-regressions: active QR SPA navigation and non-identifying admin gate passed');
