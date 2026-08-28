import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface DurableStoreConfig {
  mode: 'memory-fixture' | 'postgres';
  databaseUrl?: string;
  kmsKeyId?: string;
  retentionDays: number;
  backupVerifiedAt?: string;
}

export function loadDurableStoreConfig(env: NodeJS.ProcessEnv): DurableStoreConfig {
  const mode = env.TRUSTLEAF_DURABLE_STORE_MODE;
  if (mode !== 'memory-fixture' && mode !== 'postgres') throw new Error('DURABLE_STORE_MODE_REQUIRED');
  const retentionDays = Number(env.TRUSTLEAF_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error('INVALID_RETENTION_DAYS');
  if (mode === 'postgres') {
    if (!env.TRUSTLEAF_DATABASE_URL?.startsWith('postgres')) throw new Error('POSTGRES_URL_REQUIRED');
    if (!env.TRUSTLEAF_KMS_KEY_ID) throw new Error('KMS_KEY_ID_REQUIRED');
    if (!env.TRUSTLEAF_BACKUP_VERIFIED_AT) throw new Error('BACKUP_VERIFICATION_REQUIRED');
  }
  return {
    mode,
    databaseUrl: env.TRUSTLEAF_DATABASE_URL,
    kmsKeyId: env.TRUSTLEAF_KMS_KEY_ID,
    retentionDays,
    backupVerifiedAt: env.TRUSTLEAF_BACKUP_VERIFIED_AT,
  };
}

export interface WrappedDataKey { keyId: string; keyVersion: number; wrapped: string }
export interface KeyCustodyPort {
  activeVersion(keyId: string): Promise<number>;
  wrap(keyId: string, plaintextKey: Uint8Array): Promise<WrappedDataKey>;
  unwrap(key: WrappedDataKey): Promise<Uint8Array>;
}

export interface EncryptedRow {
  opaqueId: string;
  revision: number;
  schema: 'trustleaf.offchain-envelope.v1';
  key: WrappedDataKey;
  iv: string;
  ciphertext: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  sequence: number;
  opaqueIdHash: string;
  action: 'create' | 'update' | 'rewrap';
  revision: number;
  at: string;
  previousHash: string;
  hash: string;
}

export interface EncryptedRepositoryPort {
  read(opaqueId: string): Promise<EncryptedRow | null>;
  compareAndSwap(opaqueId: string, expectedRevision: number | null, row: EncryptedRow): Promise<void>;
  appendAudit(expectedSequence: number, entry: AuditEntry): Promise<void>;
  audits(): Promise<readonly AuditEntry[]>;
}

const b64 = (value: Uint8Array) => Buffer.from(value).toString('base64url');
const unb64 = (value: string) => Buffer.from(value, 'base64url');
const OPAQUE_ID = /^tlr_[a-f0-9]{64}$/;
const FORBIDDEN = /(?:name|email|rut|patient|doctor|diagnos|medication|dose|gram|address|wallet|prescription|clinical)/i;

export function createOpaqueMappingId(namespaceKey: Uint8Array, externalSyntheticId: string): string {
  if (namespaceKey.byteLength < 32 || externalSyntheticId.length < 8) throw new Error('OPAQUE_MAPPING_INPUT_REJECTED');
  return `tlr_${createHmac('sha256', namespaceKey).update(externalSyntheticId).digest('hex')}`;
}

export function createInMemoryKeyCustody(initial: Record<string, Uint8Array>): KeyCustodyPort & { rotate(keyId: string, key: Uint8Array): void } {
  const keys = new Map<string, Uint8Array[]>();
  for (const [id, key] of Object.entries(initial)) {
    if (key.byteLength !== 32) throw new Error('INVALID_KEK');
    keys.set(id, [Buffer.from(key)]);
  }
  return {
    async activeVersion(id) { const versions = keys.get(id); if (!versions?.length) throw new Error('KMS_KEY_UNAVAILABLE'); return versions.length; },
    async wrap(id, plaintext) {
      const versions = keys.get(id); if (!versions?.length) throw new Error('KMS_KEY_UNAVAILABLE');
      const version = versions.length, iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', versions[version - 1], iv);
      cipher.setAAD(Buffer.from(`${id}:${version}`));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
      return { keyId: id, keyVersion: version, wrapped: `${b64(iv)}.${b64(ciphertext)}` };
    },
    async unwrap(wrapped) {
      const key = keys.get(wrapped.keyId)?.[wrapped.keyVersion - 1]; if (!key) throw new Error('KMS_KEY_VERSION_UNAVAILABLE');
      const [ivValue, bodyValue] = wrapped.wrapped.split('.');
      const body = unb64(bodyValue); const decipher = createDecipheriv('aes-256-gcm', key, unb64(ivValue));
      decipher.setAAD(Buffer.from(`${wrapped.keyId}:${wrapped.keyVersion}`)); decipher.setAuthTag(body.subarray(body.length - 16));
      return Buffer.concat([decipher.update(body.subarray(0, -16)), decipher.final()]);
    },
    rotate(id, key) { if (key.byteLength !== 32 || !keys.has(id)) throw new Error('KMS_ROTATION_REJECTED'); keys.get(id)!.push(Buffer.from(key)); },
  };
}

export function createInMemoryEncryptedRepository(): EncryptedRepositoryPort {
  const rows = new Map<string, EncryptedRow>(); const audit: AuditEntry[] = [];
  return {
    async read(id) { return rows.get(id) ?? null; },
    async compareAndSwap(id, expected, row) { const actual = rows.get(id)?.revision ?? null; if (actual !== expected) throw new Error('REVISION_CONFLICT'); rows.set(id, structuredClone(row)); },
    async appendAudit(expected, entry) { if (audit.length !== expected || entry.sequence !== expected + 1) throw new Error('AUDIT_SEQUENCE_CONFLICT'); audit.push(Object.freeze(structuredClone(entry))); },
    async audits() { return structuredClone(audit); },
  };
}

function validatePayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_OFFCHAIN_PAYLOAD');
  const inspect = (candidate: unknown, depth: number) => {
    if (depth > 8) throw new Error('PAYLOAD_DEPTH_REJECTED');
    if (Array.isArray(candidate)) { for (const item of candidate) inspect(item, depth + 1); return; }
    if (!candidate || typeof candidate !== 'object') return;
    for (const [key, item] of Object.entries(candidate)) {
      if (FORBIDDEN.test(key)) throw new Error('FORBIDDEN_DATA_FIELD');
      inspect(item, depth + 1);
    }
  };
  inspect(value, 0);
  if ((value as Record<string, unknown>).fixture !== true) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
}

