import { createHmac } from 'node:crypto';

export type ClinicalPlatformMode = 'memory-fixture' | 'supabase-postgres';
export type ClinicalActorRole = 'doctor' | 'patient' | 'dispensary' | 'admin';

export interface ClinicalPlatformConfig {
  mode: ClinicalPlatformMode;
  projectUrl?: string;
  jwksUrl?: string;
  databaseUrl?: string;
  kmsKeyId?: string;
  backupVerifiedAt?: string;
  rlsEvidenceDigest?: string;
  approvedRlsEvidenceDigest?: string;
  allowedHosts?: readonly string[];
  authIssuer?: string;
  authAudience?: string;
  now?: Date;
}

export interface SyntheticActorBinding {
  fixture: true;
  subjectRef: string;
  actorRef: string;
  role: ClinicalActorRole;
  status: 'pending' | 'active' | 'suspended';
  version: number;
}

export interface SyntheticClinicalEnvelope {
  fixture: true;
  objectRef: string;
  ownerActorRef: string;
  kind: 'consent' | 'encounter' | 'clinical-note' | 'receipt-detail';
  ciphertextRef: string;
  wrappedKeyRef: string;
  keyVersion: number;
  retentionClass: 'clinical-review-required';
}

export interface ClinicalPersistencePort {
  putActor(binding: SyntheticActorBinding, expectedVersion: number | null): Promise<void>;
  getActorForSubject(subjectRef: string): Promise<SyntheticActorBinding | null>;
  putEnvelope(envelope: SyntheticClinicalEnvelope): Promise<void>;
  getEnvelope(objectRef: string, actorRef: string): Promise<SyntheticClinicalEnvelope | null>;
}

const OPAQUE_REF = /^tl_[a-z]+_[A-Za-z0-9_-]{24,96}$/;
const SAFE_CIPHERTEXT_REF = /^fixture-ciphertext:[A-Za-z0-9_-]{16,96}$/;
const SAFE_KEY_REF = /^fixture-wrapped-key:[A-Za-z0-9_-]{16,96}$/;

/** Defines the migration boundary without connecting to external infrastructure. */
export function createClinicalPersistencePort(config: ClinicalPlatformConfig): ClinicalPersistencePort {
  if (config.mode === 'supabase-postgres') {
    validateSupabaseConfig(config);
    throw readinessError('SUPABASE_ADAPTER_NOT_PROVISIONED');
  }

  const actors = new Map<string, SyntheticActorBinding>();
  const actorSubjects = new Map<string, string>();
  const envelopes = new Map<string, SyntheticClinicalEnvelope>();
  return {
    async putActor(binding, expectedVersion) {
      assertFixture(binding.fixture);
      validateOpaqueRef(binding.subjectRef, 'SUBJECT_REF_INVALID');
      validateOpaqueRef(binding.actorRef, 'ACTOR_REF_INVALID');
      if (!Number.isSafeInteger(binding.version) || binding.version < 1) throw readinessError('ACTOR_VERSION_INVALID');
      const current = actors.get(binding.subjectRef);
      if (current) {
        if (expectedVersion !== current.version || binding.version !== current.version + 1) throw readinessError('ACTOR_VERSION_CONFLICT');
        if (current.actorRef !== binding.actorRef || current.role !== binding.role) throw readinessError('ACTOR_BINDING_IMMUTABLE');
      } else if (expectedVersion !== null || binding.version !== 1) {
        throw readinessError('ACTOR_VERSION_CONFLICT');
      }
      const boundSubject = actorSubjects.get(binding.actorRef);
      if (boundSubject && boundSubject !== binding.subjectRef) throw readinessError('ACTOR_ALREADY_BOUND');
      actors.set(binding.subjectRef, structuredClone(binding));
      actorSubjects.set(binding.actorRef, binding.subjectRef);
    },
    async getActorForSubject(subjectRef) {
      validateOpaqueRef(subjectRef, 'SUBJECT_REF_INVALID');
      const binding = actors.get(subjectRef);
      return binding ? structuredClone(binding) : null;
    },
    async putEnvelope(envelope) {
      assertFixture(envelope.fixture);
      validateOpaqueRef(envelope.objectRef, 'OBJECT_REF_INVALID');
      validateOpaqueRef(envelope.ownerActorRef, 'ACTOR_REF_INVALID');
      if (!SAFE_CIPHERTEXT_REF.test(envelope.ciphertextRef)) throw readinessError('CIPHERTEXT_REF_INVALID');
      if (!SAFE_KEY_REF.test(envelope.wrappedKeyRef)) throw readinessError('WRAPPED_KEY_REF_INVALID');
      if (!Number.isSafeInteger(envelope.keyVersion) || envelope.keyVersion < 1) throw readinessError('KEY_VERSION_INVALID');
      assertNoForbiddenFields(envelope);
      envelopes.set(envelope.objectRef, structuredClone(envelope));
    },
    async getEnvelope(objectRef, actorRef) {
      validateOpaqueRef(objectRef, 'OBJECT_REF_INVALID');
      validateOpaqueRef(actorRef, 'ACTOR_REF_INVALID');
      const envelope = envelopes.get(objectRef);
      if (!envelope || envelope.ownerActorRef !== actorRef) return null;
      return structuredClone(envelope);
    },
  };
}

