export type TrustChainScenario =
  | 'active'
  | 'doctor-validated'
  | 'doctor-suspended'
  | 'dispensary-validated'
  | 'dispensary-expired'
  | 'patient-eligible'
  | 'eligibility-revoked'
  | 'receipt-issued'
  | 'receipt-active'
  | 'receipt-partial'
  | 'receipt-dispensed'
  | 'receipt-revoked'
  | 'admin-audit';

export type TrustCredentialState = 'active' | 'suspended' | 'revoked' | 'expired';
export type TrustReceiptReviewState = 'not-issued' | 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'blocked';
export type TrustReviewRole = 'admin' | 'doctor' | 'patient' | 'dispensary';

export interface TrustCredentialFixture {
  kind: 'doctor' | 'patient-eligibility' | 'dispensary';
  credentialRef: string;
  authorityRef: string;
  state: TrustCredentialState;
  version: number;
  expiry: string;
}

export interface TrustAuditEventFixture {
  eventRef: string;
  actorRole: TrustReviewRole;
  action: string;
  result: 'accepted' | 'blocked';
  version: number;
}

export interface TrustAuthorizationFixture {
  scenario: TrustChainScenario;
  actorRole: TrustReviewRole;
  stepLabel: string;
  outcomeLabel: string;
  expectedEvent: string;
  receiptRef: string;
  receiptState: TrustReceiptReviewState;
  receiptVersion: number;
  chainAllowed: boolean;
  credentials: readonly TrustCredentialFixture[];
  audit: readonly TrustAuditEventFixture[];
}

const DOCTOR_REF = 'cred_dr_8Gv4…Q2mN';
const ELIGIBILITY_REF = 'cred_el_5Px9…H7kR';
const DISPENSARY_REF = 'cred_ds_3Wt6…L1cV';
const RECEIPT_REF = 'rcpt_v2_7Ny4…K9pQ';

function credentialFixtures(overrides: Partial<Record<TrustCredentialFixture['kind'], TrustCredentialState>> = {}): readonly TrustCredentialFixture[] {
  return [
    { kind: 'doctor', credentialRef: DOCTOR_REF, authorityRef: 'rol admin técnico', state: overrides.doctor ?? 'active', version: overrides.doctor ? 2 : 1, expiry: 'ventana fixture configurada' },
    { kind: 'patient-eligibility', credentialRef: ELIGIBILITY_REF, authorityRef: DOCTOR_REF, state: overrides['patient-eligibility'] ?? 'active', version: overrides['patient-eligibility'] ? 2 : 1, expiry: 'ventana fixture configurada' },
    { kind: 'dispensary', credentialRef: DISPENSARY_REF, authorityRef: 'rol admin técnico', state: overrides.dispensary ?? 'active', version: overrides.dispensary ? 2 : 1, expiry: 'ventana fixture configurada' },
  ];
}

function audit(actorRole: TrustReviewRole, action: string, result: TrustAuditEventFixture['result'], version: number): readonly TrustAuditEventFixture[] {
  return [{ eventRef: `evt_fixture_v${version}`, actorRole, action, result, version }];
}

function fixture(input: Omit<TrustAuthorizationFixture, 'receiptRef' | 'credentials' | 'audit'> & {
  credentials?: readonly TrustCredentialFixture[];
  audit?: readonly TrustAuditEventFixture[];
}): TrustAuthorizationFixture {
  return {
    ...input,
    receiptRef: RECEIPT_REF,
    credentials: input.credentials ?? credentialFixtures(),
    // The transition shown by a fixture is accepted; chainAllowed describes
    // whether a later business action remains permitted after that transition.
    audit: input.audit ?? audit(input.actorRole, input.expectedEvent, 'accepted', input.receiptVersion),
  };
}

