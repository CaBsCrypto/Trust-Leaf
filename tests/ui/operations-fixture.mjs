import { operationsDatabase } from '../sql/operations-db.mjs';

// Synthetic identity injection lives only in this loopback QA server, never in app code.
export function operationsFixture() { return { name: 'operations-sql-fixture', async configureServer(server) {
  const { db, subjects, call, agenda } = await operationsDatabase();
  server.httpServer?.once('close', () => void db.close());
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!['/api/agenda', '/api/operations-pilot'].includes(url.pathname)) return next();
    res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    const key = String(req.headers['privy-id-token'] ?? '').replace(/^fixture-/, '');
    if (!(key in subjects)) { res.statusCode = 401; res.end('{}'); return; }
    try {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 12000) throw new Error('request too large'); }
      const command = req.method === 'GET' ? url.pathname === '/api/agenda' ? { action: 'list', input: { from: url.searchParams.get('from'), to: url.searchParams.get('to') } } : { action: 'snapshot', input: {} } : JSON.parse(body);
      res.end(JSON.stringify(await (url.pathname === '/api/agenda' ? agenda : call)(key, command.action, command.input)));
    } catch (e) { res.statusCode = e.code === '42501' ? 403 : ['PT409', '40001', '23505'].includes(e.code) ? 409 : 400;
      res.end(JSON.stringify({ code: 'FIXTURE_REJECTED' })); }
  });
} }; }
