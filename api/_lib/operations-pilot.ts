import { pilotActions, type PilotCommand } from '../../src/features/operations/contracts.js';
import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from './privy-supabase-rbac.js';
import type { PrivyIdentity } from './privy-identity.ts';

export async function executeOperationsPilot(input: {
  token: string; command: PilotCommand; env: Record<string, string | undefined>;
  verifier: { verify(token: string): Promise<PrivyIdentity> }; fetcher?: typeof fetch;
}) {
  if (input.env.TRUSTLEAF_OPERATIONS_PILOT_ENABLED !== 'true') throw failure(503, 'PILOT_DISABLED');
  const c = input.command;
  if (!c || !pilotActions.includes(c.action) || !c.input || Array.isArray(c.input) || typeof c.input !== 'object'
    || Buffer.byteLength(JSON.stringify(c)) > 12000) throw failure(400, 'PILOT_INPUT_INVALID');
  const fetcher = input.fetcher ?? fetch;
  const principal = await createPrivyRbacAuthorizer({ verifier: input.verifier,
    store: createSupabasePrivyActorStore(input.env, fetcher) }).authorize(input.token, ['admin', 'doctor', 'patient', 'dispensary']);
  const response = await fetcher(new URL('/rest/v1/rpc/trustleaf_operations_pilot', input.env.SUPABASE_URL ?? input.env.VITE_SUPABASE_URL), {
    method: 'POST', headers: { apikey: (input.env.SUPABASE_SECRET_KEY ?? input.env.SUPABASE_SERVICE_ROLE_KEY)!.trim(), 'content-type': 'application/json' },
    body: JSON.stringify({ p_subject: principal.subject, p_action: c.action, p_input: c.input }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const diagnostic = await response.json().catch(() => ({}));
    const status = diagnostic.code === '42501' ? 403 : ['40001', '23505'].includes(diagnostic.code) ? 409
      : /^22|^23502$|^23514$|^23503$/.test(diagnostic.code ?? '') ? 400 : 503;
    throw failure(status, status === 409 ? 'PILOT_CONFLICT' : 'PILOT_UNAVAILABLE');
  }
  return response.json();
}
function failure(statusCode: number, code: string) { return Object.assign(new Error(code), { statusCode, code }); }

export async function operationsPilotHandler(req: any, res: any, env: Record<string, string | undefined>, verifier: { verify(token: string): Promise<PrivyIdentity> }) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Vary', 'privy-id-token');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  const token = req.headers?.['privy-id-token'];
  if (typeof token !== 'string' || !token.trim()) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  try {
    const command = req.method === 'GET' ? { action: 'snapshot', input: {} }
      : typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (req.method === 'POST' && command?.action === 'snapshot') return res.status(400).json({ code: 'PILOT_INPUT_INVALID' });
    return res.status(200).json(await executeOperationsPilot({ token, command, env, verifier }));
  } catch (error) {
    const e = error as { statusCode?: number; code?: string };
    const status = error instanceof SyntaxError ? 400 : [400, 401, 403, 409].includes(e.statusCode ?? 0) ? e.statusCode! : 503;
    return res.status(status).json({ code: e.code === 'PILOT_DISABLED' ? e.code : status === 409 ? 'PILOT_CONFLICT' : 'PILOT_UNAVAILABLE' });
  }
}
