export type PublicEvidenceStatus = 'active' | 'revoked' | 'expired' | 'unavailable';

export interface PublicVerificationResult {
  demo: true;
  evidenceExists: boolean;
  proofMatches: boolean;
  status: PublicEvidenceStatus;
}

export interface PublicReceiptVerifier {
  verify(token: string, operationKey: string): Promise<PublicVerificationResult>;
}

interface DemoEvidenceRecord {
  handle: string;
  status: Exclude<PublicEvidenceStatus, 'unavailable'>;
  commitment: string;
  signature: string;
}

const DOMAIN = 'trustleaf-public-evidence-demo-v1';
const DEMO_KEY = 'trustleaf-demo-only-key-v1';
const HANDLE_PATTERN = /^tl_demo_[A-Za-z0-9_-]{32,64}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UNAVAILABLE: PublicVerificationResult = { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' };

const DEMO_RECORDS: readonly DemoEvidenceRecord[] = [
  { handle: 'tl_demo_P9kL3sV7nM2qW8xR5tY1uC6bF4dE0aJzH', status: 'revoked', commitment: 'cmt_demo_revoked_02', signature: 'baniiyTTPDUUazlt7h-wZ2rInt40x21IYklQ70PjbGE' },
  { handle: 'tl_demo_Z4xC8vB2nM6qW1rT5yU9iO3pL7kJ0hGfD', status: 'expired', commitment: 'cmt_demo_expired_03', signature: 'IpXapbzc_D7fnF9VkQu5SbaK1OfmoGTTHhqaPV4zSXg' },
] as const;

const operationCache = new Map<string, { token: string; result: PublicVerificationResult }>();

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

async function demoSignature(record: DemoEvidenceRecord): Promise<string> {
  const payload = [DOMAIN, DEMO_KEY, record.handle, record.status, record.commitment].join(':');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return toBase64Url(digest);
}

function constantTimeEqual(left: string, right: string): boolean {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

export const demoPublicReceiptVerifier: PublicReceiptVerifier = {
  async verify(token, operationKey) {
    const cached = operationCache.get(operationKey);
    if (cached) return constantTimeEqual(cached.token, token) ? cached.result : UNAVAILABLE;
    const [handle = '', signature = '', extra] = token.split('.');
    let result = UNAVAILABLE;
    if (!extra && HANDLE_PATTERN.test(handle) && SIGNATURE_PATTERN.test(signature)) {
      const sharedReceipt = sharedSyntheticReceiptStore.read();
      if (matchesSyntheticToken(token, sharedReceipt)) result = publicProjection(sharedReceipt);
      const record = DEMO_RECORDS.find(candidate => candidate.handle === handle);
      if (record) {
        const expected = await demoSignature(record);
        if (constantTimeEqual(expected, signature) && constantTimeEqual(record.signature, signature)) {
          result = { demo: true, evidenceExists: true, proofMatches: true, status: record.status };
        }
      }
    }
    operationCache.set(operationKey, { token, result });
    return result;
  },
};

export function resetPublicVerificationDemoState(): void {
  operationCache.clear();
  sharedSyntheticReceiptStore.reset();
  sharedSyntheticReceiptStore.apply({ kind: 'issue', operationId: 'public-fixture-issue' });
}

export function createOpaqueDemoHandle(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
  return `tl_demo_${toBase64Url(bytes.buffer)}`;
}

export const DEMO_PUBLIC_VERIFICATION_TOKENS = [SYNTHETIC_RECEIPT_TOKEN, ...DEMO_RECORDS.map(record => `${record.handle}.${record.signature}`)];
import { matchesSyntheticToken, publicProjection, sharedSyntheticReceiptStore, SYNTHETIC_RECEIPT_TOKEN } from '../../shared/receipt-demo-contract.ts';
