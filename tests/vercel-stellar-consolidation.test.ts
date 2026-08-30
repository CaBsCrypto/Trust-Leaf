import assert from 'node:assert/strict';
import handler from '../api/stellar/readiness.ts';

function response() {
  const output: { statusCode?: number; body?: unknown } = {};
  const res: any = {
    locals: {},
    status(code: number) { output.statusCode = code; return this; },
    json(body: unknown) { output.body = body; return this; },
    send(body: unknown) { output.body = body; return this; },
  };
  return { res, output };
}

for (const route of ['derive-wallet', 'faucet']) {
  const methodRejected = response();
  await handler({ method: 'GET', query: { __trustleaf_route: route }, headers: {}, body: {} }, methodRejected.res);
  assert.equal(methodRejected.output.statusCode, 405, `${route} must preserve its method contract before auth`);

  const { res, output } = response();
  await handler({ method: 'POST', query: { __trustleaf_route: route }, headers: {}, body: {} }, res);
  assert.equal(output.statusCode, 503, `${route} must deny without server auth configuration`);
  assert.deepEqual(output.body, { code: 'AUTH_CONFIGURATION_MISSING' });
}

console.log('vercel-stellar-consolidation: protected consolidated routes deny by default before any mutation');
