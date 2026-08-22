export type PilotRole = 'doctor' | 'patient' | 'dispensary';
export type ReceiptState = 'draft' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired';

export interface ReceiptPilotSnapshot {
  demo: true;
  receiptHandle: string;
  state: ReceiptState;
  version: number;
  doctorGate: 'verified-demo';
  patientGate: 'identity-and-consent-demo';
  dispensaryGate: 'verified-demo';
  remainingUnits: number;
  timeline: ReadonlyArray<{ version: number; state: ReceiptState; operationKey: string }>;
}

export type ReceiptPilotOperation =
  | { kind: 'issue'; operationKey: string }
  | { kind: 'dispense-partial'; operationKey: string; units: number }
  | { kind: 'revoke'; operationKey: string };

export const SYNTHETIC_RECEIPT_HANDLE = 'tl_demo_A7mQ2vJ9xK4pR8wN6yT3uF5zB1cD0eGhL';

export function createReceiptPilotFixture(): ReceiptPilotSnapshot {
  return {
    demo: true,
    receiptHandle: SYNTHETIC_RECEIPT_HANDLE,
    state: 'draft',
    version: 0,
    doctorGate: 'verified-demo',
    patientGate: 'identity-and-consent-demo',
    dispensaryGate: 'verified-demo',
    remainingUnits: 2,
    timeline: [],
  };
}

export function applyReceiptPilotOperation(
  snapshot: ReceiptPilotSnapshot,
  operation: ReceiptPilotOperation,
): ReceiptPilotSnapshot {
  if (snapshot.timeline.some(event => event.operationKey === operation.operationKey)) return snapshot;

  let state: ReceiptState;
  let remainingUnits = snapshot.remainingUnits;
  if (operation.kind === 'issue') {
    if (snapshot.state !== 'draft') return snapshot;
    state = 'active';
  } else if (operation.kind === 'dispense-partial') {
    if (!['active', 'partial'].includes(snapshot.state) || !Number.isInteger(operation.units) || operation.units < 1 || operation.units > remainingUnits) return snapshot;
    remainingUnits -= operation.units;
    state = remainingUnits === 0 ? 'dispensed' : 'partial';
  } else {
    if (!['active', 'partial'].includes(snapshot.state)) return snapshot;
    state = 'revoked';
  }

  const version = snapshot.version + 1;
  return { ...snapshot, state, version, remainingUnits, timeline: [...snapshot.timeline, { version, state, operationKey: operation.operationKey }] };
}

export function publicReceiptProjection(snapshot: ReceiptPilotSnapshot) {
  const status = snapshot.state === 'active' || snapshot.state === 'partial'
    ? 'active'
    : snapshot.state === 'revoked' || snapshot.state === 'expired'
      ? snapshot.state
      : 'unavailable';
  return { demo: true as const, evidenceExists: snapshot.state !== 'draft', proofMatches: snapshot.state !== 'draft', status };
}
