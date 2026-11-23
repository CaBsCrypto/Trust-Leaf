import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const deployment = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const onlyCannabis = [{ type: 'host', value: 'cannabis.trustleaf.org' }];
for (const path of ['/verify/:token', '/demo/receipt-pilot']) {
  const rewrite = deployment.rewrites.find(rule => rule.source === path);
  assert.equal(rewrite?.destination, '/index.html', `${path} must serve the application on a direct visit`);
  assert.deepEqual(rewrite?.has, onlyCannabis);
  const rule = deployment.headers.find(entry => entry.source === path);
  assert.deepEqual(rule?.has, onlyCannabis);
  assert.deepEqual(Object.fromEntries(rule.headers.map(({ key, value }) => [key, value])), {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  });
}

const verifierUrl = new URL('../src/lib/publicVerification.ts', import.meta.url).href;
const script = `
  import { demoPublicReceiptVerifier, DEMO_PUBLIC_VERIFICATION_TOKENS } from ${JSON.stringify(verifierUrl)};
  const results = [];
  for (const [index, token] of DEMO_PUBLIC_VERIFICATION_TOKENS.entries()) {
    results.push(await demoPublicReceiptVerifier.verify(token, 'cold-' + index));
  }
  results.push(await demoPublicReceiptVerifier.verify(DEMO_PUBLIC_VERIFICATION_TOKENS[0] + 'tampered', 'tampered'));
  process.stdout.write(JSON.stringify(results));
`;
const expected = ['active', 'revoked', 'expired'].map(status => ({ demo: true, evidenceExists: true, proofMatches: true, status }));
expected.push({ demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });

// Independent JS processes model fresh tabs/reloads with no shared memory or storage.
for (const page of ['original tab', 'reload', 'independent tab']) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), expected, `${page}: QR state must survive a fresh runtime`);
}
console.log('public-verification-cold-load: original, reload and independent runtimes preserve fixture states; tampering unavailable');