export function createEncryptedDurableStore(repository: EncryptedRepositoryPort, custody: KeyCustodyPort, keyId: string, now = () => new Date()) {
  const aad = (id: string, revision: number) => Buffer.from(`trustleaf:v1:${id}:${revision}`);
  const auditHash = (entry: Omit<AuditEntry, 'hash'>) => createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  const appendAudit = async (id: string, action: AuditEntry['action'], revision: number) => {
    const entries = await repository.audits(); const previousHash = entries.at(-1)?.hash ?? 'GENESIS';
    const base = { sequence: entries.length + 1, opaqueIdHash: createHash('sha256').update(id).digest('hex'), action, revision, at: now().toISOString(), previousHash };
    await repository.appendAudit(entries.length, { ...base, hash: auditHash(base) });
  };
  const decrypt = async <T>(row: EncryptedRow): Promise<T> => {
    const dataKey = await custody.unwrap(row.key); const decipher = createDecipheriv('aes-256-gcm', dataKey, unb64(row.iv));
    decipher.setAAD(aad(row.opaqueId, row.revision)); decipher.setAuthTag(unb64(row.tag));
    return JSON.parse(Buffer.concat([decipher.update(unb64(row.ciphertext)), decipher.final()]).toString('utf8')) as T;
  };
  return {
    async put(id: string, expectedRevision: number | null, payload: unknown) {
      if (!OPAQUE_ID.test(id)) throw new Error('OPAQUE_RECEIPT_ID_REQUIRED'); validatePayload(payload);
      const revision = (expectedRevision ?? 0) + 1, dataKey = randomBytes(32), iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', dataKey, iv); cipher.setAAD(aad(id, revision));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]); const timestamp = now().toISOString();
      const previous = await repository.read(id);
      const row: EncryptedRow = { opaqueId: id, revision, schema: 'trustleaf.offchain-envelope.v1', key: await custody.wrap(keyId, dataKey), iv: b64(iv), ciphertext: b64(ciphertext), tag: b64(cipher.getAuthTag()), createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp };
      await repository.compareAndSwap(id, expectedRevision, row); await appendAudit(id, previous ? 'update' : 'create', revision); return revision;
    },
    async get<T>(id: string): Promise<T | null> { const row = await repository.read(id); return row ? decrypt<T>(row) : null; },
    async rewrap(id: string) {
      const row = await repository.read(id); if (!row) throw new Error('ROW_NOT_FOUND');
      const active = await custody.activeVersion(keyId); if (row.key.keyVersion === active) return false;
      const dataKey = await custody.unwrap(row.key); const updated = { ...row, key: await custody.wrap(keyId, dataKey), updatedAt: now().toISOString() };
      await repository.compareAndSwap(id, row.revision, updated); await appendAudit(id, 'rewrap', row.revision); return true;
    },
    async verifyAuditChain() { const entries = await repository.audits(); let previous = 'GENESIS'; for (const entry of entries) { const { hash, ...base } = entry; const calculated = auditHash(base); if (previous !== entry.previousHash || !timingSafeEqual(Buffer.from(hash), Buffer.from(calculated))) return false; previous = hash; } return true; },
  };
}
