import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { TokenVerifier, VerifiedTokenClaims } from './server-authorization.ts';

interface JsonWebKeyWithKid extends JsonWebKey { kid?: string; alg?: string; use?: string }
export interface JwksProvider { get(kid: string): Promise<JsonWebKeyWithKid | null> }

export function createRemoteJwksProvider(input: {
  url: string;
  fetcher?: typeof fetch;
  cacheTtlMs?: number;
  now?: () => number;
}): JwksProvider {
  const url = new URL(input.url);
  if (url.protocol !== 'https:') throw new Error('JWKS_URL_INVALID');
  const fetcher = input.fetcher ?? fetch;
  const ttl = input.cacheTtlMs ?? 300_000;
  const now = input.now ?? Date.now;
  let cache: { expiresAt: number; keys: JsonWebKeyWithKid[] } | null = null;
  return {
    async get(kid) {
      if (!kid) return null;
      if (!cache || cache.expiresAt <= now()) {
        const response = await fetcher(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5_000) });
        if (!response.ok) throw new Error('JWKS_UNAVAILABLE');
        const body = await response.json() as { keys?: JsonWebKeyWithKid[] };
        if (!Array.isArray(body.keys)) throw new Error('JWKS_INVALID');
        cache = { expiresAt: now() + ttl, keys: body.keys };
      }
      return cache.keys.find(key => key.kid === kid && (!key.use || key.use === 'sig')) ?? null;
    },
  };
}

export function createRs256JwksTokenVerifier(provider: JwksProvider): TokenVerifier {
  return {
    kind: 'jwks-rs256',
    async verify(token): Promise<VerifiedTokenClaims> {
      const segments = token.split('.');
      if (segments.length !== 3) throw new Error('JWT_MALFORMED');
      const header = decodeJson(segments[0]) as { alg?: string; kid?: string; typ?: string };
      if (header.alg !== 'RS256' || !header.kid) throw new Error('JWT_ALGORITHM_FORBIDDEN');
      const key = await provider.get(header.kid);
      if (!key || (key.alg && key.alg !== 'RS256')) throw new Error('JWT_KEY_NOT_FOUND');
      const valid = verifySignature('RSA-SHA256', Buffer.from(`${segments[0]}.${segments[1]}`), createPublicKey({ key, format: 'jwk' }), decodeBase64Url(segments[2]));
      if (!valid) throw new Error('JWT_SIGNATURE_INVALID');
      const payload = decodeJson(segments[1]) as Record<string, unknown>;
      return {
        subject: stringClaim(payload.sub),
        issuer: stringClaim(payload.iss),
        audience: audienceClaim(payload.aud),
        expiresAt: numberClaim(payload.exp),
        roles: stringList(payload.roles ?? payload.role),
        scopes: stringList(payload.scopes ?? payload.scope),
      };
    },
  };
}

function decodeJson(value: string) { return JSON.parse(decodeBase64Url(value).toString('utf8')); }
function decodeBase64Url(value: string) { return Buffer.from(value, 'base64url'); }
function stringClaim(value: unknown) { if (typeof value !== 'string' || !value) throw new Error('JWT_CLAIM_INVALID'); return value; }
function numberClaim(value: unknown) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('JWT_CLAIM_INVALID'); return value; }
function audienceClaim(value: unknown) { return Array.isArray(value) ? stringClaim(value[0]) : stringClaim(value); }
function stringList(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return [...value];
  return [];
}
