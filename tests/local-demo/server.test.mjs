import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
const failureProbe = process.argv.includes('--reset-failure');
const child = spawn(process.execPath, ['--import', 'tsx', failureProbe ? 'tests/local-demo/reset-failure-probe.mjs' : 'tests/local-demo/server.mjs', '0'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
let stderr = '', output = ''; child.stderr.on('data', data => { stderr += data; });
const readyURL = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    child.kill();
    reject(new Error('Local server did not become ready: ' + stderr));
  }, 90000);
  child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Local server exited ${code}: ${stderr}`)); });
  child.stdout.on('data', data => { output += data; const match = output.match(/LOCAL_DEMO_READY (http:\/\/127\.0\.0\.1:\d+\/#[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
});
try {
  const address = new URL(readyURL), bootstrap = new URLSearchParams(address.hash.slice(1)).get('demo-access');
  const base = address.origin;
  // Keep bootstrap capabilities out of report URLs.
  assert.equal((await fetch(base + '/__local_demo/meta')).status, 401, 'anonymous bootstrap cannot obtain actor capabilities');
  const metadataResponse = await fetch(base + '/__local_demo/meta', { headers: { 'x-demo-bootstrap': bootstrap } });
  assert.equal(metadataResponse.status, 200);
  let metadata = await metadataResponse.json();
  const headers = key => ({ 'x-demo-access': metadata.access, 'x-demo-generation': String(metadata.generation), 'privy-id-token': metadata.identities.find(row => row.key === key)?.token ?? 'synthetic-invalid', Origin: base, 'Content-Type': 'application/json' });
  const call = async (key, path, command) => {
    const response = await fetch(base + path, { method: command ? 'POST' : 'GET', headers: headers(key), ...(command ? { body: JSON.stringify(command) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  if (failureProbe) {
    const reset = await fetch(base + '/__local_demo/reset', { method: 'POST', headers: headers('admin'), body: '{}' });
    assert.equal(reset.status, 503);
    for (const access of [metadata.access, '']) assert.equal((await fetch(base + '/api/operations-pilot', { headers: { ...headers('admin'), 'x-demo-access': access } })).status, 409);
    assert.equal((await fetch(base + '/__local_demo/meta', { headers: { 'x-demo-bootstrap': bootstrap } })).status, 503);
    console.log('PASS failed reset leaves admission closed, including old/empty capabilities and bootstrap.');
  } else {
  for (const path of ['/.env', '/@fs/source', '/api/stellar/patient/synthetic/dashboard', '/unknown']) assert.equal((await fetch(base + path)).status, 404);
  // Undici replaces Host; exercise the HTTP boundary with the raw client instead.
  const forgedHost = await new Promise((resolve, reject) => {
    const request = http.get(base + '/', { headers: { Host: 'foreign.invalid' } }, response => { response.resume(); response.once('end', () => resolve(response.statusCode)); });
    request.once('error', reject);
  });
  assert.equal(forgedHost, 403);
  assert.equal((await fetch(base + '/__local_demo/meta', { headers: { Origin: 'https://foreign.invalid' } })).status, 403);
  assert.equal((await fetch(base + '/__local_demo/mail')).status, 409);
  assert.equal((await fetch(base + '/api/operations-pilot', { method: 'DELETE', headers: headers('admin') })).status, 405);
  assert.equal((await fetch(base + '/api/operations-pilot', { method: 'POST', headers: headers('admin'), body: '{broken' })).status, 400);
  assert.equal((await fetch(base + '/api/operations-pilot', { method: 'POST', headers: headers('admin'), body: JSON.stringify({ value: 'x'.repeat(12001) }) })).status, 413);
  assert.equal((await fetch(base + '/api/operations-pilot?subject=foreign', { headers: headers('admin') })).status, 400);
  assert.equal((await call('newManager', '/api/operations-pilot')).status, 403, 'manager is not pre-approved');
  assert.equal((await call('newWorker', '/api/operations-pilot')).status, 403, 'operator has not joined');
  assert.equal((await call('__proto__', '/api/operations-pilot')).status, 401, 'no inherited identity key');
  const invite = { action: 'invite', email: 'newmanager@example.test', operationId: crypto.randomUUID() };
  assert.equal((await call('admin', '/api/dispensary-onboarding', { ...invite, email: 'synthetic-not-owned@gmail.com' })).status, 400, 'non-demo recipients rejected before persistence');
  assert.equal((await call('admin', '/api/dispensary-onboarding', invite)).status, 200);
  assert.equal((await call('admin', '/api/dispensary-onboarding', invite)).status, 200, 'lost acknowledgement retry uses same ID');
  const mail = (await (await fetch(base + '/__local_demo/mail', { headers: headers('admin') })).json());
  assert.equal(mail.length, 1); assert.equal(mail[0].kind, 'dispensary-invite'); assert.ok(!mail[0].text.includes('https://www.trustleaf.org'));
  const accept = { action: 'accept', token: mail[0].token, consent: true };
  assert.equal((await call('patient', '/api/dispensary-onboarding', accept)).status, 403);
  const accepted = await call('newManager', '/api/dispensary-onboarding', accept); assert.equal(accepted.status, 200);
  assert.equal((await call('newManager', '/api/dispensary-onboarding', accept)).data.application.applicationRef, accepted.data.application.applicationRef);
  assert.equal((await call('newManager', '/api/operations-pilot')).status, 403, 'acceptance alone grants no operational access');
  const old = metadata, oldToken = mail[0].token;
  const reset = await fetch(base + '/__local_demo/reset', { method: 'POST', headers: headers('admin'), body: '{}' });
  assert.equal(reset.status, 200); metadata = await reset.json(); assert.equal(metadata.generation, old.generation + 1);
  assert.equal((await fetch(base + '/api/operations-pilot', { headers: { ...headers('admin'), 'x-demo-access': old.access, 'x-demo-generation': String(old.generation) } })).status, 409);
  assert.equal((await call('newManager', '/api/dispensary-onboarding', { action: 'inspect', token: oldToken })).status, 403);
  assert.deepEqual(await (await fetch(base + '/__local_demo/mail', { headers: headers('admin') })).json(), []);
  const health = await (await fetch(base + '/__local_demo/health', { headers: headers('admin') })).json(); assert.deepEqual(health.blockedTransports, []);
  console.log('PASS local server: closed admission, safe JSON, byte limit, actual SQL, unapproved actors, one mail/acceptance on replay, reset and stale token rejection; zero outbound transports.');
  }
} finally {
  child.send('close'); await once(child, 'exit');
}
