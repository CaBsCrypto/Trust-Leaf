import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
const doc = await readFile(new URL('../docs/internal/key-material-provisioning-inventory-20260827.md', import.meta.url), 'utf8');
for (const name of [
  'VITE_SUPABASE_PUBLISHABLE_KEY', 'TRUSTLEAF_AUTH_JWKS_URL',
  'TRUSTLEAF_AUTH_JWKS_ALGORITHMS', 'TRUSTLEAF_KMS_PROVIDER',
  'TRUSTLEAF_KMS_KEY_ALIAS', 'TRUSTLEAF_KMS_WORKLOAD_IDENTITY',
  'TRUSTLEAF_SIGNER_PUBLIC_KEY', 'TRUSTLEAF_STELLAR_ADMIN_ALIAS',
  'TRUSTLEAF_STELLAR_DEPLOYER_ALIAS', 'TRUSTLEAF_STELLAR_OPERATOR_ALIAS',
  'TRUSTLEAF_STELLAR_DOCTOR_ALIAS', 'TRUSTLEAF_STELLAR_DISPENSARY_ALIAS',
  'TRUSTLEAF_PUBLIC_QR_HMAC_KEY_REF', 'TRUSTLEAF_PUBLIC_QR_HMAC_KEY_VERSION',
]) {
  assert.match(env, new RegExp(`^${name}=`, 'm'));
  assert.match(doc, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
for (const flag of [
  'TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false',
  'TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false',
  'TRUSTLEAF_STELLAR_SIGNING_ENABLED=false',
  'TRUSTLEAF_PUBLIC_QR_SIGNING_ENABLED=false',
  'TRUSTLEAF_KMS_ENABLED=false',
]) assert.match(env, new RegExp(`^${flag}$`, 'm'));
assert.match(doc, /NO-GO/);
assert.match(doc, /2-de-3/);
assert.doesNotMatch(doc, /[A-Za-z0-9+/]{40,}={0,2}/);
console.log('key material inventory: names, roles, rotation, redaction and fail-closed flags passed');
