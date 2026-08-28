import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['api/stellar/contracts.ts', 'api/stellar/derive-wallet.ts', 'api/stellar/faucet.ts']);
const expectedRewrites = new Map([
  ['/api/stellar/contracts', '/api/stellar/readiness?__trustleaf_route=contracts'],
  ['/api/stellar/derive-wallet', '/api/stellar/readiness?__trustleaf_route=derive-wallet'],
  ['/api/stellar/faucet', '/api/stellar/readiness?__trustleaf_route=faucet'],
]);

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }))).flat();
}

const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const ignoredText = await readFile(join(root, '.vercelignore'), 'utf8');
for (const path of ignored) assert.match(ignoredText, new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));

const rewrites = new Map(vercel.rewrites.map(({ source, destination }) => [source, destination]));
for (const [source, destination] of expectedRewrites) assert.equal(rewrites.get(source), destination, `missing exact rewrite for ${source}`);

const endpoints = (await files(join(root, 'api')))
  .filter(path => path.endsWith('.ts'))
  .map(path => relative(root, path).replaceAll('\\', '/'))
  .filter(path => !path.includes('/_lib/') && !ignored.has(path));
assert.ok(endpoints.length <= 12, `Vercel Hobby function budget exceeded: ${endpoints.length}`);

const handler = await readFile(join(root, 'api/stellar/readiness.ts'), 'utf8');
for (const token of ['contracts', 'derive-wallet', 'faucet', 'res.status(503)', "res.status(404)"]) {
  assert.match(handler, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

console.log(`vercel-function-budget: ${endpoints.length} effective functions, static Stellar routes mapped with disabled public-operation guard`);
