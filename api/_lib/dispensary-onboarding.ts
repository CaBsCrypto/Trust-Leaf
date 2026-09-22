import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrivyIdentity } from './privy-identity.js';
import { currentEmails, normalizeTeamEmail, teamCrypto, teamFailure, teamRpc } from './team-invitations.js';

type Env = Record<string, string | undefined>;
type Json = Record<string, unknown>;
type Verifier = { verify(token: string): Promise<PrivyIdentity> };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const object = (value: unknown): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
  return value as Json;
};
const string = (value: unknown) => {
  if (typeof value !== 'string') throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
  return value;
};
const reference = (value: unknown) => {
  const result = string(value);
  if (!uuid.test(result)) throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
  return result;
};

export async function executeOnboarding(args: { token: string; command: unknown; env: Env; verifier: Verifier; fetcher?: typeof fetch }) {
  const { token, env, verifier } = args, fetcher = args.fetcher ?? fetch;
  if (env.TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED !== 'true') throw teamFailure(503, 'ONBOARDING_DISABLED');
  const c = object(args.command), action = string(c.action);
  if (!['list','invite','resend','cancel','retry-send','inspect','accept','read-draft','save-draft','submit','review'].includes(action)
    || Buffer.byteLength(JSON.stringify(c)) > 12000) throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
  const identity = await verifier.verify(token), crypto = teamCrypto(env);
  const rpc = async (operation: string, input: Json = {}) => object(await teamRpc(env, fetcher,
    'trustleaf_dispensary_onboarding', { p_subject: identity.subject, p_action: operation, p_input: input }));
  if (action === 'inspect' || action === 'accept') {
    const secret = string(c.token);
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
    const emails = await currentEmails(identity.subject, env, fetcher);
    return rpc(action, { tokenHash: hash(secret), emailHashes: emails.map(crypto.hashEmail), consent: c.consent === true });
  }
  if (action === 'list') {
    const data = await rpc(action);
    if (!Array.isArray(data.invitations) || !Array.isArray(data.applications)) throw teamFailure(503, 'ONBOARDING_UNAVAILABLE');
    return { ...data, invitations: data.invitations.map(value => {
      const { emailCiphertext, ...inv } = object(value);
      return { ...inv, email: crypto.open(string(emailCiphertext), `onboarding:${string(inv.invitationRef)}:email`) };
    }) };
  }
  if (action === 'read-draft') {
    const data = await rpc(action);
    const emails = await currentEmails(identity.subject, env, fetcher);
    return { ...data, accessEmail: emails[0] ?? null };
  }
  if (action === 'retry-send') {
    const invitationRef = reference(c.invitationRef);
    await send(rpc, invitationRef, crypto, env, fetcher);
    return { invitationRef };
  }
  const operationId = reference(c.operationId);
  let input: Json;
  let intent: Json;
  if (['invite','resend','cancel'].includes(action)) {
    const invitationRef = action === 'invite' ? randomUUID() : reference(c.invitationRef);
    input = { invitationRef };
    intent = action === 'invite' ? { action, email: normalizeTeamEmail(c.email) } : { action, invitationRef };
    if (action !== 'cancel') {
      if (!env.RESEND_API_KEY) throw teamFailure(503, 'ONBOARDING_MAIL_SETUP_REQUIRED');
      const secret = randomBytes(32).toString('base64url');
      input.tokenHash = hash(secret);
      input.payloadCiphertext = crypto.seal(secret, `onboarding:${invitationRef}:token`);
      if (action === 'invite') {
        const email = normalizeTeamEmail(c.email);
        input.emailHash = crypto.hashEmail(email);
        input.emailCiphertext = crypto.seal(email, `onboarding:${invitationRef}:email`);
      }
    }
  } else {
    const applicationRef = reference(c.applicationRef);
    if (!Number.isSafeInteger(c.version) || Number(c.version) < 1) throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
    input = { applicationRef, version: c.version };
    if (action === 'save-draft') input.profile = object(c.profile);
    if (action === 'submit') input.consent = c.consent === true;
    if (action === 'review') {
      if (!['approve','changes','reject'].includes(string(c.decision))) throw teamFailure(400, 'ONBOARDING_INPUT_INVALID');
      input.decision = c.decision; input.reason = string(c.reason);
    }
    intent = { action, ...input };
  }
  const result = await rpc(action, { ...input, operationId, intent: hash(JSON.stringify(intent)) });
  if (action === 'invite' || action === 'resend') await send(rpc, string(result.invitationRef), crypto, env, fetcher);
  return result;
}

async function send(rpc: (action: string, input: Json) => Promise<Json>, ref: string,
  crypto: ReturnType<typeof teamCrypto>, env: Env, fetcher: typeof fetch) {
  if (!env.RESEND_API_KEY) throw teamFailure(503, 'ONBOARDING_MAIL_SETUP_REQUIRED');
  const job = await rpc('claim-send', { invitationRef: ref });
  if (!job.mail_ref) return;
  const email = crypto.open(string(job.email_ciphertext), `onboarding:${ref}:email`);
  const secret = crypto.open(string(job.payload_ciphertext), `onboarding:${ref}:token`);
  const link = `https://www.trustleaf.org/dispensario#dispensary-invite=${secret}`;
  let state = 'uncertain', providerRef: string | null = null;
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'Idempotency-Key': `onboarding/${string(job.mail_ref)}` },
      body: JSON.stringify({ from: 'Trust Leaf <admin@trustleaf.org>', reply_to: 'admin@trustleaf.org', to: [email],
        subject: 'Incorporacion de tu dispensario a Trust Leaf',
        text: `Te invitamos a completar la solicitud de encargado de un dispensario de pruebas.\n\nVerifica este correo con Privy y acepta expresamente:\n${link}\n\nVence: ${string(job.expires_at)}.\n\nLa invitacion no concede acceso operativo. La solicitud requiere revision administrativa. Este piloto no habilita atencion ni dispensacion reales. Si no esperabas esta invitacion, ignorala.`,
        tags: [{ name: 'app', value: 'trustleaf' }, { name: 'category', value: 'dispensary_onboarding' }],
      }), signal: AbortSignal.timeout(8000),
    });
    if (response.ok) { providerRef = string(object(await response.json()).id); state = 'sent'; }
    else state = response.status >= 500 || response.status === 429 ? 'uncertain' : 'failed';
  } catch { /* Retry the durable provider key, never invent a successful delivery. */ }
  await rpc('finish-send', { invitationRef: ref, leaseRef: job.lease_ref, state, providerRef });
}

export async function dispensaryOnboardingHandler(
  req: { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res: { setHeader(k: string, v: string): unknown; status(s: number): { json(body: unknown): unknown } },
  env: Env, verifier: Verifier,
) {
  res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Vary', 'privy-id-token');
  if (!['GET','POST'].includes(req.method ?? '')) return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  const token = req.headers['privy-id-token'];
  if (typeof token !== 'string' || !token.trim()) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  try {
    const command: unknown = req.method === 'GET' ? { action: 'list' } : typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return res.status(200).json(await executeOnboarding({ token, command, env, verifier }));
  } catch (error) {
    const e = error as { statusCode?: number; code?: string };
    const status = error instanceof SyntaxError ? 400 : [400,401,403,409,429].includes(e.statusCode ?? 0) ? e.statusCode! : 503;
    return res.status(status).json({ code: e.code === 'ONBOARDING_DISABLED' ? e.code : 'ONBOARDING_UNAVAILABLE' });
  }
}
