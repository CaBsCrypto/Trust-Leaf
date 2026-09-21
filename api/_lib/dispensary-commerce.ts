import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from './privy-supabase-rbac.js';
import type { PrivyIdentity } from './privy-identity.ts';

const reads = ['products', 'suppliers', 'receipts'];
const actions = [...reads, 'save-product', 'save-supplier', 'receive', 'link-batch'];
const failure = (statusCode: number, code: string) => Object.assign(new Error(code), { statusCode, code });
type Verifier = { verify(token: string): Promise<PrivyIdentity> };
type Request = { method?: string; headers?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown };
type Response = { setHeader(key: string, value: string): unknown; status(code: number): Response; json(value: unknown): unknown };
function envelope(value: unknown): { action: string; input: Record<string, unknown> } {
  if (!value || typeof value !== 'object' || !('action' in value) || !('input' in value)
    || typeof value.action !== 'string' || !actions.includes(value.action)
    || !value.input || typeof value.input !== 'object' || Array.isArray(value.input)
    || Buffer.byteLength(JSON.stringify(value)) > 12000) throw failure(400, 'COMMERCE_INPUT_INVALID');
  return { action: value.action, input: value.input as Record<string, unknown> };
}
export async function executeDispensaryCommerce(options: {
  token: string; command: unknown; env: Record<string, string | undefined>; verifier: Verifier; fetcher?: typeof fetch;
}) {
  if (options.env.TRUSTLEAF_OPERATIONS_PILOT_ENABLED !== 'true'
    || options.env.TRUSTLEAF_COMMERCE_CATALOG_ENABLED !== 'true') throw failure(503, 'COMMERCE_DISABLED');
  const command = envelope(options.command);
  const fetcher = options.fetcher ?? fetch;
  const principal = await createPrivyRbacAuthorizer({ verifier: options.verifier,
    store: createSupabasePrivyActorStore(options.env, fetcher) }).authorize(options.token, ['dispensary']);
  const response = await fetcher(new URL('/rest/v1/rpc/trustleaf_dispensary_commerce', options.env.SUPABASE_URL ?? options.env.VITE_SUPABASE_URL), {
    method: 'POST', headers: { apikey: (options.env.SUPABASE_SECRET_KEY ?? options.env.SUPABASE_SERVICE_ROLE_KEY)!.trim(), 'content-type': 'application/json' },
    body: JSON.stringify({ p_subject: principal.subject, p_action: command.action, p_input: command.input }), signal: AbortSignal.timeout(10000),
  }).catch(() => { throw failure(503, 'COMMERCE_UNAVAILABLE'); });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code = payload && typeof payload === 'object' && 'code' in payload ? payload.code : null;
    const status = code === '42501' ? 403 : ['PT409', '40001', '23505'].includes(String(code)) ? 409
      : typeof code === 'string' && /^(22\w{3}|23502|23514|23503)$/.test(code) ? 400 : 503;
    throw failure(status, status === 409 ? 'COMMERCE_CONFLICT' : 'COMMERCE_UNAVAILABLE');
  }
  return response.json();
}
export async function dispensaryCommerceHandler(req: Request, res: Response, env: Record<string, string | undefined>, verifier: Verifier) {
  res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Vary', 'privy-id-token');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  const token = req.headers?.['privy-id-token'];
  if (typeof token !== 'string' || !token.trim()) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  try {
    const command = envelope(req.method === 'GET' ? { action: req.query?.collection, input: {
      limit: req.query?.limit ?? 25, offset: req.query?.offset ?? 0,
    } } : typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
    if ((req.method === 'GET') !== reads.includes(command.action)) throw failure(400, 'COMMERCE_INPUT_INVALID');
    return res.status(200).json(await executeDispensaryCommerce({ token, command, env, verifier }));
  } catch (error) {
    const e = error as { statusCode?: number; code?: string };
    const status = error instanceof SyntaxError ? 400 : [400, 401, 403, 409].includes(e.statusCode ?? 0) ? e.statusCode! : 503;
    return res.status(status).json({ code: e.code === 'COMMERCE_DISABLED' ? e.code : status === 409 ? 'COMMERCE_CONFLICT' : 'COMMERCE_UNAVAILABLE' });
  }
}
