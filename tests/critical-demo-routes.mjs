import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const server = read('server.ts');
const portal = read('src/components/MockupPortal.tsx');
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
assert.ok(dispensaryApi.includes("action !== 'validate-prescription'"), 'read-only validation remains available');
assert.ok(portal.includes('DEMO / NO VÁLIDA'), 'demo prescription must be visibly non-valid');
assert.ok(!portal.includes('Todos los médicos en Trust Leaf están validados'), 'UI must not claim universal validation');

console.log('critical-demo-routes: static route, guard, and safe-copy checks passed');
