import { randomBytes } from 'node:crypto';
import type { PrivyIdentity } from './privy-identity.ts';
import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from './privy-supabase-rbac.js';
import { authorizationRequest, calendarCallback, calendarScopes, digest, seal, unseal } from './google-calendar-security.js';

export async function googleCalendarHandler(req: any, res: any, action: string, dependencies: {
  env?: Record<string, string | undefined>; fetcher?: typeof fetch;
  verifier?: { verify(token: string): Promise<PrivyIdentity> };
} = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const env = dependencies.env ?? process.env;
  const fetch = dependencies.fetcher ?? globalThis.fetch;
  const cookie = '__Host-trustleaf-calendar';
  const clearCookie = () => res.setHeader('Set-Cookie', `${cookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  try {
    if (env.GOOGLE_CALENDAR_ENABLED !== 'true') return res.status(503).json({ code: 'CALENDAR_NOT_CONFIGURED' });
    const secret = env.GOOGLE_CALENDAR_ENCRYPTION_KEY ?? '';
    if (!/^[a-f0-9]{64}$/i.test(secret) || !env.GOOGLE_CALENDAR_CLIENT_SECRET || env.GOOGLE_CALENDAR_REDIRECT_URI !== calendarCallback) throw new Error('Configuration');
    const store = createSupabasePrivyActorStore(env, fetch);
    async function rpc(operation: string, subject = '', state = '', value = '') {
      const response = await fetch(new URL('/rest/v1/rpc/trustleaf_central_calendar_connection', env.SUPABASE_URL ?? env.VITE_SUPABASE_URL), {
        method: 'POST', headers: { apikey: (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(), 'content-type': 'application/json' },
        body: JSON.stringify({ p_action: operation, p_subject: subject, p_key: state, p_value: value }), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Storage');
      return response.json();
    }
    if (action === 'callback') {
      if (req.method !== 'GET') return res.status(405).end();
      const state = req.query.state;
      const browser = String(req.headers.cookie ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookie}=`))?.slice(cookie.length + 1);
      if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || !browser || !/^[A-Za-z0-9_-]{43}$/.test(browser)) throw new Error('State');
      // Including the browser nonce in the lookup prevents cross-browser state consumption.
      const pending = await rpc('consume', '', digest(`${state}:${browser}`));
      clearCookie();
      const binding = await store.resolve(pending.subject);
      if (!binding || binding.role !== 'admin' || binding.state !== 'active' || (binding.validUntil && Date.parse(binding.validUntil) <= Date.now())) throw new Error('Role');
      if (req.query.error || typeof req.query.code !== 'string' || req.query.code.length > 4096) throw new Error('Consent');
      const verifier = unseal(pending.payload, secret, `central-state:${pending.subject}`);
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.GOOGLE_CALENDAR_CLIENT_ID!, client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET!, redirect_uri: calendarCallback, grant_type: 'authorization_code', code: req.query.code, code_verifier: verifier }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Exchange');
      const tokens = await response.json();
      const grantedScopes = new Set(String(tokens.scope ?? '').split(' '));
      if (typeof tokens.refresh_token !== 'string' || !calendarScopes.every(scope => grantedScopes.has(scope))) throw new Error('Missing consent');
      await rpc('save', pending.subject, '', seal(tokens.refresh_token, secret, 'central-calendar:refresh'));
      return res.redirect(303, '/admin?calendar=connected');
    }
    if (!['start', 'status', 'setup', 'process', 'jobs'].includes(action)) return res.status(404).end();
    const readOnly = ['status', 'jobs'].includes(action);
    if (req.method !== (readOnly ? 'GET' : 'POST')) return res.status(405).end();
    if (!readOnly && req.headers.origin !== 'https://www.trustleaf.org') return res.status(403).json({ code: 'ORIGIN_REJECTED' });
    const token = req.headers['privy-id-token'];
    if (typeof token !== 'string') return res.status(401).json({ code: 'AUTH_REQUIRED' });
    const verifier = dependencies.verifier ?? (await import('./privy-identity.js')).createPrivyIdentityVerifier(env);
    const principal = await createPrivyRbacAuthorizer({ verifier, store }).authorize(token, ['admin']);
    if (action === 'jobs') {
      const response = await fetch(new URL('/rest/v1/rpc/trustleaf_calendar_job', env.SUPABASE_URL ?? env.VITE_SUPABASE_URL), {
        method: 'POST', headers: { apikey: (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(), 'content-type': 'application/json' },
        body: JSON.stringify({p_action:'list',p_input:{}}), signal:AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Storage');
      return res.status(200).json({jobs:await response.json()});
    }
    if (action === 'setup') {
      const { setupCentralCalendar } = await import('./google-calendar-setup.js');
      return res.status(200).json(await setupCentralCalendar(env, fetch));
    }
    if (action === 'process') {
      const { calendarWorkStore } = await import('./google-calendar-store.js');
      const { processCalendarJob } = await import('./google-calendar-worker.js');
      return res.status(200).json(await processCalendarJob(calendarWorkStore(env, fetch), fetch));
    }
    if (action === 'status') return res.status(200).json(await rpc('status', principal.subject));
    const auth = authorizationRequest(env.GOOGLE_CALENDAR_CLIENT_ID ?? '');
    const browser = randomBytes(32).toString('base64url');
    await rpc('start', principal.subject, digest(`${auth.state}:${browser}`), seal(auth.verifier, secret, `central-state:${principal.subject}`));
    res.setHeader('Set-Cookie', `${cookie}=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    return res.status(200).json({ url: auth.url });
  } catch (error) {
    if (action === 'setup') {
      const known = new Set(['CALENDAR_SETUP_STORAGE_FAILED', 'CALENDAR_CONNECTION_REQUIRED',
        'CALENDAR_RECONNECT_REQUIRED', 'CALENDAR_REFRESH_FAILED', 'CALENDAR_SETUP_REVIEW_REQUIRED',
        'CALENDAR_CREATE_FAILED', 'CALENDAR_READ_FAILED', 'CALENDAR_MEET_UNAVAILABLE']);
      const message = error instanceof Error ? error.message : '';
      const code = known.has(message) ? message :
        (error as { code?: string })?.code === 'ERR_MODULE_NOT_FOUND' ? 'CALENDAR_MODULE_MISSING' : 'CALENDAR_SETUP_FAILED';
      console.error(code);
      const status = (error as { statusCode?: number }).statusCode;
      return res.status(status === 401 || status === 403 ? status : 503).json({ code });
    }
    if (action === 'callback') { clearCookie(); return res.redirect(303, '/admin?calendar=error'); }
    const status = (error as { statusCode?: number }).statusCode;
    return res.status(status === 401 || status === 403 ? status : 503).json({ code: 'CALENDAR_CONNECTION_UNAVAILABLE' });
  }
}
