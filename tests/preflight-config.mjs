import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const envExample = readFileSync('.env.example', 'utf8');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

assert.equal(packageJson.name, lock.name, 'package.json and package-lock.json must describe the same project');
assert.match(envExample, /TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false/, 'example config must deny mutations');
assert.match(envExample, /^STELLAR_NETWORK=testnet$/m, 'receipt candidate example must remain Testnet-only');
assert.match(envExample, /^STELLAR_RPC_URL=https:\/\/soroban-testnet\.stellar\.org$/m, 'receipt RPC must match the reviewed Testnet allowlist');
assert.match(envExample, /^STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015$/m, 'Testnet passphrase must be explicit');
assert.match(envExample, /^STELLAR_RECEIPT_CONTRACT_ID=$/m, 'receipt contract ID must remain blank before the deploy gate');
assert.match(envExample, /TRUSTLEAF_PILOT_RUNTIME=disabled/, 'example config must disable pilot runtime');
assert.notEqual(process.env.TRUSTLEAF_ALLOW_TESTNET_MUTATIONS, 'true', 'preflight never runs with mutations enabled');

for (const secret of ['STELLAR_ADMIN_SECRET', 'STELLAR_DOCTOR_SECRET', 'STELLAR_DISPENSARY_SECRET']) {
  assert.match(envExample, new RegExp(`^${secret}=\\s*$`, 'm'), `${secret} must be blank in .env.example`);
}

console.log('preflight-config: safe defaults and lockfile checks passed');
