import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthorizedPrincipal, ServerRole } from './server-authorization.ts';

export interface ActorBinding {
  subject: string;
  actorId: string;
  roles: readonly ServerRole[];
  stellarAccountId: string;
  passkeyKeyId?: string;
}

export interface ReceiptBinding {
  receiptId: string;
  receiptHandle: string;
  doctorActorId: string;
  patientActorId: string;
  dispensaryActorIds: readonly string[];
}

export interface ReplayReservation {
  operationId: string;
  fingerprint: string;
  actorId: string;
  receiptHandle?: string;
  action: string;
  createdAt: string;
}

export interface LegacyObjectAuthorizationPort {
  actorBySubject(subject: string): Promise<ActorBinding | null>;
  actorById(actorId: string): Promise<ActorBinding | null>;
  receiptByReference(reference: string): Promise<ReceiptBinding | null>;
  reserveOperation(reservation: ReplayReservation): Promise<void>;
}

export interface LegacyObjectAuthorizationContext {
  actor: ActorBinding;
  targetActor?: ActorBinding;
  receipt?: ReceiptBinding;
  operationId?: string;
  trusted: {
    actorAccountId: string;
    targetAccountId?: string;
  };
}

type ObjectRequest = {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};

const ACTOR_ID = /^tla_[a-z0-9_-]{8,80}$/;
const RECEIPT_HANDLE = /^tlr_[a-z0-9_-]{8,100}$/;
const OPERATION_ID = /^tlo_[a-zA-Z0-9_-]{16,120}$/;
const STELLAR_ACCOUNT = /^G[A-Z2-7]{55}$/;
const FORBIDDEN_CLIENT_FIELDS = new Set([
  'email', 'doctorEmail', 'dispensaryEmail', 'patientEmail',
  'rut', 'run',
  'address', 'doctorAddress', 'dispensaryAddress', 'patientAddress', 'callerAddress',
  'xdr', 'signedXdr', 'unsignedXdr', 'subject', 'roles',
]);
const MUTATING_RECEIPT_PATH = /^\/api\/stellar\/(?:doctor\/(?:issue-prescription|build-issue-prescription)|dispensary\/(?:dispense-prescription|build-dispense-prescription|retain-prescription|build-retain-prescription|release-prescription|build-release-prescription))$/;
const CLIENT_ENVELOPE_PATH = /^\/api\/(?:stellar\/submit|passkeys\/send|defindex\/submit)$/;

export function createInMemoryLegacyObjectAuthorizationPort(input: {
  actors: readonly ActorBinding[];
  receipts: readonly ReceiptBinding[];
}): LegacyObjectAuthorizationPort {
  validateBindings(input);
  const actorsBySubject = new Map(input.actors.map(actor => [actor.subject, freeze(actor)]));
  const actorsById = new Map(input.actors.map(actor => [actor.actorId, freeze(actor)]));
  const receipts = new Map<string, ReceiptBinding>();
  for (const receipt of input.receipts) {
    const frozen = freeze(receipt);
    receipts.set(receipt.receiptId, frozen);
    receipts.set(receipt.receiptHandle, frozen);
  }
  const operations = new Map<string, ReplayReservation>();
  return {
    async actorBySubject(subject) { return actorsBySubject.get(subject) ?? null; },
    async actorById(actorId) { return actorsById.get(actorId) ?? null; },
    async receiptByReference(reference) { return receipts.get(reference) ?? null; },
    async reserveOperation(reservation) {
      const previous = operations.get(reservation.operationId);
      if (previous) {
        const same = safeEqual(previous.fingerprint, reservation.fingerprint)
          && previous.actorId === reservation.actorId
          && previous.receiptHandle === reservation.receiptHandle
          && previous.action === reservation.action;
        throw objectError(same ? 'REPLAY_REJECTED' : 'IDEMPOTENCY_KEY_CONFLICT', 409);
      }
      operations.set(reservation.operationId, freeze(reservation));
    },
  };
}

export function objectAuthorizationPortFromEnv(env: Record<string, string | undefined>): LegacyObjectAuthorizationPort {
  const raw = env.TRUSTLEAF_OBJECT_AUTH_FIXTURES_JSON;
  if (!raw?.trim()) throw objectError('OBJECT_AUTH_CONFIGURATION_MISSING', 503);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503);
  const input = parsed as { mode?: unknown; actors?: unknown; receipts?: unknown };
  if (input.mode !== 'synthetic-fixture' || !Array.isArray(input.actors) || !Array.isArray(input.receipts)) {
    throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503);
  }
  return createInMemoryLegacyObjectAuthorizationPort({
    actors: input.actors as ActorBinding[],
    receipts: input.receipts as ReceiptBinding[],
  });
}

