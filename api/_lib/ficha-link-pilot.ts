import { createHmac, randomUUID } from 'node:crypto';
import { getVercelOidcToken } from '@vercel/oidc';
import { createSyntheticPrescription, matchesPdfCommitment } from './ficha-link-proof.js';
import type { PrivyIdentity } from './privy-identity.ts';
import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from './privy-supabase-rbac.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hex = /^[a-f0-9]{64}$/;

type Env = Record<string, string | undefined>;
type Verifier = { verify(token: string): Promise<PrivyIdentity> };
type Binding = { bindingId: string };
type BindingStatus = 'pending' | 'claimed' | 'active' | 'revoked' | 'expired';
type ClinicalEvent = {
  schemaVersion: 1; eventId: string; eventType: 'clinical-link.issued' | 'clinical-link.revoked';
  partnerPatientRef: string; resourceRef: string; category: 'cannabis.prescription';
  clinicalStatus: 'active' | 'revoked'; revision: number; documentRevision: number; occurredAt: string;
  commitment?: string;
};
type Prescription = {
  resourceRef: string; linkRef: string | null; pdfBase64?: string; nonce?: string; commitment: string;
  issueEvent: ClinicalEvent; revokeEvent: ClinicalEvent | null; revokeDelivered: boolean;
};

class PilotError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export function fichaPilotConfig(env: Env) {
  if (env.TRUSTLEAF_FICHA_LINK_PILOT_ENABLED !== 'true' || env.TRUSTLEAF_FICHA_LINK_MODE !== 'synthetic'
    || env.STELLAR_NETWORK !== 'testnet' || env.VERCEL_ENV === 'production'
    || (env.VERCEL_ENV !== 'preview' && env.NODE_ENV === 'production')) throw new PilotError(404, 'PILOT_DISABLED');

  const ficha = parseOrigin(env.TRUSTLEAF_FICHA_LINK_ORIGIN);
  const project = parseOrigin(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL);
  const projectRef = env.TRUSTLEAF_FICHA_LINK_SUPABASE_REF;
  const secret = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = env.TRUSTLEAF_FICHA_LINK_SERVICE_TOKEN;
  const hmacKey = env.TRUSTLEAF_FICHA_LINK_ACTOR_KEY;
  const doctor = env.TRUSTLEAF_FICHA_LINK_DOCTOR;
  const patient = env.TRUSTLEAF_FICHA_LINK_PATIENT;
  const control = env.TRUSTLEAF_FICHA_LINK_CONTROL_PATIENT;
  const appId = env.PRIVY_APP_ID;
  if (!ficha || !project || !projectRef || !/^[a-z0-9]{20}$/.test(projectRef)
    || project.origin !== `https://${projectRef}.supabase.co` || !secret || !apiKey || !/^tl_clp_[a-f0-9]{64}$/.test(apiKey)
    || !hmacKey || !hex.test(hmacKey)
    || !doctor || !patient || !control || ![doctor, patient, control].every(id => uuid.test(id))
    || new Set([doctor, patient, control]).size !== 3 || !appId) throw new PilotError(503, 'PILOT_CONFIGURATION');
  if (['trustleaf.org', 'www.trustleaf.org', 'cannabis.trustleaf.org'].includes(ficha.hostname)
    || (ficha.protocol !== 'https:' && !(env.VERCEL_ENV !== 'preview' && ['127.0.0.1', 'localhost'].includes(ficha.hostname)
      && ficha.protocol === 'http:'))) throw new PilotError(503, 'PILOT_CONFIGURATION');
  const useTrustedSource = env.TRUSTLEAF_FICHA_LINK_VERCEL_TRUSTED_SOURCE === 'true' && env.VERCEL === '1' && env.VERCEL_ENV === 'preview';
  if (useTrustedSource && (ficha.protocol !== 'https:' || ficha.port || !/^[a-z0-9-]+\.vercel\.app$/.test(ficha.hostname))) {
    throw new PilotError(503, 'PILOT_CONFIGURATION');
  }
  return { ficha, project, secret, apiKey, hmacKey, doctor, patient, control, appId, useTrustedSource };
}

