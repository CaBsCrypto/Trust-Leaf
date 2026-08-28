import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createEncryptedDurableStore,
  createInMemoryEncryptedRepository,
  createInMemoryKeyCustody,
  createOpaqueMappingId,
  type DurableStoreConfig,
} from './durable-encrypted-store.ts';
import type { AuthorizedPrincipal, ServerRole } from './server-authorization.ts';

type MappingRole = Extract<ServerRole, 'doctor' | 'patient' | 'dispensary' | 'admin'>;
type ReceiptAction = 'read' | 'operate' | 'admin';

interface SubjectActorRecord {
  fixture: true;
  schema: 'trustleaf.subject-actor.v1';
  subjectRef: string;
  actorRef: string;
  role: MappingRole;
  status: 'active';
}

interface ActorSubjectRecord extends SubjectActorRecord {}

interface ReceiptBindingRecord {
  fixture: true;
  schema: 'trustleaf.receipt-access.v1';
  receiptRef: string;
  ownerSubjectRef: string;
  issuerActorRef: string;
  operatorActorRefs: string[];
  publicLookupRef: string;
}

interface PublicLookupRecord {
  fixture: true;
  schema: 'trustleaf.public-lookup.v1';
  receiptRef: string;
}

interface OperationRecord<T> {
  fixture: true;
  schema: 'trustleaf.idempotency.v1';
  intentDigest: string;
  outcome: T;
}

export interface ReceiptBindingOutcome {
  receiptRef: string;
  publicHandle: string;
  replayed: boolean;
}

export interface ReceiptAccessDecision {
  receiptRef: string;
  role: MappingRole;
  action: ReceiptAction;
}

export interface DurableReceiptMappingPort {
  bindSubjectActor(principal: AuthorizedPrincipal, input: {
    role: MappingRole;
    trustedSyntheticActorId: string;
    idempotencyKey: string;
  }): Promise<{ subjectRef: string; actorRef: string; replayed: boolean }>;
  createReceiptBinding(principal: AuthorizedPrincipal, input: {
    trustedSyntheticReceiptId: string;
    ownerSubject: string;
    operatorSubjects?: readonly string[];
    idempotencyKey: string;
  }): Promise<ReceiptBindingOutcome>;
  authorizeReceipt(principal: AuthorizedPrincipal, trustedSyntheticReceiptId: string, action: ReceiptAction): Promise<ReceiptAccessDecision>;
  resolvePublicHandle(publicHandle: string): Promise<{ receiptRef: string } | null>;
}

export interface MemoryFixtureMappingDependencies {
  namespaceKey: Uint8Array;
  idempotencyKey: Uint8Array;
  fixtureKek: Uint8Array;
  random?: (size: number) => Uint8Array;
  now?: () => Date;
}

const ACTOR_ID = /^fixture-actor-[a-z0-9-]{8,80}$/;
const RECEIPT_ID = /^fixture-receipt-[a-z0-9-]{8,80}$/;
const IDEMPOTENCY_ID = /^fixture-op-[a-z0-9-]{12,100}$/;
const PUBLIC_HANDLE = /^tlq_[A-Za-z0-9_-]{43}$/;
const SAFE_SUBJECT = /^[A-Za-z0-9:_-]{8,160}$/;

/**
 * The only executable adapter is deliberately local and synthetic. The future
 * Postgres/KMS implementation must provide a transaction spanning the mapping,
 * reverse mapping, QR lookup and idempotency journal before it can be enabled.
 */
