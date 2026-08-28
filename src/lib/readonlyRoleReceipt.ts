import { SYNTHETIC_RECEIPT_TOKEN } from '../../shared/receipt-demo-contract.ts';

export type ReadonlyRole = 'doctor' | 'patient' | 'dispensary' | 'admin';
export type ReadonlyReceiptState = 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired' | 'unknown';

export interface ReadonlyReceiptFixture {
  opaqueReceiptRef: string;
  state: ReadonlyReceiptState;
  version: number;
  finality: 'pending' | 'confirmed' | 'unknown';
  timeline: readonly { version: number; state: Exclude<ReadonlyReceiptState, 'unknown'> }[];
  publicToken: string;
}

export interface ReadonlyRoleProjection {
  role: ReadonlyRole;
  mode: 'synthetic-read-only';
  receiptRef: string;
  status: ReadonlyReceiptState;
  finality: ReadonlyReceiptFixture['finality'];
  timeline?: ReadonlyReceiptFixture['timeline'];
  publicToken?: string;
  operationalDetailVisible: false;
  mutationsAvailable: false;
}

export const SYNTHETIC_READONLY_RECEIPT: ReadonlyReceiptFixture = {
  opaqueReceiptRef: 'rcpt_7yH4mJ2qP8vN6kL3',
  state: 'partial',
  version: 3,
  finality: 'confirmed',
  timeline: [
    { version: 1, state: 'issued' },
    { version: 2, state: 'active' },
    { version: 3, state: 'partial' },
  ],
  publicToken: SYNTHETIC_RECEIPT_TOKEN,
};

export function projectReadonlyReceiptForRole(role: ReadonlyRole, fixture: ReadonlyReceiptFixture): ReadonlyRoleProjection {
  const base: ReadonlyRoleProjection = {
    role,
    mode: 'synthetic-read-only',
    receiptRef: fixture.opaqueReceiptRef,
    status: fixture.state,
    finality: fixture.finality,
    operationalDetailVisible: false,
    mutationsAvailable: false,
  };
  if (role === 'patient') return { ...base, publicToken: fixture.publicToken };
  if (role === 'doctor' || role === 'dispensary') return { ...base, timeline: fixture.timeline.map(event => ({ ...event })) };
  return base;
}

export function publicReadonlyProjection(fixture: ReadonlyReceiptFixture) {
  const exists = fixture.state !== 'unknown';
  return {
    demo: true as const,
    evidenceExists: exists,
    proofMatches: exists,
    status: fixture.state === 'revoked' ? 'revoked' as const
      : fixture.state === 'expired' ? 'expired' as const
        : ['active', 'partial', 'issued'].includes(fixture.state) ? 'active' as const
          : fixture.state === 'dispensed' ? 'dispensed' as const
            : 'unavailable' as const,
  };
}
