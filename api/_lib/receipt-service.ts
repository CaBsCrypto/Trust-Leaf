import type { ReceiptActorRole, ReceiptLedgerPort } from './receipt-ledger.js';

export interface ReceiptRequestIdentity {
  authenticated: boolean;
  actorId?: string;
  roles?: readonly ReceiptActorRole[];
  receiptHandles?: readonly string[];
}

interface SyntheticAuthFixture {
  credential: string;
  actorId: string;
  roles: ReceiptActorRole[];
  receiptHandles: string[];
}

export function createReceiptService(ledger: ReceiptLedgerPort) {
  return {
    verifyPublic(token: string, operationId: string) {
      return ledger.verifyPublic(String(token || ''), String(operationId || ''));
    },
    async getOperational(handle: string, identity: ReceiptRequestIdentity) {
      if (!identity.authenticated || !identity.actorId || !identity.roles?.length) {
        throw Object.assign(new Error('Authentication required.'), { statusCode: 401, code: 'AUTH_REQUIRED' });
      }
      const role = identity.roles.find(candidate => ['doctor', 'patient', 'dispensary', 'admin'].includes(candidate));
      if (!role) {
        throw Object.assign(new Error('Role is not authorized.'), { statusCode: 403, code: 'ROLE_FORBIDDEN' });
      }
      if (!identity.receiptHandles?.includes(handle)) {
        throw Object.assign(new Error('Receipt is outside actor scope.'), { statusCode: 403, code: 'RECEIPT_SCOPE_FORBIDDEN' });
      }
      const receipt = await ledger.getOperational(handle, { role });
      if (!receipt) throw Object.assign(new Error('Receipt unavailable.'), { statusCode: 404, code: 'RECEIPT_UNAVAILABLE' });
      return receipt;
    },
  };
}

export function identityFromHeaders(headers: Record<string, string | string[] | undefined>, env: Record<string, string | undefined> = process.env): ReceiptRequestIdentity {
  const authorization = String(headers.authorization || '');
  if (!authorization.startsWith('Bearer ') || !env.TRUSTLEAF_SYNTHETIC_AUTH_FIXTURES_JSON) return { authenticated: false };
  let fixtures: SyntheticAuthFixture[];
  try {
    fixtures = JSON.parse(env.TRUSTLEAF_SYNTHETIC_AUTH_FIXTURES_JSON);
  } catch {
    return { authenticated: false };
  }
  const credential = authorization.slice(7);
  const fixture = fixtures.find(candidate => candidate.credential === credential);
  if (!fixture || !fixture.actorId || !Array.isArray(fixture.roles) || !Array.isArray(fixture.receiptHandles)) return { authenticated: false };
  const roles = fixture.roles.filter(role => ['doctor', 'patient', 'dispensary', 'admin'].includes(role));
  if (!roles.length) return { authenticated: false };
  return { authenticated: true, actorId: fixture.actorId, roles, receiptHandles: fixture.receiptHandles };
}