export const TRUST_CHAIN_SCENARIOS: Record<TrustChainScenario, TrustAuthorizationFixture> = {
  active: fixture({ scenario: 'active', actorRole: 'doctor', stepLabel: 'Cadena activa (compatibilidad)', outcomeLabel: 'Receipt activo', expectedEvent: 'ReceiptChanged:Active', receiptState: 'active', receiptVersion: 2, chainAllowed: true }),
  'doctor-validated': fixture({ scenario: 'doctor-validated', actorRole: 'admin', stepLabel: 'Validar médico técnico', outcomeLabel: 'Credencial médica activa', expectedEvent: 'ActorCredentialIssued', receiptState: 'not-issued', receiptVersion: 0, chainAllowed: true, audit: audit('admin', 'ActorCredentialIssued', 'accepted', 1) }),
  'doctor-suspended': fixture({ scenario: 'doctor-suspended', actorRole: 'admin', stepLabel: 'Suspender médico técnico', outcomeLabel: 'Acciones médicas bloqueadas', expectedEvent: 'ActorCredentialSuspended', receiptState: 'blocked', receiptVersion: 0, chainAllowed: false, credentials: credentialFixtures({ doctor: 'suspended' }), audit: audit('admin', 'ActorCredentialSuspended', 'accepted', 2) }),
  'dispensary-validated': fixture({ scenario: 'dispensary-validated', actorRole: 'admin', stepLabel: 'Validar dispensario técnico', outcomeLabel: 'Credencial de dispensario activa', expectedEvent: 'ActorCredentialIssued', receiptState: 'not-issued', receiptVersion: 0, chainAllowed: true, audit: audit('admin', 'ActorCredentialIssued', 'accepted', 1) }),
  'dispensary-expired': fixture({ scenario: 'dispensary-expired', actorRole: 'admin', stepLabel: 'Materializar expiry de dispensario', outcomeLabel: 'Dispensación bloqueada', expectedEvent: 'ActorCredentialExpired', receiptState: 'blocked', receiptVersion: 2, chainAllowed: false, credentials: credentialFixtures({ dispensary: 'expired' }) }),
  'patient-eligible': fixture({ scenario: 'patient-eligible', actorRole: 'doctor', stepLabel: 'Registrar elegibilidad operativa', outcomeLabel: 'Elegibilidad opaca activa', expectedEvent: 'EligibilityIssued', receiptState: 'not-issued', receiptVersion: 0, chainAllowed: true, audit: audit('doctor', 'EligibilityIssued', 'accepted', 1) }),
  'eligibility-revoked': fixture({ scenario: 'eligibility-revoked', actorRole: 'doctor', stepLabel: 'Revocar elegibilidad operativa', outcomeLabel: 'Emisión y dispensación bloqueadas', expectedEvent: 'EligibilityRevoked', receiptState: 'blocked', receiptVersion: 2, chainAllowed: false, credentials: credentialFixtures({ 'patient-eligibility': 'revoked' }) }),
  'receipt-issued': fixture({ scenario: 'receipt-issued', actorRole: 'doctor', stepLabel: 'Emitir receipt técnico', outcomeLabel: 'Receipt emitido', expectedEvent: 'ReceiptChanged:Issued', receiptState: 'issued', receiptVersion: 1, chainAllowed: true }),
  'receipt-active': fixture({ scenario: 'receipt-active', actorRole: 'doctor', stepLabel: 'Activar receipt técnico', outcomeLabel: 'Receipt activo', expectedEvent: 'ReceiptChanged:Active', receiptState: 'active', receiptVersion: 2, chainAllowed: true }),
  'receipt-partial': fixture({ scenario: 'receipt-partial', actorRole: 'dispensary', stepLabel: 'Registrar evento parcial', outcomeLabel: 'Receipt parcial', expectedEvent: 'ReceiptChanged:Partial', receiptState: 'partial', receiptVersion: 3, chainAllowed: true }),
  'receipt-dispensed': fixture({ scenario: 'receipt-dispensed', actorRole: 'dispensary', stepLabel: 'Cerrar receipt dispensado', outcomeLabel: 'Receipt dispensado', expectedEvent: 'ReceiptChanged:Dispensed', receiptState: 'dispensed', receiptVersion: 4, chainAllowed: true }),
  'receipt-revoked': fixture({ scenario: 'receipt-revoked', actorRole: 'doctor', stepLabel: 'Revocar receipt técnico', outcomeLabel: 'Receipt revocado', expectedEvent: 'ReceiptChanged:Revoked', receiptState: 'revoked', receiptVersion: 3, chainAllowed: false }),
  'admin-audit': fixture({
    scenario: 'admin-audit', actorRole: 'admin', stepLabel: 'Revisar auditoría técnica', outcomeLabel: 'Secuencia versionada cotejable', expectedEvent: 'AuditReview', receiptState: 'partial', receiptVersion: 3, chainAllowed: true,
    audit: [
      { eventRef: 'evt_fixture_v1', actorRole: 'doctor', action: 'ReceiptChanged:Issued', result: 'accepted', version: 1 },
      { eventRef: 'evt_fixture_v2', actorRole: 'doctor', action: 'ReceiptChanged:Active', result: 'accepted', version: 2 },
      { eventRef: 'evt_fixture_v3', actorRole: 'dispensary', action: 'ReceiptChanged:Partial', result: 'accepted', version: 3 },
    ],
  }),
};

const ALLOWED_SCENARIOS = Object.keys(TRUST_CHAIN_SCENARIOS) as TrustChainScenario[];

export function parseTrustChainScenario(search: string): TrustChainScenario {
  const requested = new URLSearchParams(search).get('scenario') as TrustChainScenario | null;
  return requested && ALLOWED_SCENARIOS.includes(requested) ? requested : 'active';
}

export function trustChainSearch(scenario: TrustChainScenario): string {
  return `?scenario=${encodeURIComponent(scenario)}`;
}
