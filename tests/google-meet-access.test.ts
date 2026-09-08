import assert from 'node:assert/strict';
import { ensureOpenMeet } from '../api/_lib/google-meet-access.ts';

const url = 'https://meet.google.com/abc-defg-hij';
const name = 'spaces/canonical_123';
const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
let accessType = 'TRUSTED';
const fetcher: typeof fetch = async (input, options) => {
  calls.push({ url: String(input), options });
  if (options?.method === 'PATCH') {
    assert.deepEqual(JSON.parse(String(options.body)), { config: { accessType: 'OPEN' } });
    assert.equal(String(input), `https://meet.googleapis.com/v2/${name}?updateMask=config.accessType`);
    accessType = 'OPEN';
  }
  return Response.json({ name, config: { accessType } });
};
assert.deepEqual(await ensureOpenMeet('test-token', url, fetcher), { spaceName: name, accessType: 'OPEN' });
assert.equal(calls.length, 3);
calls.length = 0;
await ensureOpenMeet('test-token', url, fetcher);
assert.equal(calls.length, 2);
assert.ok(calls.every(call => call.options?.method === 'GET'));
await assert.rejects(ensureOpenMeet('test-token', 'https://evil.example/abc-defg-hij', fetcher), /MEET_URL_INVALID/);
await assert.rejects(ensureOpenMeet('test-token', url, async () => new Response('', { status: 403 })),
  (error: any) => error.message === 'MEET_ACCESS_PROVIDER_ERROR' && error.statusCode === 403);
await assert.rejects(ensureOpenMeet('test-token', url, async () => Response.json({ name: '../other' })), /MEET_SPACE_INVALID/);
await assert.rejects(ensureOpenMeet('test-token', url, async () => Response.json({ name, config: { accessType: 'TRUSTED' } })), /MEET_ACCESS_NOT_OPEN/);
console.log('Meet open access: canonical PATCH, read-back, retries and error handling passed.');
