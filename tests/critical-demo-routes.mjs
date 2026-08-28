import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const server = read('server.ts');
const entry = read('src/main.tsx');
const publicApp = read('src/PublicDemoApp.tsx');
const doctorApi = read('api/stellar/doctor/issue-prescription.ts');
const adminApi = read('api/stellar/admin/[action].ts');
const dispensaryApi = read('api/stellar/dispensary/[action].ts');

for (const route of [
  '/api/stellar/doctor/issue-prescription',
  '/api/stellar/dispensary/dispense-prescription',
  '/api/stellar/dispensary/validate-prescription',
  '/api/stellar/admin/register-doctor',
  '/api/passkeys/send',
  '/api/defindex/submit',
]) {
  assert.ok(server.includes(route), `local server must expose or guard ${route}`);
}

assert.ok(doctorApi.includes('assertTestnetMutationEnabled()'), 'doctor mutation API must fail closed');
assert.ok(adminApi.includes('assertTestnetMutationEnabled()'), 'admin mutation API must fail closed');
assert.ok(dispensaryApi.includes('PUBLIC_DEMO_DISABLED'), 'dispensary mutations must be disabled in the public demo');
assert.ok(entry.includes("./PublicDemoApp"), 'public build must use the isolated demo entrypoint');
for (const forbiddenImport of ['MockupPortal', 'trustData', 'trustAuth', 'firebase', 'passkey', 'WalletOnboarding', 'localStorage.setItem', 'type="file"']) {
  assert.ok(!publicApp.includes(forbiddenImport), `public demo entry must not expose ${forbiddenImport}`);
}
assert.ok(publicApp.includes('operaciones deshabilitadas'), 'legacy role routes must state that operations are unavailable');

console.log('critical-demo-routes: static route, guard, and safe-copy checks passed');
