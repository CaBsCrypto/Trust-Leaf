import assert from 'node:assert/strict';
import { inspectAuthCustodyReadiness } from '../api/_lib/auth-custody-readiness.ts';

const empty = inspectAuthCustodyReadiness({});
assert.equal(empty.ready, false);
assert.equal(empty.checks.noLegacyInlineSecret, true);
assert.equal(JSON.stringify(empty).includes('undefined'), false);

const synthetic = inspectAuthCustodyReadiness({
  TRUSTLEAF_AUTH_ISSUER: 'synthetic-issuer', TRUSTLEAF_AUTH_AUDIENCE: 'synthetic-audience',
  TRUSTLEAF_AUTH_JWKS_URL: 'https://identity.invalid/synthetic-jwks',
  TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON: '{"synthetic-actor":["doctor"]}',
  TRUSTLEAF_KMS_PROVIDER: 'synthetic-test-double', TRUSTLEAF_KMS_KEY_ALIAS: 'receipt-issuer',
  TRUSTLEAF_KMS_WORKLOAD_IDENTITY: 'synthetic-workload', TRUSTLEAF_SIGNER_PUBLIC_KEY: `G${'A'.repeat(55)}`,
  STELLAR_RECEIPT_CONTRACT_ID: `C${'A'.repeat(55)}`, TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'false',
});
assert.equal(synthetic.ready, true);
assert.deepEqual(synthetic.blockers, []);

const legacySecret = inspectAuthCustodyReadiness({ ...Object.fromEntries([]), STELLAR_ADMIN_SECRET: 'synthetic-secret-must-not-be-returned' });
assert.equal(legacySecret.checks.noLegacyInlineSecret, false);
assert.equal(JSON.stringify(legacySecret).includes('synthetic-secret'), false);
console.log('auth-custody-readiness: sanitized presence, public format and inline-secret gates passed');