function parseOrigin(value?: string) {
  try {
    const parsed = new URL(value ?? '');
    return (value === parsed.origin || value === `${parsed.origin}/`) ? parsed : null;
  } catch { return null; }
}

function assertUuid(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new PilotError(400, 'PILOT_INPUT_INVALID');
  return value;
}

function actorReference(config: ReturnType<typeof fichaPilotConfig>, actor: string) {
  return createHmac('sha256', Buffer.from(config.hmacKey, 'hex'))
    .update(`TrustLeaf/Cannabis/FichaActor/v1\0${config.appId}\0${actor}`, 'utf8').digest('hex');
}

function fichaPort(config: ReturnType<typeof fichaPilotConfig>, fetcher: typeof fetch, readOidcToken: () => Promise<string>) {
  return async <T>(path: string, body?: object): Promise<T> => {
    const headers = new Headers({ authorization: `Bearer ${config.apiKey}` });
    if (body) headers.set('content-type', 'application/json');
    if (config.useTrustedSource) {
      const token = await readOidcToken().catch(() => null);
      if (!token) throw new PilotError(503, 'FICHA_TRUSTED_SOURCE_UNAVAILABLE');
      headers.set('x-vercel-trusted-oidc-idp-token', token);
    }
    const response = await fetcher(new URL(`/api/v1/${path}`, config.ficha), {
      method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(6_000),
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => { throw new PilotError(503, 'FICHA_UNAVAILABLE'); });
    if (!response.ok) throw new PilotError(response.status === 404 || response.status === 410 ? 404 :
      response.status === 409 ? 409 : 503, 'FICHA_REQUEST_FAILED');
    return response.json().catch(() => { throw new PilotError(503, 'FICHA_RESPONSE_INVALID'); });
  };
}

function prescriptionEvent(input: {
  resourceRef: string; partnerPatientRef: string; commitment?: string; revoke?: true;
}): ClinicalEvent {
  return { schemaVersion: 1, eventId: randomUUID(), eventType: input.revoke ? 'clinical-link.revoked' : 'clinical-link.issued',
    partnerPatientRef: input.partnerPatientRef, resourceRef: input.resourceRef, category: 'cannabis.prescription',
    clinicalStatus: input.revoke ? 'revoked' : 'active', revision: input.revoke ? 2 : 1,
    documentRevision: 1, occurredAt: new Date().toISOString(), ...(input.commitment ? { commitment: input.commitment } : {}) };
}

export async function executeFichaLinkPilot(input: {
  action: string; data: Record<string, unknown>; token: string; env: Env; verifier: Verifier; fetcher?: typeof fetch;
  readOidcToken?: () => Promise<string>;
}) {
  const config = fichaPilotConfig(input.env);
  const fetcher = input.fetcher ?? fetch;
  const allowedRoles = input.action === 'snapshot' ? ['patient', 'doctor'] as const
    : ['claim', 'binding-status', 'document'].includes(input.action) ? ['patient'] as const : ['doctor'] as const;
  const actor = await createPrivyRbacAuthorizer({ verifier: input.verifier,
    store: createSupabasePrivyActorStore(input.env, fetcher) }).authorize(input.token, allowedRoles);
  if (!(actor.role === 'patient' ? [config.patient, config.control].includes(actor.actorRef)
    : actor.actorRef === config.doctor)) throw new PilotError(403, 'PILOT_ACTOR_NOT_ALLOWED');
  const ficha = fichaPort(config, fetcher, input.readOidcToken ?? getVercelOidcToken);

  async function db<T>(action: string, data: object = {}): Promise<T> {
    const response = await fetcher(new URL('/rest/v1/rpc/trustleaf_ficha_link_pilot', config.project), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5_000), cache: 'no-store',
      headers: { apikey: config.secret, 'content-type': 'application/json' },
      body: JSON.stringify({ p_subject: actor.subject, p_action: action, p_data: data }),
    }).catch(() => { throw new PilotError(503, 'PILOT_STORE_UNAVAILABLE'); });
    if (!response.ok) {
      const code = (await response.json().catch(() => null))?.code;
      if (code === '42501') throw new PilotError(403, 'PILOT_FORBIDDEN');
      if (code === 'PT404') throw new PilotError(404, 'PILOT_NOT_FOUND');
      if (code === 'PT409' || code === '23505') throw new PilotError(409, 'PILOT_CONFLICT');
      throw new PilotError(503, 'PILOT_STORE_UNAVAILABLE');
    }
    return response.json();
  }

  async function bindingStatus(binding: Binding | null, localActor: string) {
    if (!binding) return null;
    const result = await ficha<{ status: BindingStatus; partnerPatientRef?: string }>('bindings/status', {
      bindingId: binding.bindingId, actorRef: actorReference(config, localActor),
    });
    if (!['pending', 'claimed', 'active', 'revoked', 'expired'].includes(result.status)
      || (result.status === 'active' && !uuid.test(result.partnerPatientRef ?? ''))) throw new PilotError(503, 'FICHA_RESPONSE_INVALID');
    return result;
  }

  async function deliver(receipt: Prescription, resend = false) {
    try {
      const pending = [
        ...(!receipt.linkRef || resend ? [receipt.issueEvent] : []),
        ...(receipt.revokeEvent && (!receipt.revokeDelivered || resend) ? [receipt.revokeEvent] : []),
      ];
      for (const event of pending) {
        const remote = await ficha<{ eventId: string; linkRef: string; revision: number; result: string }>('clinical-link-events', event);
        if (remote.eventId !== event.eventId || !uuid.test(remote.linkRef) || remote.revision !== event.revision
          || !['applied', 'stale'].includes(remote.result)) throw new PilotError(503, 'FICHA_RESPONSE_INVALID');
        receipt = await db<Prescription>('ack', { resourceRef: receipt.resourceRef, eventId: event.eventId, linkRef: remote.linkRef });
      }
    } catch {
      // The issuer has already committed the operation. Explicit retry uses the same event ID and payload.
      return publicReceipt(receipt);
    }
    return publicReceipt(receipt);
  }

  switch (input.action) {
    case 'snapshot': {
      if (actor.role === 'patient') return { role: actor.role };
      return { role: actor.role, receipt: publicReceipt(await db<Prescription | null>('doctor-receipt', { patientRef: config.patient })) };
    }
    case 'claim': {
      const code = input.data.code;
      if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new PilotError(400, 'PILOT_INPUT_INVALID');
      const result = await ficha<{ bindingId: string; confirmationCode: string }>('bindings/claim', {
        code, actorRef: actorReference(config, actor.actorRef),
      });
      if (!uuid.test(result.bindingId) || typeof result.confirmationCode !== 'string'
        || !/^\d{8}$/.test(result.confirmationCode)) throw new PilotError(503, 'FICHA_RESPONSE_INVALID');
      await db('save-binding', { bindingId: result.bindingId });
      return { confirmationCode: result.confirmationCode };
    }
    case 'binding-status': {
      const binding = await db<Binding | null>('patient-binding');
      return { status: (await bindingStatus(binding, actor.actorRef))?.status ?? 'unlinked' };
    }
    case 'issue': {
      const binding = await db<Binding | null>('doctor-binding', { patientRef: config.patient });
      const remote = await bindingStatus(binding, config.patient);
      if (!binding || remote?.status !== 'active' || !remote.partnerPatientRef) throw new PilotError(409, 'PILOT_BINDING_INACTIVE');
      const resourceRef = randomUUID();
      const document = createSyntheticPrescription(resourceRef);
      const issueEvent = prescriptionEvent({ resourceRef, partnerPatientRef: remote.partnerPatientRef, commitment: document.commitment });
      const receipt = await db<Prescription>('issue', { patientRef: config.patient, bindingId: binding.bindingId, ...document, issueEvent });
      return deliver(receipt);
    }
    case 'revoke':
    case 'resend': {
      const resourceRef = assertUuid(input.data.resourceRef);
      let receipt = await db<Prescription>('issued-resource', { resourceRef });
      if (input.action === 'revoke' && !receipt.revokeEvent) {
        const revokeEvent = prescriptionEvent({ resourceRef, partnerPatientRef: receipt.issueEvent.partnerPatientRef, revoke: true });
        receipt = await db<Prescription>('revoke', { resourceRef, revokeEvent });
      }
      return deliver(receipt, input.action === 'resend');
    }
    case 'document': {
      const resourceRef = assertUuid(input.data.resourceRef);
      const document = await db<Prescription>('patient-document', { resourceRef });
      const bytes = Buffer.from(document.pdfBase64!, 'base64');
      const nonce = Buffer.from(document.nonce!, 'hex');
      if (!matchesPdfCommitment(bytes, nonce, document.commitment)) throw new PilotError(409, 'PDF_INTEGRITY_MISMATCH');
      let integrityStatus: 'pending' | 'verified' | 'unavailable' = 'pending';
      if (document.linkRef) {
        const proof = await ficha<{ linkRef: string; revision: number; integrityStatus: string; commitment: string | null }>(
          `clinical-links/${document.linkRef}/proof?revision=${document.issueEvent.documentRevision}`,
        ).catch(() => null);
        integrityStatus = 'unavailable';
        if (proof?.linkRef === document.linkRef && proof.revision === document.issueEvent.documentRevision) {
          if (proof.integrityStatus === 'pending') integrityStatus = 'pending';
          if (proof.integrityStatus === 'verified') {
            if (!matchesPdfCommitment(bytes, nonce, proof.commitment)) throw new PilotError(409, 'PDF_INTEGRITY_MISMATCH');
            integrityStatus = 'verified';
          }
        }
      }
      return { kind: 'pdf' as const, bytes, integrityStatus, clinicalStatus: document.revokeEvent ? 'revoked' as const : 'active' as const };
    }
    default: throw new PilotError(400, 'PILOT_INPUT_INVALID');
  }
}

