import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  ['Four-role access matrix (mock identity and RPC)', 'synthetic-four-role-access.test.ts'],
  ['Privy authorization adapter (mock RPC)', 'privy-supabase-rbac.test.ts'],
  ['Booking, isolation and duplicate prevention (in memory)', 'durable-availability-booking.test.ts'],
  ['Receipt and partial withdrawals (synthetic ledger)', 'receipt-shared-state-e2e.test.ts'],
  ['Demo journey and UI source checks (not browser E2E)', 'pilot-flow-demo-e2e.test.ts'],
  ['Baseline migration source security checks', 'supabase-migration-security.test.mjs'],
  ['RBAC migration source checks', 'supabase-auth-rbac-migration.test.mjs'],
  ['Booking migration source checks', 'durable-availability-booking-migration.test.mjs'],
];
let failures = 0;
for (const [label, file] of suites) {
  console.log(`\n${label}`);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', `tests/${file}`], {
    cwd: root, stdio: 'inherit', timeout: 60_000,
  });
  if (result.error || result.status !== 0) {
    failures++;
    console.error(`FAIL: ${label}${result.error ? ` (${result.error.message})` : ''}`);
  } else console.log(`PASS: ${label}`);
}
console.log(`\nSynthetic suites: ${suites.length - failures}/${suites.length} passed.`);
console.log('Not validated: Google/OTP, real Privy tokens, deployed Supabase RPC/RLS, browser journeys, Stellar transactions.');
console.log('No real accounts, emails or network credentials are created by this runner.');
process.exitCode = failures ? 1 : 0;