export function createLegacyObjectAuthorizer(port: LegacyObjectAuthorizationPort, now = () => new Date()) {
  return async (principal: AuthorizedPrincipal, request: ObjectRequest): Promise<LegacyObjectAuthorizationContext> => {
    const body = request.body ?? {};
    rejectClientIdentity(body);
    if (CLIENT_ENVELOPE_PATH.test(request.path)) throw objectError('CLIENT_TRANSACTION_ENVELOPE_REJECTED', 400);

    const actor = await port.actorBySubject(principal.subject);
    if (!actor) throw objectError('ACTOR_BINDING_REQUIRED', 403);
    if (!principal.roles.some(role => actor.roles.includes(role))) throw objectError('ACTOR_ROLE_MISMATCH', 403);

    const context: LegacyObjectAuthorizationContext = {
      actor,
      trusted: { actorAccountId: actor.stellarAccountId },
    };

    if (/^\/api\/stellar\/(?:doctor\/(?:issue-prescription|build-issue-prescription)|admin\/(?:register|revoke)-(?:doctor|dispensary))$/.test(request.path)) {
      const target = await requiredTargetActor(port, body.targetActorId);
      const expectedRole: ServerRole = request.path.includes('/doctor/')
        ? 'patient'
        : request.path.endsWith('-dispensary') ? 'dispensary' : 'doctor';
      if (!target.roles.includes(expectedRole)) throw objectError('TARGET_ACTOR_ROLE_MISMATCH', 403);
      context.targetActor = target;
      context.trusted.targetAccountId = target.stellarAccountId;
    }

    if (/^\/api\/stellar\/patient\/[^/]+\/dashboard$/.test(request.path)) {
      const requestedAccount = decodeURIComponent(request.path.split('/')[4] ?? '');
      if (!safeEqual(requestedAccount, actor.stellarAccountId)) throw objectError('OBJECT_ACCESS_FORBIDDEN', 403);
    }

    if (/^\/api\/stellar\/verify-passport\/[^/]+$/.test(request.path)) {
      const requestedAccount = decodeURIComponent(request.path.split('/').at(-1) ?? '');
      if (!safeEqual(requestedAccount, actor.stellarAccountId)) throw objectError('OBJECT_ACCESS_FORBIDDEN', 403);
    }

    const receiptReference = receiptReferenceFor(request.path, body);
    if (receiptReference) {
      const receipt = await port.receiptByReference(receiptReference);
      if (!receipt) throw objectError('RECEIPT_BINDING_REQUIRED', 404);
      assertReceiptAccess(actor, receipt, request.path);
      context.receipt = receipt;
    }

    if (/^\/api\/passkeys\/contract\/[^/]+$/.test(request.path)) {
      const requestedKeyId = decodeURIComponent(request.path.split('/').at(-1) ?? '');
      if (!actor.passkeyKeyId || !safeEqual(requestedKeyId, actor.passkeyKeyId)) throw objectError('OBJECT_ACCESS_FORBIDDEN', 403);
    }

    if (/^\/api\/defindex\/balance\/[^/]+\/[^/]+$/.test(request.path)) {
      const requestedAccount = decodeURIComponent(request.path.split('/').at(-1) ?? '');
      if (!safeEqual(requestedAccount, actor.stellarAccountId)) throw objectError('OBJECT_ACCESS_FORBIDDEN', 403);
    }

    if (request.method.toUpperCase() === 'POST' && MUTATING_RECEIPT_PATH.test(request.path)) {
      const operationId = singleHeader(request.headers['idempotency-key']);
      if (!operationId || !OPERATION_ID.test(operationId)) throw objectError('IDEMPOTENCY_KEY_REQUIRED', 400);
      const fingerprint = fingerprintRequest(request, actor.actorId, context.receipt?.receiptHandle, context.targetActor?.actorId);
      await port.reserveOperation({
        operationId,
        fingerprint,
        actorId: actor.actorId,
        receiptHandle: context.receipt?.receiptHandle,
        action: request.path,
        createdAt: now().toISOString(),
      });
      context.operationId = operationId;
    }

    return context;
  };
}

export function createLegacyObjectAuthorizationMiddleware(
  env: Record<string, string | undefined>,
  dependencies: { port?: LegacyObjectAuthorizationPort; now?: () => Date } = {},
) {
  let authorize: ReturnType<typeof createLegacyObjectAuthorizer> | null = null;
  let setupError: { code?: string; statusCode?: number } | null = null;
  try {
    authorize = createLegacyObjectAuthorizer(dependencies.port ?? objectAuthorizationPortFromEnv(env), dependencies.now);
  } catch (error) {
    setupError = error as { code?: string; statusCode?: number };
  }
  return async (
    req: ObjectRequest,
    res: { locals: Record<string, unknown>; status(code: number): { json(body: unknown): unknown } },
    next: () => unknown,
  ) => {
    const principal = res.locals.authPrincipal as AuthorizedPrincipal | undefined;
    if (!principal) return next();
    if (!authorize) return res.status(setupError?.statusCode ?? 503).json({ code: setupError?.code ?? 'OBJECT_AUTH_UNAVAILABLE' });
    try {
      res.locals.objectAuthorization = await authorize(principal, req);
      return next();
    } catch (error) {
      const candidate = error as { code?: string; statusCode?: number };
      return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'OBJECT_AUTH_UNAVAILABLE' });
    }
  };
}