export function createOpaqueClinicalRef(namespaceKey: Uint8Array, kind: string, syntheticId: string): string {
  if (namespaceKey.byteLength < 32) throw readinessError('NAMESPACE_KEY_INVALID');
  if (!/^[a-z]{3,20}$/.test(kind)) throw readinessError('REFERENCE_KIND_INVALID');
  if (!/^fixture-[a-z0-9-]{8,96}$/.test(syntheticId)) throw readinessError('SYNTHETIC_ID_REQUIRED');
  const digest = createHmac('sha256', namespaceKey).update(`${kind}:${syntheticId}`).digest('base64url');
  return `tl_${kind}_${digest}`;
}

function validateSupabaseConfig(config: ClinicalPlatformConfig) {
  if (!config.projectUrl || !isHttpsUrl(config.projectUrl)) throw readinessError('SUPABASE_PROJECT_URL_REQUIRED');
  if (!config.jwksUrl || !isHttpsUrl(config.jwksUrl)) throw readinessError('SUPABASE_JWKS_URL_REQUIRED');
  if (!config.databaseUrl?.startsWith('postgresql://')) throw readinessError('SUPABASE_DATABASE_URL_REQUIRED');
  const projectHost = new URL(config.projectUrl).hostname;
  const jwksHost = new URL(config.jwksUrl).hostname;
  const database = new URL(config.databaseUrl);
  if (!config.allowedHosts?.includes(projectHost) || !config.allowedHosts.includes(jwksHost) || !config.allowedHosts.includes(database.hostname)) throw readinessError('SUPABASE_HOST_NOT_ALLOWLISTED');
  if (database.searchParams.get('sslmode') !== 'require') throw readinessError('SUPABASE_TLS_REQUIRED');
  if (!config.authIssuer || !isHttpsUrl(config.authIssuer)) throw readinessError('SUPABASE_AUTH_ISSUER_REQUIRED');
  if (!config.authAudience?.trim()) throw readinessError('SUPABASE_AUTH_AUDIENCE_REQUIRED');
  if (!config.kmsKeyId?.trim()) throw readinessError('EXTERNAL_KMS_KEY_ID_REQUIRED');
  if (!/^sha256:[a-f0-9]{64}$/.test(config.rlsEvidenceDigest ?? '')) throw readinessError('RLS_EVIDENCE_REQUIRED');
  if (config.rlsEvidenceDigest !== config.approvedRlsEvidenceDigest) throw readinessError('RLS_EVIDENCE_NOT_APPROVED');
  if (!config.backupVerifiedAt || Number.isNaN(Date.parse(config.backupVerifiedAt))) throw readinessError('BACKUP_RESTORE_EVIDENCE_REQUIRED');
  const now = config.now ?? new Date();
  const backupTime = new Date(config.backupVerifiedAt).getTime();
  if (backupTime > now.getTime() || now.getTime() - backupTime > 31 * 24 * 60 * 60 * 1000) throw readinessError('BACKUP_RESTORE_EVIDENCE_STALE');
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
function validateOpaqueRef(value: string, code: string) { if (!OPAQUE_REF.test(value)) throw readinessError(code); }
function assertFixture(value: boolean) { if (value !== true) throw readinessError('SYNTHETIC_FIXTURE_REQUIRED'); }
function assertNoForbiddenFields(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const field of ['rut', 'email', 'diagnosis', 'diagnostico', 'dose', 'dosis', 'gramaje', 'address', 'wallet']) {
    if (serialized.includes(`\"${field}\"`)) throw readinessError('FORBIDDEN_CLINICAL_FIELD');
  }
}
function readinessError(code: string) { return Object.assign(new Error(code), { code }); }
