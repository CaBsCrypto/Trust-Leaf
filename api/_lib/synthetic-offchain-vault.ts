import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type SyntheticLifecycleState = 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired';

export interface SyntheticOffchainRecord {
  fixture: true;
  state: SyntheticLifecycleState;
  version: number;
  syntheticUnitsRemaining: number;
}

export interface OpaqueEncryptedEnvelope {
  schema: 'trustleaf.synthetic.v1';
  keyAlias: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface SyntheticKeyProvider {
  keyAlias(): string;
  keyBytes(): Uint8Array;
}

export interface SyntheticOffchainVault {
  put(opaqueReceiptId: string, expectedVersion: number | null, record: SyntheticOffchainRecord): void;
  get(opaqueReceiptId: string): SyntheticOffchainRecord | null;
  envelope(opaqueReceiptId: string): OpaqueEncryptedEnvelope | null;
  issueQr(opaqueReceiptId: string, audience: 'patient' | 'dispensary', nowMs: number, ttlMs: number): string;
  consumeQr(token: string, audience: 'patient' | 'dispensary', nowMs: number): string | null;
}

const OPAQUE_ID = /^tlr_[a-f0-9]{64}$/;
const FORBIDDEN_KEYS = /(?:name|email|rut|patient|doctor|diagnos|medication|dose|gram|address|wallet|prescription|clinical)/i;
const b64url = (value: Uint8Array) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url');

function validate(id: string, record: SyntheticOffchainRecord) {
  if (!OPAQUE_ID.test(id)) throw new Error('OPAQUE_RECEIPT_ID_REQUIRED');
  if (record.fixture !== true || !Number.isInteger(record.version) || record.version < 1 ||
      !Number.isInteger(record.syntheticUnitsRemaining) || record.syntheticUnitsRemaining < 0) throw new Error('INVALID_SYNTHETIC_RECORD');
  if (Object.keys(record).some(key => FORBIDDEN_KEYS.test(key))) throw new Error('FORBIDDEN_DATA_FIELD');
}

export function opaqueReceiptId(seed = randomBytes(32)): string {
  return `tlr_${createHash('sha256').update(seed).digest('hex')}`;
}

export function createLocalSyntheticKeyProvider(key = randomBytes(32), alias = 'trustleaf-testnet-local-epoch-1'): SyntheticKeyProvider {
  if (key.length !== 32 || !alias.startsWith('trustleaf-')) throw new Error('INVALID_SYNTHETIC_KEY_PROVIDER');
  return { keyAlias: () => alias, keyBytes: () => key };
}

export function createInMemorySyntheticOffchainVault(keys: SyntheticKeyProvider): SyntheticOffchainVault {
  const records = new Map<string, OpaqueEncryptedEnvelope>();
  const qr = new Map<string, { id: string; audience: string; expiresAt: number; used: boolean }>();
  const encrypt = (id: string, record: SyntheticOffchainRecord): OpaqueEncryptedEnvelope => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keys.keyBytes(), iv);
    cipher.setAAD(Buffer.from(id));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
    return { schema: 'trustleaf.synthetic.v1', keyAlias: keys.keyAlias(), iv: b64url(iv), ciphertext: b64url(ciphertext), tag: b64url(cipher.getAuthTag()) };
  };
  const decrypt = (id: string, value: OpaqueEncryptedEnvelope): SyntheticOffchainRecord => {
    const decipher = createDecipheriv('aes-256-gcm', keys.keyBytes(), decode(value.iv));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(decode(value.tag));
    return JSON.parse(Buffer.concat([decipher.update(decode(value.ciphertext)), decipher.final()]).toString('utf8'));
  };
  return {
    put(id, expectedVersion, record) {
      validate(id, record);
      const current = records.get(id);
      const actual = current ? decrypt(id, current).version : null;
      if (actual !== expectedVersion) throw new Error('VERSION_CONFLICT');
      records.set(id, encrypt(id, record));
    },
    get(id) { const value = records.get(id); return value ? decrypt(id, value) : null; },
    envelope(id) { return records.get(id) ?? null; },
    issueQr(id, audience, nowMs, ttlMs) {
      if (!records.has(id) || ttlMs < 1 || ttlMs > 300_000) throw new Error('QR_ISSUE_REJECTED');
      const token = `tlq_${b64url(randomBytes(24))}`;
      qr.set(createHash('sha256').update(token).digest('hex'), { id, audience, expiresAt: nowMs + ttlMs, used: false });
      return token;
    },
    consumeQr(token, audience, nowMs) {
      const entry = qr.get(createHash('sha256').update(token).digest('hex'));
      if (!entry || entry.used || entry.audience !== audience || nowMs > entry.expiresAt) return null;
      entry.used = true;
      return entry.id;
    },
  };
}
