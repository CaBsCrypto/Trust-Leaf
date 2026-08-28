export type ReceiptState = 'draft' | 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired';
export type ReceiptActorRole = 'doctor' | 'patient' | 'dispensary' | 'admin';
export type PublicReceiptStatus = 'active' | 'revoked' | 'expired' | 'unavailable';
export interface ReceiptEvent { version: number; state: Exclude<ReceiptState, 'draft'>; operationId: string }
export interface SyntheticReceipt { demo: true; handle: string; signature: string; state: ReceiptState; version: number; remainingUnits: number; events: ReadonlyArray<ReceiptEvent> }
export interface PublicReceiptProjection { demo: true; evidenceExists: boolean; proofMatches: boolean; status: PublicReceiptStatus }
export interface OperationalReceiptProjection { demo: true; receiptHandle: string; state: ReceiptState; version: number; remainingUnits: number; events: ReadonlyArray<ReceiptEvent> }
export type SyntheticOperation = { kind: 'issue'; operationId: string } | { kind: 'dispense-partial'; operationId: string; units: number } | { kind: 'revoke'; operationId: string } | { kind: 'expire'; operationId: string };

const HANDLE_PATTERN = /^tl_demo_[A-Za-z0-9_-]{32,64}$/;
const TOKEN_PATTERN = /^(tl_demo_[A-Za-z0-9_-]{32,64})\.([A-Za-z0-9_-]{43})$/;
export const SYNTHETIC_RECEIPT_HANDLE = 'tl_demo_A7mQ2vJ9xK4pR8wN6yT3uF5zB1cD0eGhL';
export const SYNTHETIC_RECEIPT_SIGNATURE = 'iNbZ8-2idR0rHqfXp-7YefpAq-svn1CjFmtUlXt2zbM';
export const SYNTHETIC_RECEIPT_TOKEN = `${SYNTHETIC_RECEIPT_HANDLE}.${SYNTHETIC_RECEIPT_SIGNATURE}`;
export const UNAVAILABLE_PUBLIC_RECEIPT: PublicReceiptProjection = { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' };

export function createSyntheticReceipt(): SyntheticReceipt { return { demo: true, handle: SYNTHETIC_RECEIPT_HANDLE, signature: SYNTHETIC_RECEIPT_SIGNATURE, state: 'draft', version: 0, remainingUnits: 2, events: [] }; }

export function applySyntheticOperation(receipt: SyntheticReceipt, operation: SyntheticOperation): SyntheticReceipt {
  if (receipt.events.some(event => event.operationId === operation.operationId)) return receipt;
  if (operation.kind === 'issue') {
    if (receipt.state !== 'draft') return receipt;
    return { ...receipt, state: 'active', version: 2, events: [{ version: 1, state: 'issued', operationId: `${operation.operationId}:issued` }, { version: 2, state: 'active', operationId: operation.operationId }] };
  }
  if (!['active', 'partial'].includes(receipt.state)) return receipt;
  if (operation.kind === 'dispense-partial') {
    if (!Number.isInteger(operation.units) || operation.units < 1 || operation.units > receipt.remainingUnits) return receipt;
    const remainingUnits = receipt.remainingUnits - operation.units;
    const state = remainingUnits === 0 ? 'dispensed' : 'partial';
    const version = receipt.version + 1;
    return { ...receipt, state, version, remainingUnits, events: [...receipt.events, { version, state, operationId: operation.operationId }] };
  }
  const state = operation.kind === 'revoke' ? 'revoked' : 'expired';
  const version = receipt.version + 1;
  return { ...receipt, state, version, events: [...receipt.events, { version, state, operationId: operation.operationId }] };
}

export function publicProjection(receipt: SyntheticReceipt): PublicReceiptProjection {
  const status: PublicReceiptStatus = receipt.state === 'active' || receipt.state === 'partial' ? 'active' : receipt.state === 'revoked' || receipt.state === 'expired' ? receipt.state : 'unavailable';
  return { demo: true, evidenceExists: receipt.state !== 'draft', proofMatches: receipt.state !== 'draft', status };
}
export function operationalProjection(receipt: SyntheticReceipt): OperationalReceiptProjection { return { demo: true, receiptHandle: receipt.handle, state: receipt.state, version: receipt.version, remainingUnits: receipt.remainingUnits, events: receipt.events }; }
export function parseSyntheticToken(token: string) { const match = TOKEN_PATTERN.exec(token); return match ? { handle: match[1], signature: match[2] } : null; }
export function matchesSyntheticToken(token: string, receipt: SyntheticReceipt): boolean { const parsed = parseSyntheticToken(token); return Boolean(parsed && parsed.handle === receipt.handle && parsed.signature === receipt.signature); }
export function isSyntheticHandle(handle: string): boolean { return HANDLE_PATTERN.test(handle); }
export interface SyntheticReceiptStore { read(): SyntheticReceipt; apply(operation: SyntheticOperation): SyntheticReceipt; reset(): void }
export function createSyntheticReceiptStore(initial = createSyntheticReceipt()): SyntheticReceiptStore { let current = initial; return { read: () => current, apply: operation => (current = applySyntheticOperation(current, operation)), reset: () => { current = createSyntheticReceipt(); } }; }
export const sharedSyntheticReceiptStore = createSyntheticReceiptStore();
