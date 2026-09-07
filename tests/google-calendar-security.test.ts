import assert from 'node:assert/strict';
import { authorizationRequest, calendarCallback, calendarScope, seal, unseal } from '../api/_lib/google-calendar-security.ts';

const key = 'ab'.repeat(32);
const encrypted = seal('test-refresh-token', key, 'doctor-a');
assert.equal(unseal(encrypted, key, 'doctor-a'), 'test-refresh-token');
assert.throws(() => unseal(encrypted, key, 'doctor-b'));
assert.throws(() => unseal(encrypted, 'cd'.repeat(32), 'doctor-a'));
assert.throws(() => seal('token', 'short-key', 'doctor-a'));
assert.notEqual(seal('test-refresh-token', key, 'doctor-a'), encrypted);
const auth = authorizationRequest('test.apps.googleusercontent.com');
const url = new URL(auth.url);
assert.equal(url.searchParams.get('redirect_uri'), calendarCallback);
assert.equal(url.searchParams.get('scope'), calendarScope);
assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
assert.equal(url.searchParams.get('access_type'), 'offline');
assert.notEqual(authorizationRequest('test.apps.googleusercontent.com').state, auth.state);
assert.ok(!auth.url.includes(auth.verifier));
console.log('Calendar security tests passed');
