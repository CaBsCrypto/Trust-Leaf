import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createAsymmetricJwksTokenVerifier } from '../api/_lib/jwks-token-verifier.ts';

const payload = {
  sub: '00000000-0000-4000-8000-000000000001',
  iss: 'https://synthetic.supabase.invalid/auth/v1',
  aud: 'authenticated',
  exp: 3_000,
  role: 'authenticated',
};

for (const algorithm of ['RS256', 'ES256'] as const) {
  const pair = algorithm === 'RS256'
    ? generateKeyPairSync('rsa', { modulusLength: 2048 })
    : generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const kid = `synthetic-${algorithm.toLowerCase()}`;
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const header = encode({ alg: algorithm, kid, typ: 'JWT' });
  const body = encode(payload);
  const signingInput = `${header}.${body}`;
  const signature = sign(
    algorithm === 'RS256' ? 'RSA-SHA256' : 'sha256',
    Buffer.from(signingInput),
    algorithm === 'ES256' ? { key: pair.privateKey, dsaEncoding: 'ieee-p1363' } : pair.privateKey,
  ).toString('base64url');
  const verifier = createAsymmetricJwksTokenVerifier({
    async get(requestedKid) { return requestedKid === kid ? { ...jwk, kid, alg: algorithm, use: 'sig' } : null; },
  });
  assert.equal((await verifier.verify(`${signingInput}.${signature}`)).subject, payload.sub);
  await assert.rejects(verifier.verify(`${signingInput}.${signature.slice(0, -2)}aa`));
}

function encode(value: unknown) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
console.log('supabase JWKS verifier: RS256/ES256 signatures and tamper rejection passed');