function receiptReferenceFor(path: string, body: Record<string, unknown>) {
  if (/^\/api\/stellar\/dispensary\/(?:validate-prescription|dispense-prescription|build-dispense-prescription|retain-prescription|build-retain-prescription|release-prescription|build-release-prescription)$/.test(path)) {
    return scalarReference(body.receiptHandle ?? body.prescriptionId);
  }
  const verify = path.match(/^\/api\/stellar\/prescription\/([^/]+)\/verify$/);
  return verify ? decodeURIComponent(verify[1]) : null;
}

function assertReceiptAccess(actor: ActorBinding, receipt: ReceiptBinding, path: string) {
  if (actor.roles.includes('admin')) return;
  const isDoctor = actor.roles.includes('doctor') && receipt.doctorActorId === actor.actorId;
  const isPatient = actor.roles.includes('patient') && receipt.patientActorId === actor.actorId;
  const isDispensary = actor.roles.includes('dispensary') && receipt.dispensaryActorIds.includes(actor.actorId);
  const dispensaryOperation = path.includes('/dispensary/');
  if ((dispensaryOperation && !isDispensary) || (!dispensaryOperation && !isDoctor && !isPatient && !isDispensary)) {
    throw objectError('OBJECT_ACCESS_FORBIDDEN', 403);
  }
}

async function requiredTargetActor(port: LegacyObjectAuthorizationPort, candidate: unknown) {
  if (typeof candidate !== 'string' || !ACTOR_ID.test(candidate)) throw objectError('TARGET_ACTOR_REQUIRED', 400);
  const actor = await port.actorById(candidate);
  if (!actor) throw objectError('TARGET_ACTOR_NOT_FOUND', 404);
  return actor;
}

function validateBindings(input: { actors: readonly ActorBinding[]; receipts: readonly ReceiptBinding[] }) {
  if (!input.actors.length) throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503);
  const subjects = new Set<string>(); const ids = new Set<string>(); const accounts = new Set<string>();
  for (const actor of input.actors) {
    if (!actor.subject?.trim() || /@/.test(actor.subject) || !ACTOR_ID.test(actor.actorId) || !actor.roles?.length || !STELLAR_ACCOUNT.test(actor.stellarAccountId)) {
      throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503);
    }
    if (subjects.has(actor.subject) || ids.has(actor.actorId) || accounts.has(actor.stellarAccountId)) throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503);
    subjects.add(actor.subject); ids.add(actor.actorId); accounts.add(actor.stellarAccountId);
  }
  for (const receipt of input.receipts) {
    if (!receipt.receiptId?.trim() || !RECEIPT_HANDLE.test(receipt.receiptHandle) || !ids.has(receipt.doctorActorId) || !ids.has(receipt.patientActorId)
      || receipt.dispensaryActorIds.some(id => !ids.has(id))) throw objectError('OBJECT_AUTH_CONFIGURATION_INVALID', 503);
  }
}

function rejectClientIdentity(body: Record<string, unknown>) {
  const inspect = (value: unknown, depth: number) => {
    if (depth > 8) throw objectError('CLIENT_PAYLOAD_DEPTH_REJECTED', 400);
    if (Array.isArray(value)) { for (const item of value) inspect(item, depth + 1); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_CLIENT_FIELDS.has(key)) throw objectError('CLIENT_IDENTITY_FIELD_REJECTED', 400);
      inspect(item, depth + 1);
    }
  };
  inspect(body, 0);
}

function fingerprintRequest(request: ObjectRequest, actorId: string, receiptHandle?: string, targetActorId?: string) {
  const normalizedBody = Object.fromEntries(Object.entries(request.body ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify({ method: request.method.toUpperCase(), path: request.path, actorId, receiptHandle, targetActorId, body: normalizedBody })).digest('hex');
}

function scalarReference(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function singleHeader(value: string | string[] | undefined) { return typeof value === 'string' ? value.trim() : ''; }
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function freeze<T>(value: T): T { return Object.freeze(structuredClone(value)); }
function objectError(code: string, statusCode: number) { return Object.assign(new Error('Object authorization denied.'), { code, statusCode }); }
