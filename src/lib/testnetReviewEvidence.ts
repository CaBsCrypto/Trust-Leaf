import { SYNTHETIC_RECEIPT_TOKEN } from '../../shared/receipt-demo-contract.ts';
import type { ReadonlyReceiptFixture, ReadonlyRole } from './readonlyRoleReceipt.ts';

export const DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID = 'CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3';
export const STELLAR_EXPERT_CONTRACT_URL = `https://stellar.expert/explorer/testnet/contract/${DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID}`;
export type ReviewScenario = 'lifecycle' | 'revoked' | 'expired' | 'unknown';
export interface TestnetEvidenceLink { label: string; state: string; url: string }
const transaction = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

export const TESTNET_EVIDENCE_LINKS: readonly TestnetEvidenceLink[] = [
  { label: 'Issued', state: 'issued', url: transaction('6ae42822f355c848a878c4a75c5d86a8beec93d50913e42da22e55fe02eb241f') },
  { label: 'Active', state: 'active', url: transaction('24c600d34b808fd66c1bd074278e21bd9eaedd83ed90d7feec024f3004de848a') },
  { label: 'Partial', state: 'partial', url: transaction('e5ce314dea2a5d1c65a13e26900b692552867225229c2717acafb40fb5b5fe6d') },
  { label: 'Dispensed', state: 'dispensed', url: transaction('8a972d679987c5223e45fac0d784ab30b3eb7395f52570873fda24cca690ac86') },
  { label: 'Revoked', state: 'revoked', url: transaction('fa758ef79cd0bd9e4aaf11bf3361803dd29d4a0a1479a99a409982d7f4ccfb6e') },
  { label: 'Expired', state: 'expired', url: transaction('418789eeb55cc41ae2c3e00d90ce75d7bd03635013a6913cd04914ec1425a06f') },
] as const;

export const REVIEW_SCENARIOS: Record<ReviewScenario, ReadonlyReceiptFixture> = {
  lifecycle: { opaqueReceiptRef: 'rcpt_7yH4mJ2qP8vN6kL3', state: 'dispensed', version: 4, finality: 'confirmed', timeline: [{ version: 1, state: 'issued' }, { version: 2, state: 'active' }, { version: 3, state: 'partial' }, { version: 4, state: 'dispensed' }], publicToken: SYNTHETIC_RECEIPT_TOKEN },
  revoked: { opaqueReceiptRef: 'rcpt_4nD7qL2wT8mP5sK9', state: 'revoked', version: 2, finality: 'confirmed', timeline: [{ version: 1, state: 'issued' }, { version: 2, state: 'revoked' }], publicToken: SYNTHETIC_RECEIPT_TOKEN },
  expired: { opaqueReceiptRef: 'rcpt_6pR3vM9xJ2kN8tW4', state: 'expired', version: 2, finality: 'confirmed', timeline: [{ version: 1, state: 'issued' }, { version: 2, state: 'expired' }], publicToken: SYNTHETIC_RECEIPT_TOKEN },
  unknown: { opaqueReceiptRef: 'rcpt_8xQ2mH7vL4pS9nK3', state: 'unknown', version: 0, finality: 'unknown', timeline: [], publicToken: SYNTHETIC_RECEIPT_TOKEN },
};

const ROLES: readonly ReadonlyRole[] = ['doctor', 'patient', 'dispensary', 'admin'];
const SCENARIOS: readonly ReviewScenario[] = ['lifecycle', 'revoked', 'expired', 'unknown'];
export function parseReviewSelection(search: string): { role: ReadonlyRole; scenario: ReviewScenario } {
  const params = new URLSearchParams(search);
  const requestedRole = params.get('role') as ReadonlyRole | null;
  const requestedScenario = params.get('scenario') as ReviewScenario | null;
  return { role: requestedRole && ROLES.includes(requestedRole) ? requestedRole : 'doctor', scenario: requestedScenario && SCENARIOS.includes(requestedScenario) ? requestedScenario : 'lifecycle' };
}
export function reviewSearch(role: ReadonlyRole, scenario: ReviewScenario): string { return `?role=${encodeURIComponent(role)}&scenario=${encodeURIComponent(scenario)}`; }
