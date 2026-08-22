import type { ReceiptActorRole, ReceiptLedgerPort } from './receipt-ledger.js';

export interface ReceiptRequestIdentity { authenticated: boolean; role?: ReceiptActorRole }

export function createReceiptService(ledger: ReceiptLedgerPort) {
  return {
    verifyPublic(token: string, operationId: string) {
      return ledger.verifyPublic(String(token || ''), String(operationId || ''));
    },
    async getOperational(handle: string, identity: ReceiptRequestIdentity) {
      if (!identity.authenticated || !identity.role) {
        throw Object.assign(new Error('Authentication required.'), { statusCode: 401, code: 'AUTH_REQUIRED' });
      }
      if (!['doctor', 'patient', 'dispensary', 'admin'].includes(identity.role)) {
        throw Object.assign(new Error('Role is not authorized.'), { statusCode: 403, code: 'ROLE_FORBIDDEN' });
      }
      const receipt = await ledger.getOperational(handle, { role: identity.role });
      if (!receipt) throw Object.assign(new Error('Receipt unavailable.'), { statusCode: 404, code: 'RECEIPT_UNAVAILABLE' });
      return receipt;
    },
  };
}

export function identityFromHeaders(headers: Record<string, string | string[] | undefined>, env: Record<string, string | undefined> = process.env): ReceiptRequestIdentity {
  const expected = env.TRUSTLEAF_SYNTHETIC_AUTH_TOKEN;
  const authorization = String(headers.authorization || '');
  const role = String(headers['x-trustleaf-role'] || '') as ReceiptActorRole;
  if (!expected || !authorization.startsWith('Bearer ') || authorization.slice(7) !== expected) return { authenticated: false };
  return { authenticated: true, role };
}
