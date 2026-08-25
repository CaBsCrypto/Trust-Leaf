import type { TrustChainScenario, TrustReviewRole } from './trustRegistryReview';

export type V2ReaderHealth = 'current' | 'stale' | 'unknown';
export type V2Finality = 'local-fixture' | 'pending' | 'finalized' | 'unknown';
export type V2ReorgState = 'none' | 'reconciling' | 'blocked';

export interface V2AllowlistedEvidence {
  label: string;
  explorerUrl: string;
  contractRef: string;
  eventRef: string;
}

export interface V2ReadonlyEvidenceSnapshot {
  schemaVersion: 1;
  scenario: TrustChainScenario;
  viewerRole: TrustReviewRole;
  source: 'local-fixture' | 'sanitized-indexer';
  health: V2ReaderHealth;
  freshnessLabel: string;
  cursorLabel: string;
  finality: V2Finality;
  reorgState: V2ReorgState;
  observedState: string;
  evidence: V2AllowlistedEvidence | null;
  blockedReason: string | null;
}

export interface V2ReadonlyEvidencePort {
  readScenario(scenario: TrustChainScenario, viewerRole: TrustReviewRole): unknown;
}

const OPAQUE_REF = /^[a-z0-9_]{2,24}_[A-Za-z0-9]{2,12}…[A-Za-z0-9]{2,12}$/;
const ALLOWED_EXPLORER_ORIGIN = 'https://stellar.expert';
const SNAPSHOT_KEYS = ['schemaVersion', 'scenario', 'viewerRole', 'source', 'health', 'freshnessLabel', 'cursorLabel', 'finality', 'reorgState', 'observedState', 'evidence', 'blockedReason'] as const;
const EVIDENCE_KEYS = ['label', 'explorerUrl', 'contractRef', 'eventRef'] as const;
const FRESHNESS_LABELS = ['fixture reproducible', 'checkpoint reciente', 'checkpoint atrasado', 'sin lectura verificable'] as const;
const BLOCKED_REASONS = [
  'Reader/indexer Testnet aún no conectado',
  'Snapshot no verificable',
  'Lector read-only no disponible',
  'Fixture local no puede publicar evidencia Testnet',
  'Evidencia bloqueada por finality o reconciliación',
] as const;

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeEvidence(value: unknown): value is V2AllowlistedEvidence {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!hasExactKeys(candidate, EVIDENCE_KEYS) || candidate.label !== 'Abrir evidencia técnica Testnet' || !OPAQUE_REF.test(String(candidate.contractRef)) || !OPAQUE_REF.test(String(candidate.eventRef))) return false;
  if (typeof candidate.explorerUrl !== 'string') return false;
  try {
    const url = new URL(candidate.explorerUrl);
    const safePath = /^\/explorer\/testnet\/(?:tx\/[a-f0-9]{64}|contract\/C[A-Z2-7]{55})$/.test(url.pathname);
    return url.origin === ALLOWED_EXPLORER_ORIGIN
      && safePath
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === '';
  } catch {
    return false;
  }
}

export function failClosedV2Evidence(scenario: TrustChainScenario, viewerRole: TrustReviewRole, reason = 'Snapshot no verificable'): V2ReadonlyEvidenceSnapshot {
  return {
    schemaVersion: 1,
    scenario,
    viewerRole,
    source: 'local-fixture',
    health: 'unknown',
    freshnessLabel: 'sin lectura verificable',
    cursorLabel: 'cursor no disponible',
    finality: 'unknown',
    reorgState: 'blocked',
    observedState: 'unknown',
    evidence: null,
    blockedReason: reason,
  };
}

export function sanitizeV2EvidenceSnapshot(value: unknown, scenario: TrustChainScenario, viewerRole: TrustReviewRole): V2ReadonlyEvidenceSnapshot {
  if (!value || typeof value !== 'object') return failClosedV2Evidence(scenario, viewerRole);
  const candidate = value as Record<string, unknown>;
  const health = candidate.health;
  const finality = candidate.finality;
  const reorgState = candidate.reorgState;
  const source = candidate.source;
  const evidence = candidate.evidence;
  const blockedReason = candidate.blockedReason;

  const valid = hasExactKeys(candidate, SNAPSHOT_KEYS)
    && candidate.schemaVersion === 1
    && candidate.scenario === scenario
    && candidate.viewerRole === viewerRole
    && (source === 'local-fixture' || source === 'sanitized-indexer')
    && (health === 'current' || health === 'stale' || health === 'unknown')
    && (finality === 'local-fixture' || finality === 'pending' || finality === 'finalized' || finality === 'unknown')
    && (reorgState === 'none' || reorgState === 'reconciling' || reorgState === 'blocked')
    && FRESHNESS_LABELS.includes(candidate.freshnessLabel as (typeof FRESHNESS_LABELS)[number])
    && (candidate.cursorLabel === 'checkpoint local · sin ledger' || candidate.cursorLabel === 'cursor no disponible' || /^ledger \d{1,12} · cursor \d{1,12}$/.test(String(candidate.cursorLabel)))
    && (/^(?:not-issued|issued|active|partial|dispensed|revoked|blocked)(?: · v\d{1,6})?$/.test(String(candidate.observedState)) || candidate.observedState === 'fixture sanitizado' || candidate.observedState === 'unknown')
    && (blockedReason === null || BLOCKED_REASONS.includes(blockedReason as (typeof BLOCKED_REASONS)[number]))
    && (evidence === null || safeEvidence(evidence));

  if (!valid) return failClosedV2Evidence(scenario, viewerRole);
  if (source === 'local-fixture' && evidence !== null) return failClosedV2Evidence(scenario, viewerRole, 'Fixture local no puede publicar evidencia Testnet');
  if (evidence !== null && (health !== 'current' || finality !== 'finalized' || reorgState !== 'none')) {
    return failClosedV2Evidence(scenario, viewerRole, 'Evidencia bloqueada por finality o reconciliación');
  }

  return candidate as unknown as V2ReadonlyEvidenceSnapshot;
}

export function readV2Evidence(port: V2ReadonlyEvidencePort, scenario: TrustChainScenario, viewerRole: TrustReviewRole): V2ReadonlyEvidenceSnapshot {
  try {
    return sanitizeV2EvidenceSnapshot(port.readScenario(scenario, viewerRole), scenario, viewerRole);
  } catch {
    return failClosedV2Evidence(scenario, viewerRole, 'Lector read-only no disponible');
  }
}

export const LOCAL_V2_READONLY_EVIDENCE_PORT: V2ReadonlyEvidencePort = {
  readScenario(scenario, viewerRole): V2ReadonlyEvidenceSnapshot {
    return {
      schemaVersion: 1,
      scenario,
      viewerRole,
      source: 'local-fixture',
      health: 'current',
      freshnessLabel: 'fixture reproducible',
      cursorLabel: 'checkpoint local · sin ledger',
      finality: 'local-fixture',
      reorgState: 'none',
      observedState: 'fixture sanitizado',
      evidence: null,
      blockedReason: 'Reader/indexer Testnet aún no conectado',
    };
  },
};