export function createDurableReceiptMappingPort(
  config: DurableStoreConfig,
  dependencies: MemoryFixtureMappingDependencies,
): DurableReceiptMappingPort {
  if (config.mode !== 'memory-fixture') throw mappingError('DURABLE_MAPPING_ADAPTER_UNAVAILABLE', 503);
  validateKey(dependencies.namespaceKey, 'MAPPING_NAMESPACE_KEY_INVALID');
  validateKey(dependencies.idempotencyKey, 'MAPPING_IDEMPOTENCY_KEY_INVALID');
  validateKey(dependencies.fixtureKek, 'MAPPING_FIXTURE_KEK_INVALID');

  const repository = createInMemoryEncryptedRepository();
  const custody = createInMemoryKeyCustody({ 'fixture-mapping-kek': dependencies.fixtureKek });
  const store = createEncryptedDurableStore(repository, custody, 'fixture-mapping-kek', dependencies.now);
  const random = dependencies.random ?? randomBytes;
  let serial = Promise.resolve();

  const locked = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = serial;
    let release!: () => void;
    serial = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  };

  const ref = (kind: string, raw: string) => createOpaqueMappingId(dependencies.namespaceKey, `${kind}:${raw}`);
  const subjectRef = (subject: string) => ref('subject', validateSubject(subject));
  const actorKey = (actorId: string) => ref('actor', validateActorId(actorId));
  const receiptKey = (receiptId: string) => ref('receipt', validateReceiptId(receiptId));
  const publicKey = (handle: string) => ref('public', validatePublicHandle(handle));
  const operationKey = (key: string) => ref('operation', validateOperationId(key));
  const digest = (intent: unknown) => createHmac('sha256', dependencies.idempotencyKey).update(stableJson(intent)).digest('hex');

  const replay = async <T>(key: string, intent: unknown): Promise<T | null> => {
    const existing = await store.get<OperationRecord<T>>(operationKey(key));
    if (!existing) return null;
    const expected = Buffer.from(digest(intent), 'hex');
    const actual = Buffer.from(existing.intentDigest, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw mappingError('IDEMPOTENCY_REPLAY_MISMATCH', 409);
    return existing.outcome;
  };

  const remember = async <T>(key: string, intent: unknown, outcome: T) => {
    await store.put(operationKey(key), null, {
      fixture: true,
      schema: 'trustleaf.idempotency.v1',
      intentDigest: digest(intent),
      outcome,
    } satisfies OperationRecord<T>);
  };

  const loadActor = async (subject: string): Promise<SubjectActorRecord | null> => store.get(subjectRef(subject));

  return {
    async bindSubjectActor(principal, input) {
      return locked(async () => {
        requirePrincipalRole(principal, input.role, scopeForRole(input.role));
        const subject = subjectRef(principal.subject);
        const actor = actorKey(input.trustedSyntheticActorId);
        const intent = { kind: 'bind-actor', subject, actor, role: input.role };
        const prior = await replay<Omit<Awaited<ReturnType<DurableReceiptMappingPort['bindSubjectActor']>>, 'replayed'>>(input.idempotencyKey, intent);
        if (prior) return { ...prior, replayed: true };

        const currentSubject = await store.get<SubjectActorRecord>(subject);
        const currentActor = await store.get<ActorSubjectRecord>(actor);
        if (currentSubject || currentActor) {
          if (currentSubject?.actorRef !== actor || currentSubject.role !== input.role || currentActor?.subjectRef !== subject) {
            throw mappingError('SUBJECT_ACTOR_BINDING_CONFLICT', 409);
          }
        } else {
          const record: SubjectActorRecord = { fixture: true, schema: 'trustleaf.subject-actor.v1', subjectRef: subject, actorRef: actor, role: input.role, status: 'active' };
          await store.put(subject, null, record);
          await store.put(actor, null, record);
        }
        const outcome = { subjectRef: subject, actorRef: actor };
        await remember(input.idempotencyKey, intent, outcome);
        return { ...outcome, replayed: false };
      });
    },

    async createReceiptBinding(principal, input) {
      return locked(async () => {
        requirePrincipalRole(principal, 'doctor', 'receipt:issue');
        const issuer = await loadActor(principal.subject);
        if (!issuer || issuer.role !== 'doctor') throw mappingError('ACTOR_BINDING_REQUIRED', 403);
        const owner = await loadActor(input.ownerSubject);
        if (!owner || owner.role !== 'patient') throw mappingError('OWNER_BINDING_REQUIRED', 403);
        const operators: string[] = [];
        for (const operatorSubject of unique(input.operatorSubjects ?? [])) {
          const operator = await loadActor(operatorSubject);
          if (!operator || operator.role !== 'dispensary') throw mappingError('OPERATOR_BINDING_REQUIRED', 403);
          operators.push(operator.actorRef);
        }
        operators.sort();
        const receipt = receiptKey(input.trustedSyntheticReceiptId);
        const intent = { kind: 'create-receipt', receipt, owner: owner.subjectRef, issuer: issuer.actorRef, operators };
        const prior = await replay<Omit<ReceiptBindingOutcome, 'replayed'>>(input.idempotencyKey, intent);
        if (prior) return { ...prior, replayed: true };
        if (await store.get(receipt)) throw mappingError('RECEIPT_ALREADY_BOUND', 409);

        const handle = `tlq_${Buffer.from(random(32)).toString('base64url')}`;
        validatePublicHandle(handle);
        const lookup = publicKey(handle);
        const record: ReceiptBindingRecord = {
          fixture: true,
          schema: 'trustleaf.receipt-access.v1',
          receiptRef: receipt,
          ownerSubjectRef: owner.subjectRef,
          issuerActorRef: issuer.actorRef,
          operatorActorRefs: operators,
          publicLookupRef: lookup,
        };
        await store.put(receipt, null, record);
        await store.put(lookup, null, { fixture: true, schema: 'trustleaf.public-lookup.v1', receiptRef: receipt } satisfies PublicLookupRecord);
        const outcome = { receiptRef: receipt, publicHandle: handle };
        await remember(input.idempotencyKey, intent, outcome);
        return { ...outcome, replayed: false };
      });
    },

    async authorizeReceipt(principal, trustedSyntheticReceiptId, action) {
      const record = await store.get<ReceiptBindingRecord>(receiptKey(trustedSyntheticReceiptId));
      if (!record) throw mappingError('RECEIPT_NOT_FOUND', 404);
      const actor = await loadActor(principal.subject);
      if (!actor || !principal.roles.includes(actor.role)) throw mappingError('RECEIPT_ACCESS_FORBIDDEN', 403);
      if (!principal.scopes.includes(action === 'operate' ? 'receipt:dispense' : 'receipt:read')) throw mappingError('RECEIPT_ACCESS_FORBIDDEN', 403);
      const allowed = actor.role === 'admin'
        ? action !== 'operate'
        : actor.role === 'patient'
          ? action === 'read' && actor.subjectRef === record.ownerSubjectRef
          : actor.role === 'doctor'
            ? action === 'read' && actor.actorRef === record.issuerActorRef
            : actor.role === 'dispensary'
              ? action !== 'admin' && record.operatorActorRefs.includes(actor.actorRef)
              : false;
      if (!allowed) throw mappingError('RECEIPT_ACCESS_FORBIDDEN', 403);
      return { receiptRef: record.receiptRef, role: actor.role, action };
    },

    async resolvePublicHandle(publicHandle) {
      const record = await store.get<PublicLookupRecord>(publicKey(publicHandle));
      return record ? { receiptRef: record.receiptRef } : null;
    },
  };
}