function publicReceipt(receipt: Prescription | null) {
  if (!receipt) return null;
  return { resourceRef: receipt.resourceRef, clinicalStatus: receipt.revokeEvent ? 'revoked' : 'active',
    deliveryStatus: (receipt.revokeEvent ? receipt.revokeDelivered : receipt.linkRef) ? 'accepted' : 'pending' };
}

export async function fichaLinkPilotHandler(req: any, res: any, env: Env, verifier: Verifier) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'privy-id-token');
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    fichaPilotConfig(env);
    const token = req.headers?.['privy-id-token'];
    if (typeof token !== 'string' || !token.trim()) throw new PilotError(401, 'AUTH_REQUIRED');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body.action !== 'string' || !body.data || typeof body.data !== 'object'
      || Array.isArray(body.data) || Buffer.byteLength(JSON.stringify(body)) > 700) throw new PilotError(400, 'PILOT_INPUT_INVALID');
    const result = await executeFichaLinkPilot({ token, action: body.action, data: body.data, env, verifier });
    if (result && 'kind' in result && result.kind === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="receta-sintetica.pdf"');
      res.setHeader('X-TrustLeaf-Integrity', result.integrityStatus);
      res.setHeader('X-TrustLeaf-Clinical-State', result.clinicalStatus);
      return res.status(200).send(result.bytes);
    }
    return res.status(200).json(result);
  } catch (error) {
    const diagnostic = error as { statusCode?: number };
    const status = error instanceof PilotError ? error.status : error instanceof SyntaxError ? 400
      : diagnostic?.statusCode === 401 || diagnostic?.statusCode === 403 ? diagnostic.statusCode : 503;
    const code = error instanceof PilotError ? error.code : status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'PILOT_FORBIDDEN'
      : status === 400 ? 'PILOT_INPUT_INVALID' : 'PILOT_UNAVAILABLE';
    return res.status(status).json({ code });
  }
}
