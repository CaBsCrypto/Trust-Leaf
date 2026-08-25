export type TrustChainScenario = 'active' | 'doctor-suspended' | 'eligibility-revoked' | 'dispensary-expired';
export type TrustCredentialState = 'active' | 'suspended' | 'revoked' | 'expired';

export interface TrustCredentialFixture {
  kind: 'doctor' | 'patient-eligibility' | 'dispensary';
  credentialRef: string;
  authorityRef: string;
  state: TrustCredentialState;
  version: number;
  expiry: string;
}

export interface TrustAuthorizationFixture {
  scenario: TrustChainScenario;
  receiptRef: string;
  receiptState: 'active' | 'blocked';
  receiptVersion: number;
  chainAllowed: boolean;
  credentials: readonly TrustCredentialFixture[];
}

const DOCTOR_REF = 'cred_dr_8Gv4…Q2mN';
const ELIGIBILITY_REF = 'cred_el_5Px9…H7kR';
const DISPENSARY_REF = 'cred_ds_3Wt6…L1cV';

function credentialFixtures(overrides: Partial<Record<TrustCredentialFixture['kind'], TrustCredentialState>> = {}): readonly TrustCredentialFixture[] {
  return [
    { kind: 'doctor', credentialRef: DOCTOR_REF, authorityRef: 'admin técnico', state: overrides.doctor ?? 'active', version: overrides.doctor ? 2 : 1, expiry: '2026-09-30T00:00Z · fixture' },
    { kind: 'patient-eligibility', credentialRef: ELIGIBILITY_REF, authorityRef: DOCTOR_REF, state: overrides['patient-eligibility'] ?? 'active', version: overrides['patient-eligibility'] ? 2 : 1, expiry: '2026-09-07T00:00Z · fixture' },
    { kind: 'dispensary', credentialRef: DISPENSARY_REF, authorityRef: 'admin técnico', state: overrides.dispensary ?? 'active', version: overrides.dispensary ? 2 : 1, expiry: '2026-09-30T00:00Z · fixture' },
  ];
}

export const TRUST_CHAIN_SCENARIOS: Record<TrustChainScenario, TrustAuthorizationFixture> = {
  active: { scenario: 'active', receiptRef: 'rcpt_v2_7Ny4…K9pQ', receiptState: 'active', receiptVersion: 2, chainAllowed: true, credentials: credentialFixtures() },
  'doctor-suspended': { scenario: 'doctor-suspended', receiptRef: 'rcpt_v2_7Ny4…K9pQ', receiptState: 'blocked', receiptVersion: 2, chainAllowed: false, credentials: credentialFixtures({ doctor: 'suspended' }) },
  'eligibility-revoked': { scenario: 'eligibility-revoked', receiptRef: 'rcpt_v2_7Ny4…K9pQ', receiptState: 'blocked', receiptVersion: 2, chainAllowed: false, credentials: credentialFixtures({ 'patient-eligibility': 'revoked' }) },
  'dispensary-expired': { scenario: 'dispensary-expired', receiptRef: 'rcpt_v2_7Ny4…K9pQ', receiptState: 'blocked', receiptVersion: 2, chainAllowed: false, credentials: credentialFixtures({ dispensary: 'expired' }) },
};

const ALLOWED_SCENARIOS = Object.keys(TRUST_CHAIN_SCENARIOS) as TrustChainScenario[];

export function parseTrustChainScenario(search: string): TrustChainScenario {
  const requested = new URLSearchParams(search).get('scenario') as TrustChainScenario | null;
  return requested && ALLOWED_SCENARIOS.includes(requested) ? requested : 'active';
}

export function trustChainSearch(scenario: TrustChainScenario): string {
  return `?scenario=${encodeURIComponent(scenario)}`;
}