function requirePrincipalRole(principal: AuthorizedPrincipal, role: MappingRole, scope: string) {
  if (!principal.subject || !principal.roles.includes(role) || !principal.scopes.includes(scope)) throw mappingError('PRINCIPAL_BINDING_FORBIDDEN', 403);
}

function scopeForRole(role: MappingRole) {
  if (role === 'doctor') return 'receipt:issue';
  if (role === 'dispensary') return 'receipt:dispense';
  if (role === 'admin') return 'actor:manage';
  return 'receipt:read';
}

function validateKey(value: Uint8Array, code: string) { if (value.byteLength < 32) throw mappingError(code, 503); }
function validateSubject(value: string) { if (!SAFE_SUBJECT.test(value)) throw mappingError('VERIFIED_SUBJECT_REQUIRED', 403); return value; }
function validateActorId(value: string) { if (!ACTOR_ID.test(value)) throw mappingError('TRUSTED_SYNTHETIC_ACTOR_ID_REQUIRED', 400); return value; }
function validateReceiptId(value: string) { if (!RECEIPT_ID.test(value)) throw mappingError('TRUSTED_SYNTHETIC_RECEIPT_ID_REQUIRED', 400); return value; }
function validateOperationId(value: string) { if (!IDEMPOTENCY_ID.test(value)) throw mappingError('IDEMPOTENCY_KEY_REQUIRED', 400); return value; }
function validatePublicHandle(value: string) { if (!PUBLIC_HANDLE.test(value)) throw mappingError('PUBLIC_HANDLE_INVALID', 404); return value; }
function unique<T>(values: readonly T[]) { return [...new Set(values)]; }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function mappingError(code: string, statusCode: number) {
  return Object.assign(new Error('Durable mapping operation rejected.'), { code, statusCode });
}
