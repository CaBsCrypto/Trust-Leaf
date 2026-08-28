import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoPublicReceiptVerifier, resetPublicVerificationDemoState } from '../src/lib/publicVerification.ts';
import { sharedSyntheticReceiptStore, SYNTHETIC_RECEIPT_TOKEN } from '../shared/receipt-demo-contract.ts';

const app = readFileSync(new URL('../src/PublicDemoApp.tsx', import.meta.url), 'utf8');
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
assert.match(app, /onVerify=\{\(token\) => navigate\(`\/verify\//, 'public demo must preserve shared state during verifier navigation');
for (const forbiddenSurface of ['MockupPortal', 'trustData', 'firebase', 'localStorage', 'type="file"']) {
  assert.doesNotMatch(app, new RegExp(forbiddenSurface), `public UI must not include ${forbiddenSurface}`);
}
assert.doesNotMatch(trustAuth, /user\.email\?\.toLowerCase\(\)\s*===/, 'legacy client auth must not bypass a private allowlist');

console.log('visual-qa-regressions: active QR SPA navigation and non-identifying admin gate passed');
