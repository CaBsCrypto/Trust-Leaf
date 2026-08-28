import { PILOT_PHASES, PILOT_QR_HANDLE } from './pilotFlowFixtures.ts';

export type PilotRole = 'admin' | 'doctor' | 'patient' | 'dispensary';

export type PilotPhase =
  | 'admin-empty'
  | 'doctor-requested'
  | 'doctor-operational'
  | 'availability-published'
  | 'appointment-booked'
  | 'consultation-complete'
  | 'receipt-active'
  | 'directory-enabled'
  | 'dispense-partial'
  | 'dispense-complete'
  | 'admin-audit';

export type PilotAction =
  | { type: 'doctor-request-access'; actor: PilotRole }
  | { type: 'admin-approve-doctor'; actor: PilotRole }
  | { type: 'doctor-publish-availability'; actor: PilotRole }
  | { type: 'patient-book'; actor: PilotRole }
  | { type: 'doctor-complete-consultation'; actor: PilotRole; consent: boolean; syntheticEligible: boolean }
  | { type: 'doctor-prepare-receipt'; actor: PilotRole }
  | { type: 'patient-open-directory'; actor: PilotRole }
  | { type: 'dispensary-record-partial'; actor: PilotRole; qrHandle: string }
  | { type: 'dispensary-record-total'; actor: PilotRole; qrHandle: string }
  | { type: 'admin-open-audit'; actor: PilotRole }
  | { type: 'reset'; actor: PilotRole };

export interface PilotAuditEntry {
  readonly sequence: number;
  readonly actor: PilotRole;
  readonly event: string;
  readonly result: 'accepted';
}

export interface PilotFlowState {
  readonly phase: PilotPhase;
  readonly version: number;
  readonly audit: readonly PilotAuditEntry[];
  readonly lastError: string | null;
}

export interface PilotPhaseDefinition {
  readonly phase: PilotPhase;
  readonly journeyStep: number;
  readonly role: PilotRole;
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly source: 'fixture-local' | 'gate-local';
}

export const INITIAL_PILOT_FLOW: PilotFlowState = Object.freeze({
  phase: 'admin-empty',
  version: 0,
  audit: Object.freeze([]),
  lastError: null,
});

const TRANSITIONS: Record<Exclude<PilotAction['type'], 'reset'>, { from: PilotPhase; to: PilotPhase; role: PilotRole; event: string }> = {
  'doctor-request-access': { from: 'admin-empty', to: 'doctor-requested', role: 'doctor', event: 'doctor.access.requested' },
  'admin-approve-doctor': { from: 'doctor-requested', to: 'doctor-operational', role: 'admin', event: 'doctor.operation.enabled' },
  'doctor-publish-availability': { from: 'doctor-operational', to: 'availability-published', role: 'doctor', event: 'availability.published' },
  'patient-book': { from: 'availability-published', to: 'appointment-booked', role: 'patient', event: 'appointment.booked' },
  'doctor-complete-consultation': { from: 'appointment-booked', to: 'consultation-complete', role: 'doctor', event: 'eligibility.synthetic.recorded' },
  'doctor-prepare-receipt': { from: 'consultation-complete', to: 'receipt-active', role: 'doctor', event: 'receipt.fixture.activated' },
  'patient-open-directory': { from: 'receipt-active', to: 'directory-enabled', role: 'patient', event: 'directory.access.enabled' },
  'dispensary-record-partial': { from: 'directory-enabled', to: 'dispense-partial', role: 'dispensary', event: 'receipt.fixture.partial' },
  'dispensary-record-total': { from: 'dispense-partial', to: 'dispense-complete', role: 'dispensary', event: 'receipt.fixture.dispensed' },
  'admin-open-audit': { from: 'dispense-complete', to: 'admin-audit', role: 'admin', event: 'audit.review.opened' },
};

function reject(state: PilotFlowState, reason: string): PilotFlowState {
  return { ...state, lastError: reason };
}

export function advancePilotFlow(state: PilotFlowState, action: PilotAction): PilotFlowState {
  if (action.type === 'reset') {
    if (action.actor !== 'admin') return reject(state, 'Sólo el rol admin puede reiniciar la demo.');
    return INITIAL_PILOT_FLOW;
  }

  const transition = TRANSITIONS[action.type];
  if (action.actor !== transition.role) return reject(state, 'Acción denegada para el rol activo.');
  if (state.phase !== transition.from) return reject(state, 'Transición fuera de orden bloqueada.');

  if (action.type === 'doctor-complete-consultation' && (!action.consent || !action.syntheticEligible)) {
    return reject(state, 'Consentimiento y decisión sintética son gates obligatorios.');
  }

  if ((action.type === 'dispensary-record-partial' || action.type === 'dispensary-record-total') && action.qrHandle !== PILOT_QR_HANDLE) {
    return reject(state, 'QR inválido o manipulado; no se registró el evento.');
  }

  const version = state.version + 1;
  const entry: PilotAuditEntry = Object.freeze({ sequence: version, actor: action.actor, event: transition.event, result: 'accepted' });
  return {
    phase: transition.to,
    version,
    audit: Object.freeze([...state.audit, entry]),
    lastError: null,
  };
}

export function phaseDefinition(phase: PilotPhase): PilotPhaseDefinition {
  return PILOT_PHASES.find(item => item.phase === phase) ?? PILOT_PHASES[0];
}

export function phaseIndex(phase: PilotPhase): number {
  return PILOT_PHASES.findIndex(item => item.phase === phase);
}
