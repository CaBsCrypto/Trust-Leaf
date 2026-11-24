import { waitlistAudiences, type WaitlistAudience } from '../../src/lib/waitlist.ts';

const cannabisOrigin = 'https://cannabis.trustleaf.org';
export const CANNABIS_WAITLIST_MAX_BODY_BYTES = 1_024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Signup = { audience: WaitlistAudience; email: string };
type SaveSignup = (signup: Signup) => Promise<unknown>;
type Environment = Record<string, string | undefined>;
type WaitlistRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type WaitlistResponse = {
  setHeader(name: string, value: string): unknown;
  status(statusCode: number): WaitlistResponse;
  json(body: { registered: boolean }): unknown;
};

function signupError(statusCode: 400 | 503) {
  const code = statusCode === 400 ? 'WAITLIST_INPUT_INVALID' : 'WAITLIST_UNAVAILABLE';
  return Object.assign(new Error(code), { statusCode });
}

function readSignup(body: unknown): Signup {
  let input = body;
  if (typeof input === 'string') {
    if (Buffer.byteLength(input) > CANNABIS_WAITLIST_MAX_BODY_BYTES) throw signupError(400);
    try { input = JSON.parse(input) as unknown; }
    catch { throw signupError(400); }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2
    || !Object.hasOwn(input, 'audience') || !Object.hasOwn(input, 'email')) throw signupError(400);

  const { audience: requestedAudience, email: value } = input as Record<string, unknown>;
  const audience = waitlistAudiences.find(audience => audience === requestedAudience);
  const email = typeof value === 'string' && value.length <= CANNABIS_WAITLIST_MAX_BODY_BYTES
    ? value.trim().toLowerCase()
    : '';
  if (!audience || email.length > 254 || !emailPattern.test(email)) {
    throw signupError(400);
  }
  return { audience, email };
}

export async function registerCannabisWaitlist({ body, save }: { body: unknown; save: SaveSignup }) {
  const signup = readSignup(body);
  try { await save(signup); }
  catch { throw signupError(503); }
  return { registered: true as const };
}

async function saveSignupToSupabase({ audience, email }: Signup, env: Environment, fetcher: typeof fetch) {
  const project = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.trim();
  const key = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!project || !key) throw signupError(503);
  const url = new URL('/rest/v1/rpc/trustleaf_cannabis_waitlist_signup', project);
  if (url.protocol !== 'https:' || url.username || url.password) throw signupError(503);

  const response = await fetcher(url, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_audience: audience, p_email: email }),
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok || (await response.json())?.registered !== true) throw signupError(503);
}

export async function cannabisWaitlistHandler(req: WaitlistRequest, res: WaitlistResponse,
  env: Environment, fetcher: typeof fetch = fetch) {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ registered: false });
  }
  if (req.headers?.origin !== cannabisOrigin) return res.status(403).json({ registered: false });
  if (env.TRUSTLEAF_CANNABIS_WAITLIST_ENABLED !== 'true') return res.status(503).json({ registered: false });

  const contentType = req.headers['content-type'];
  if (typeof contentType !== 'string' || contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return res.status(415).json({ registered: false });
  }
  const length = req.headers['content-length'];
  if (typeof length === 'string' && Number(length) > CANNABIS_WAITLIST_MAX_BODY_BYTES) {
    return res.status(413).json({ registered: false });
  }

  try {
    const result = await registerCannabisWaitlist({
      body: req.body,
      save: signup => saveSignupToSupabase(signup, env, fetcher),
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode === 400 ? 400 : 503;
    return res.status(status).json({ registered: false });
  }
}
