import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adr = readFileSync(new URL('../docs/internal/adr-testnet-v2-custody-and-idp.md', import.meta.url), 'utf8');
const checklist = readFileSync(new URL('../docs/internal/testnet-v2-provider-decision-checklist.md', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../docs/internal/testnet-v2-dry-ceremony-and-readonly-audit.md', import.meta.url), 'utf8');
const combined = `${adr}\n${checklist}`;

for (const marker of [
  'Google Cloud KMS', 'AWS KMS', 'AWS CloudHSM', 'Azure Key Vault/Managed HSM',
  'Firebase Auth', 'Auth0', 'Microsoft Entra ID', 'Amazon Cognito', 'Clerk',
  'Ed25519', '2-de-3', 'NO-GO', '2026-08-25',
]) assert.ok(combined.includes(marker), `missing decision marker: ${marker}`);

for (const source of [
  'developers.stellar.org', 'docs.aws.amazon.com', 'docs.cloud.google.com',
  'learn.microsoft.com', 'firebase.google.com', 'auth0.com', 'clerk.com',
]) assert.ok(adr.includes(source), `missing official source: ${source}`);

assert.match(combined, /TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false/);
assert.match(combined, /TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false/);
assert.match(runbook, /Decisiones humanas mínimas/);

for (const forbidden of [
  /S[A-Z2-7]{55}/,
  /-----BEGIN (?:PRIVATE KEY|OPENSSH PRIVATE KEY)-----/,
  /(?:secret|token|password)\s*[:=]\s*["'][^"']{8,}["']/i,
]) assert.doesNotMatch(combined, forbidden, `sensitive-looking material in decision docs: ${forbidden}`);

console.log('testnet-v2-provider-decision-docs: provider matrix, gates, sources and no-secret constraints passed');

