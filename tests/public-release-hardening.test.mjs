import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const publicEntry = `${read('src/main.tsx')}\n${read('src/PublicDemoApp.tsx')}`;
for (const forbidden of ['MockupPortal', 'trustData', 'trustAuth', 'firebase', 'localStorage', 'type="file"', 'WalletOnboarding']) {
  assert.doesNotMatch(publicEntry, new RegExp(forbidden), `public entry must not include ${forbidden}`);
}
assert.match(publicEntry, /operaciones deshabilitadas/, 'legacy role routes must be explicitly disabled');
assert.match(publicEntry, /demo sintética/i, 'public landing must identify synthetic-only scope');

function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(root, entry.name)) : [join(root, entry.name)]);
}
const runtime = files('api').filter((path) => path.endsWith('.ts')).map(read).join('\n');
for (const forbidden of ['process.env.STELLAR_ADMIN_SECRET', 'process.env.STELLAR_DOCTOR_SECRET', 'process.env.STELLAR_DISPENSARY_SECRET']) {
  assert.ok(!runtime.includes(forbidden), `runtime must not read ${forbidden}`);
}
for (const endpoint of ['api/stellar/doctor/issue-prescription.ts', 'api/stellar/admin/[action].ts', 'api/stellar/dispensary/[action].ts', 'api/stellar/faucet.ts', 'api/stellar/patient/[address]/dashboard.ts', 'api/passkeys/send.ts']) {
  const source = read(endpoint);
  assert.match(source, /PUBLIC_DEMO_DISABLED|assertTestnetMutationEnabled\(\)/, `${endpoint} must fail closed`);
  assert.doesNotMatch(source, /req\.body/, `${endpoint} must not parse operational or clinical input`);
}
console.log('public-release-hardening: public graph, legacy signer inputs, and mutation routes are isolated');
