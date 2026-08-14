import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const envExample = readFileSync('.env.example', 'utf8');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

assert.equal(packageJson.name, lock.name, 'package.json and package-lock.json must describe the same project');
assert.match(envExample, /TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false/, 'example config must deny mutations');
assert.match(envExample, /TRUSTLEAF_PILOT_RUNTIME=disabled/, 'example config must disable pilot runtime');
assert.notEqual(process.env.TRUSTLEAF_ALLOW_TESTNET_MUTATIONS, 'true', 'preflight never runs with mutations enabled');

for (const secret of ['STELLAR_ADMIN_SECRET', 'STELLAR_DOCTOR_SECRET', 'STELLAR_DISPENSARY_SECRET']) {
  assert.match(envExample, new RegExp(`^${secret}=\\s*$`, 'm'), `${secret} must be blank in .env.example`);
}

console.log('preflight-config: safe defaults and lockfile checks passed');
