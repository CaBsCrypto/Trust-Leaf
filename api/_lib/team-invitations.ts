import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import type { PrivyIdentity } from './privy-identity.js';
import type { TeamCommand } from '../../src/features/operations/team-contracts.js';

type Env = Record<string, string | undefined>;
type Json = Record<string, unknown>;
type Verifier = { verify(token: string): Promise<PrivyIdentity> };
const TEAM_MAIL_FROM = 'Trust Leaf <admin@trustleaf.org>';
const TEAM_MAIL_TAGS = [{name:'app',value:'trustleaf'},{name:'category',value:'operator_invitation'}];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const teamFailure = (statusCode: number, code: string) => Object.assign(new Error(code), { statusCode, code });
function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw teamFailure(503, 'TEAM_UNAVAILABLE');
  return value as Json;
}
function text(value: unknown): string { if (typeof value !== 'string') throw teamFailure(503,'TEAM_UNAVAILABLE'); return value; }
export function normalizeTeamEmail(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw teamFailure(400,'TEAM_INPUT_INVALID');
  return value.trim().toLowerCase();
}
export function teamCrypto(env: Env) {
  const secret = env.TEAM_INVITATION_ENCRYPTION_KEY;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw teamFailure(503,'TEAM_MAIL_SETUP_REQUIRED');
  const key = Buffer.from(secret,'hex');
  return {
    hashEmail: (email: string) => createHmac('sha256',key).update('team-email|'+email).digest('hex'),
    seal(value: string, context: string) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(Buffer.from(context));
      const data = Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
      return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64url')).join('.');
    },
    open(value: string, context: string) {
      const parts = value.split('.').map(v=>Buffer.from(v,'base64url'));
      if (parts.length!==3 || parts[0].length!==12 || parts[1].length!==16) throw teamFailure(503,'TEAM_UNAVAILABLE');
      const decipher = createDecipheriv('aes-256-gcm',key,parts[0]);
      decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(parts[1]);
      return Buffer.concat([decipher.update(parts[2]),decipher.final()]).toString('utf8');
    },
  };
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export async function teamRpc(env: Env, fetcher: typeof fetch, name: string, body: Json): Promise<unknown> {
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw teamFailure(503,'TEAM_UNAVAILABLE');
  const response = await fetcher(new URL('/rest/v1/rpc/'+name,env.SUPABASE_URL ?? env.VITE_SUPABASE_URL), {
    method:'POST',headers:{apikey:key.trim(),'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(()=>null);
    const code = payload && typeof payload==='object' && 'code' in payload ? payload.code : null;
    const status = code==='42501'?403:code==='PT429'?429:['PT409','23505','40001'].includes(String(code))?409:/^22|^235/.test(String(code))?400:503;
    throw teamFailure(status,'TEAM_UNAVAILABLE');
  }
  // PostgREST returns no body for successful void RPCs such as delivery events.
  if (response.status === 204) return null;
  return response.json();
}

export function verifiedTeamEmails(value: unknown): string[] {
  const user = object(value);
  const emails = new Set<string>();
  if (!Array.isArray(user.linked_accounts)) return [];
  for (const item of user.linked_accounts) {
    const account = object(item);
    if (!['email','google_oauth'].includes(String(account.type)) || typeof account.latest_verified_at !== 'number' || account.latest_verified_at<=0) continue;
    const candidate = account.type==='email'?account.address:account.email;
    try { emails.add(normalizeTeamEmail(candidate)); } catch { /* Ignore non-email identities. */ }
  }
  return [...emails];
}
async function currentEmails(subject: string, env: Env, fetcher: typeof fetch): Promise<string[]> {
  if (!/^did:privy:[A-Za-z0-9._:-]{6,500}$/.test(subject) || !env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) throw teamFailure(503,'TEAM_UNAVAILABLE');
  const response = await fetcher(`https://api.privy.io/v1/users/${encodeURIComponent(subject)}`, {
    headers:{authorization:`Basic ${Buffer.from(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`).toString('base64')}`,'privy-app-id':env.PRIVY_APP_ID},signal:AbortSignal.timeout(5000),
  });
  if (!response.ok) throw teamFailure(503,'TEAM_UNAVAILABLE');
  const user = object(await response.json());
  if (user.id!==subject) throw teamFailure(503,'TEAM_UNAVAILABLE');
  return verifiedTeamEmails(user);
}

export async function executeTeamCommand(args: { token: string; command: TeamCommand; env: Env; verifier: Verifier; fetcher?: typeof fetch }) {
  const {env,verifier,token,command:c} = args, fetcher = args.fetcher ?? fetch;
  if (env.TRUSTLEAF_OPERATIONS_PILOT_ENABLED!=='true' || (env.TRUSTLEAF_TEAM_INVITATIONS_ENABLED!=='true' && !['list','cancel'].includes(c?.action))) throw teamFailure(503,'TEAM_DISABLED');
  if (!c || !['list','create','resend','cancel','retry-send','inspect','accept'].includes(c.action) || Buffer.byteLength(JSON.stringify(c))>2000) throw teamFailure(400,'TEAM_INPUT_INVALID');
  const identity = await verifier.verify(token), crypto = teamCrypto(env);
  const rpc = async (action: string, input: Json = {}) => object(await teamRpc(env,fetcher,'trustleaf_team_invitations',{p_subject:identity.subject,p_action:action,p_input:input}));
  if (c.action==='inspect' || c.action==='accept') {
    if (typeof c.token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(c.token)) throw teamFailure(400,'TEAM_INPUT_INVALID');
    // Re-read linked accounts from Privy: a cached JWT or client-provided email is insufficient.
    const emailHashes = (await currentEmails(identity.subject,env,fetcher)).map(crypto.hashEmail);
    return rpc(c.action,{tokenHash:hash(c.token),emailHashes,...(c.action==='accept'?{acceptSyntheticOnly:c.acceptSyntheticOnly===true}:{})});
  }
  if (c.action==='list') {
    const data = await rpc('list');
    if (!Array.isArray(data.members) || !Array.isArray(data.invitations)) throw teamFailure(503,'TEAM_UNAVAILABLE');
    const members = [];
    for (const item of data.members) {
      const member = object(item);
      let email: string | null = null;
      try { email = (await currentEmails(text(member.subject),env,fetcher))[0] ?? null; } catch { /* Do not hide membership on provider failure. */ }
      members.push({actorRef:member.actorRef,role:member.role,email});
    }
    const invitations = data.invitations.map(item=>{
      const i = object(item);
      const {emailCiphertext,...safe} = i;
      return {...safe,email:crypto.open(text(emailCiphertext),`team:${text(i.invitationRef)}:email`)};
    });
    return {invitationsEnabled:env.TRUSTLEAF_TEAM_INVITATIONS_ENABLED==='true',organization:data.organization,membership:data.membership,members,invitations};
  }
  if (c.action==='retry-send') {
    if (!UUID.test(c.invitationRef)) throw teamFailure(400,'TEAM_INPUT_INVALID');
    await sendInvitation(rpc,c.invitationRef,crypto,env,fetcher);
    return {invitationRef:c.invitationRef};
  }
  if (!UUID.test(c.operationId)) throw teamFailure(400,'TEAM_INPUT_INVALID');
  const invitationRef = c.action==='create'?randomUUID():c.invitationRef;
  if (!UUID.test(invitationRef)) throw teamFailure(400,'TEAM_INPUT_INVALID');
  let fields: Json = {};
  if (c.action==='create' || c.action==='resend') {
    if (!env.RESEND_API_KEY) throw teamFailure(503,'TEAM_MAIL_SETUP_REQUIRED');
    const secret = randomBytes(32).toString('base64url');
    fields = {tokenHash:hash(secret),payloadCiphertext:crypto.seal(secret,`team:${invitationRef}:token`),
      orgLimit:Number(env.TEAM_ORG_DAILY_LIMIT ?? 20),recipientLimit:Number(env.TEAM_RECIPIENT_DAILY_LIMIT ?? 3),cooldownSeconds:60};
    if (c.action==='create') {
      const email = normalizeTeamEmail(c.email);
      fields.emailHash=crypto.hashEmail(email); fields.emailCiphertext=crypto.seal(email,`team:${invitationRef}:email`);
    }
  }
  const intent = hash(JSON.stringify(c.action==='create'?{action:c.action,email:normalizeTeamEmail(c.email)}:{action:c.action,invitationRef}));
  const result = await rpc(c.action,{invitationRef,operationId:c.operationId,intent,...fields});
  if (c.action!=='cancel') await sendInvitation(rpc,text(result.invitationRef),crypto,env,fetcher);
  return result;
}

async function sendInvitation(rpc: (action: string,input: Json)=>Promise<Json>, ref: string, crypto: ReturnType<typeof teamCrypto>, env: Env, fetcher: typeof fetch) {
  if (!env.RESEND_API_KEY) throw teamFailure(503,'TEAM_MAIL_SETUP_REQUIRED');
  const job = await rpc('claim-send',{invitationRef:ref});
  if (!job.mail_ref) return;
  const email = crypto.open(text(job.email_ciphertext),`team:${ref}:email`);
  const secret = crypto.open(text(job.payload_ciphertext),`team:${ref}:token`);
  const url = `https://www.trustleaf.org/dispensario#team-invite=${secret}`;
  const message = `Has recibido una invitacion para trabajar como operador en ${text(job.organization_name)}.\n\nSolo datos ficticios: piloto Trust Leaf. No habilita atencion ni entregas reales.\n\nVerifica este mismo correo con Privy y acepta la invitacion:\n${url}\n\nVence: ${text(job.expires_at)}. Si no esperabas esta invitacion, ignorala.`;
  let state = 'uncertain', providerRef: string | null = null;
  try {
    const response = await fetcher('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','Idempotency-Key':`team/${text(job.mail_ref)}`},
      body:JSON.stringify({from:TEAM_MAIL_FROM,reply_to:'admin@trustleaf.org',to:[email],subject:'Invitacion al equipo de Trust Leaf',text:message,tags:TEAM_MAIL_TAGS}),signal:AbortSignal.timeout(8000)});
    if (response.ok) { providerRef=text(object(await response.json()).id); state='sent'; }
    else state=response.status>=500?'uncertain':'failed';
  } catch { /* Preserve uncertainty; the same durable mail key is used on retry. */ }
  await rpc('finish-send',{invitationRef:ref,leaseRef:job.lease_ref,state,providerRef});
}

export async function teamMailWebhook(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = {'Cache-Control':'no-store, private'};
  if (request.method!=='POST') return Response.json({code:'METHOD_NOT_ALLOWED'},{status:405,headers});
  if (!env.RESEND_WEBHOOK_SECRET) return Response.json({code:'TEAM_UNAVAILABLE'},{status:503,headers});
  if (Number(request.headers.get('content-length'))>65536) return Response.json({code:'INPUT_INVALID'},{status:413,headers});
  const payload = await request.text();
  if (Buffer.byteLength(payload)>65536) return Response.json({code:'INPUT_INVALID'},{status:413,headers});
  let event;
  try { event = new Resend(env.RESEND_API_KEY ?? 'webhook-only').webhooks.verify({payload,headers:{id:request.headers.get('svix-id') ?? '',timestamp:request.headers.get('svix-timestamp') ?? '',signature:request.headers.get('svix-signature') ?? ''},webhookSecret:env.RESEND_WEBHOOK_SECRET}); }
  catch { return Response.json({code:'SIGNATURE_INVALID'},{status:400,headers}); }
  const states: Record<string,string> = {'email.sent':'sent','email.delivered':'delivered','email.delivery_delayed':'delayed','email.failed':'failed','email.bounced':'bounced','email.complained':'bounced'};
  const state=states[event.type];
  try {
    // Resend webhooks cover the whole account, including unrelated applications.
    if (state && 'email_id' in event.data && 'from' in event.data && event.data.from===TEAM_MAIL_FROM
      && 'tags' in event.data && event.data.tags?.app==='trustleaf' && event.data.tags?.category==='operator_invitation') {
      await teamRpc(env,fetcher,'trustleaf_team_mail_event',{p_event_id:request.headers.get('svix-id'),p_provider_ref:event.data.email_id,p_state:state});
    }
    return Response.json({received:true},{headers});
  } catch { return Response.json({code:'TEAM_UNAVAILABLE'},{status:503,headers}); }
}

export async function teamInvitationHandler(req: { method?: string; headers: Record<string,string|string[]|undefined>; body?: unknown }, res: {setHeader(k:string,v:string):unknown;status(s:number):{json(body:unknown):unknown}}, env: Env, verifier: Verifier) {
  res.setHeader('Cache-Control','no-store, private'); res.setHeader('Vary','privy-id-token');
  if (!['GET','POST'].includes(req.method ?? '')) return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const token=req.headers['privy-id-token'];
  if (typeof token!=='string' || !token.trim()) return res.status(401).json({code:'AUTH_REQUIRED'});
  try {
    const body = req.method==='GET'?{action:'list'}:typeof req.body==='string'?JSON.parse(req.body):req.body;
    return res.status(200).json(await executeTeamCommand({token,command:body,env,verifier}));
  } catch(error) {
    const e=error as {statusCode?:number;code?:string};
    const status=error instanceof SyntaxError?400:[400,401,403,409,429].includes(e.statusCode ?? 0)?e.statusCode!:503;
    return res.status(status).json({code:['TEAM_DISABLED','TEAM_MAIL_SETUP_REQUIRED'].includes(e.code ?? '')?e.code:'TEAM_UNAVAILABLE'});
  }
}
