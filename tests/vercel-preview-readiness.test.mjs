import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const doc = await readFile(new URL('../docs/internal/vercel-preview-provisioning-20260827.md', import.meta.url), 'utf8');
for (const value of [
  'vercel env ls', 'trustleaf', 'CaBsCrypto/Trust-Leaf', 'project.json',
  'Development', 'Preview',
  'VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED', 'VITE_SUPABASE_PUBLISHABLE_KEY',
  'TRUSTLEAF_AUTH_JWKS_URL', 'TRUSTLEAF_KMS_PROVIDER',
  'TRUSTLEAF_PUBLIC_QR_HMAC_KEY_REF', 'TRUSTLEAF_STELLAR_SIGNING_ENABLED',
  'TRUSTLEAF_TESTNET_SUBMIT_ENABLED', 'qa:vercel-preview', 'prefers-reduced-motion',
  'NO-GO',
]) assert.match(doc, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
assert.match(doc, /Production[\s\S]*fuera del alcance/i);
assert.match(doc, /no se leyeron valores/i);
assert.match(doc, /conectados a `trustleaf`/i);
assert.match(doc, /no\s+existe aún Preview/i);
assert.doesNotMatch(doc, /sb_secret_[A-Za-z0-9_-]{16,}/i);
assert.doesNotMatch(doc, /-----begin (private|rsa) key-----/i);
console.log('vercel preview readiness: linked-project evidence, variable matrix, safe ceremony and browser QA plan passed');
