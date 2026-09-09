import { operationsDatabase } from '../sql/operations-db.mjs';
import { executeTeamCommand } from '../../api/_lib/team-invitations.ts';

// Synthetic identity injection lives only in this loopback QA server, never in app code.
export function operationsFixture() { return { name: 'operations-sql-fixture', async configureServer(server) {
  const { db, subjects, call, agenda } = await operationsDatabase();
  subjects.newWorker = 'did:privy:pilot-fixture-newWorker';
  const deliveries = [];
  const env = { TRUSTLEAF_TEAM_INVITATIONS_ENABLED: 'true', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: 'ab'.repeat(32),
    SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SECRET_KEY: 'fixture', PRIVY_APP_ID: 'fixture', PRIVY_APP_SECRET: 'fixture', RESEND_API_KEY: 'fixture' };
  const fetcher = async (url, init) => {
    const address = String(url);
    if (address.startsWith('https://api.privy.io/v1/users/')) {
      const subject = decodeURIComponent(address.split('/').at(-1)), key = Object.keys(subjects).find(k => subjects[k] === subject);
      return Response.json({ id: subject, linked_accounts: [{ type: 'email', address: `${key}@example.test`, latest_verified_at: 1 }] });
    }
    const payload = JSON.parse(init.body);
    if (address === 'https://api.resend.com/emails') {
      const id = `fixture-${deliveries.length}`; deliveries.push({ ...payload, id }); return Response.json({ id });
    }
    if (address.endsWith('/trustleaf_team_invitations')) {
      try { return Response.json((await db.query('select public.trustleaf_team_invitations($1,$2,$3) as data', [payload.p_subject, payload.p_action, payload.p_input])).rows[0].data); }
      catch (e) { return Response.json({ code: e.code }, { status: 400 }); }
    }
    throw new Error('Fixture rejected external request');
  };
  server.httpServer?.once('close', () => void db.close());
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/__team-mail') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(deliveries)); return; }
    if (!['/api/agenda', '/api/operations-pilot', '/api/team-invitations'].includes(url.pathname)) return next();
    res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    const key = String(req.headers['privy-id-token'] ?? '').replace(/^fixture-/, '');
    if (!(key in subjects)) { res.statusCode = 401; res.end('{}'); return; }
    try {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 12000) throw new Error('request too large'); }
      const command = req.method === 'GET' ? url.pathname === '/api/agenda' ? { action: 'list', input: { from: url.searchParams.get('from'), to: url.searchParams.get('to') } } : { action: 'snapshot', input: {} } : JSON.parse(body);
      if (url.pathname === '/api/team-invitations') {
        const result = await executeTeamCommand({ env, fetcher, token: `fixture-${key}`, command, verifier: { verify: async () => ({ subject: subjects[key], emails: [`${key}@example.test`] }) } });
        res.end(JSON.stringify(result)); return;
      }
      res.end(JSON.stringify(await (url.pathname === '/api/agenda' ? agenda : call)(key, command.action, command.input)));
    } catch (e) { res.statusCode = e.statusCode ?? (e.code === '42501' ? 403 : ['PT409', '40001', '23505'].includes(e.code) ? 409 : 400);
      res.end(JSON.stringify({ code: 'FIXTURE_REJECTED' })); }
  });
} }; }
