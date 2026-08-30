import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivyIdentityVerifier } from '../api/_lib/privy-identity.ts';

const env = { PRIVY_APP_ID: 'privy-app-id', PRIVY_APP_SECRET: 'server-secret' };

test('verifies a Privy DID through the server-side reader', async () => {
  const verifier = createPrivyIdentityVerifier(env, {
    users: () => ({ async get() { return { id: 'did:privy:patient-123456' }; } }),
  });

  assert.deepEqual(await verifier.verify('identity-token'), { subject: 'did:privy:patient-123456' });
});

test('does not accept arbitrary identity subjects or missing server configuration', async () => {
  const invalid = createPrivyIdentityVerifier(env, {
    users: () => ({ async get() { return { id: 'not-a-privy-did' }; } }),
  });
  await assert.rejects(invalid.verify('identity-token'), { code: 'PRIVY_IDENTITY_SUBJECT_INVALID', statusCode: 401 });
  assert.throws(() => createPrivyIdentityVerifier({}, { users: () => ({ async get() { return { id: 'did:privy:patient-123456' }; } }) }), {
    code: 'PRIVY_SERVER_CONFIGURATION_MISSING',
    statusCode: 503,
  });
});
