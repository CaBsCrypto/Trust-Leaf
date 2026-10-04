import { blockedTransports, lockSubprocesses } from './network-guard.mjs';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import tailwind from '@tailwindcss/vite';
import { createRuntime } from './runtime.mjs';

const apiPaths = new Set(['/api/agenda', '/api/operations-pilot', '/api/dispensary-commerce', '/api/team-invitations', '/api/dispensary-onboarding']);
const fail = (statusCode, code) => Object.assign(new Error(code), { statusCode, code });
export async function startDemo(port = 4331, runtimeFactory = createRuntime) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw fail(400, 'LOCAL_PORT_INVALID');
  const root = fileURLToPath(new URL('./', import.meta.url));
  const output = await build({ configFile: false, envFile: false, envPrefix: [], root, publicDir: false, logLevel: 'warn',
    plugins: [tailwind()], esbuild: { jsx: 'automatic' },
    define: Object.fromEntries(Object.entries({ VITE_OPERATIONS_PILOT_ENABLED: 'true', VITE_COMMERCE_CATALOG_ENABLED: 'true', VITE_DISPENSARY_ONBOARDING_ENABLED: 'true', MODE: 'local-demo', DEV: false, PROD: false })
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    resolve: { alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name => [name, fileURLToPath(new URL(`../ui/node_modules/${name}${name === 'lucide-react' ? '/dist/esm/lucide-react.js' : ''}`, import.meta.url))])) },
    build: { write: false, sourcemap: false, minify: false, rollupOptions: { plugins: [{ name: 'no-providers-in-demo', generateBundle() {
      for (const id of this.getModuleIds()) if (/node_modules\/(?:@privy-io|@supabase|firebase|@stellar|stellar-sdk|resend|@google)\//.test(id.replaceAll('\\', '/'))) throw new Error('LOCAL_PROVIDER_IMPORT_REJECTED');
    } }] } } });
  lockSubprocesses();
  const assets = new Map(output.output.map(item => ['/' + item.fileName, { body: item.type === 'chunk' ? item.code : item.source,
    type: item.fileName.endsWith('.js') ? 'text/javascript' : item.fileName.endsWith('.css') ? 'text/css' : 'text/html' }]));
  const bootstrap = randomBytes(32).toString('base64url');
  let runtime = await runtimeFactory(1), queue = Promise.resolve(), closing = false, admitting = true, origin;
  const serialize = task => { const result = queue.then(task); queue = result.catch(() => {}); return result; };
  function json(res, status, value) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Vary', 'privy-id-token, x-demo-generation');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (closing) throw fail(503, 'LOCAL_CLOSING');
      const hosts = req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'host');
      if (hosts.length !== 1 || req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin
        || ['cross-site', 'same-site'].includes(req.headers['sec-fetch-site'])) throw fail(403, 'LOCAL_ORIGIN_REJECTED');
      if (!req.url.startsWith('/') || req.url.startsWith('//') || /%|\\|\.\./.test(req.url.split('?')[0])) throw fail(404, 'LOCAL_NOT_FOUND');
      const url = new URL(req.url, origin), path = url.pathname;
      const document = path === '/' || path === '/dispensario';
      if (document || assets.has(path)) {
        if (req.method !== 'GET') throw fail(405, 'METHOD_NOT_ALLOWED');
        if (document && [...url.searchParams].some(([key, value]) => key !== 'actor' || !runtime.identities.some(id => id.key === value))) throw fail(400, 'LOCAL_INPUT_INVALID');
        const asset = assets.get(document ? '/index.html' : path);
        if (!asset) throw fail(404, 'LOCAL_NOT_FOUND');
        res.setHeader('Content-Type', asset.type); res.end(asset.body); return;
      }
      if (path === '/__local_demo/meta' && req.method === 'GET' && !url.search) {
        if (req.headers['x-demo-bootstrap'] !== bootstrap) throw fail(401, 'AUTH_REQUIRED');
        if (!admitting) throw fail(503, 'LOCAL_RESET_UNAVAILABLE');
        json(res, 200, runtime.metadata()); return;
      }
      if (!apiPaths.has(path) && !['/__local_demo/mail', '/__local_demo/reset', '/__local_demo/health'].includes(path)) throw fail(404, 'LOCAL_NOT_FOUND');
      if (!['GET', 'POST'].includes(req.method)) throw fail(405, 'METHOD_NOT_ALLOWED');
      if (req.method === 'POST' && req.headers.origin !== origin) throw fail(403, 'LOCAL_ORIGIN_REJECTED');
      const admitted = runtime;
      if (!admitting || !admitted.access || req.headers['x-demo-access'] !== admitted.access || req.headers['x-demo-generation'] !== String(admitted.generation)) throw fail(409, 'LOCAL_CONTEXT_EXPIRED');
      let body = '';
      if (req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw fail(400, 'LOCAL_INPUT_INVALID');
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 12000) throw fail(413, 'LOCAL_INPUT_TOO_LARGE'); chunks.push(chunk); }
        body = Buffer.concat(chunks).toString('utf8');
      }
      await serialize(async () => {
        if (!admitting || admitted !== runtime || closing) throw fail(409, 'LOCAL_CONTEXT_EXPIRED');
        if (path.startsWith('/__local_demo/')) {
          if (url.search) throw fail(400, 'LOCAL_INPUT_INVALID');
          if (path === '/__local_demo/mail' && req.method === 'GET') { json(res, 200, runtime.mail); return; }
          if (path === '/__local_demo/health' && req.method === 'GET') { json(res, 200, { generation: runtime.generation, blockedTransports: [...blockedTransports] }); return; }
          if (path !== '/__local_demo/reset' || req.method !== 'POST' || body !== '{}') throw fail(405, 'METHOD_NOT_ALLOWED');
          // Remove admission before replacing the SQL instance; old commands cannot enter the new one.
          admitting = false; const next = await runtimeFactory(admitted.generation + 1);
          runtime = next; await admitted.close(); admitting = true; json(res, 200, next.metadata()); return;
        }
        const token = req.headers['privy-id-token'];
        if (typeof token !== 'string' || !runtime.identities.some(id => id.token === token)) throw fail(401, 'AUTH_REQUIRED');
        let command;
        if (req.method === 'POST') {
          if (url.search) throw fail(400, 'LOCAL_INPUT_INVALID');
          try { command = JSON.parse(body); } catch { throw fail(400, 'LOCAL_INPUT_INVALID'); }
          if (path === '/api/operations-pilot' && command?.action === 'snapshot') throw fail(400, 'PILOT_INPUT_INVALID');
        } else {
          const allowed = path === '/api/agenda' ? ['from', 'to', 'selectedBookingRef'] : path === '/api/dispensary-commerce' ? ['collection', 'limit', 'offset', 'batchRef'] : [];
          if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) throw fail(400, 'LOCAL_INPUT_INVALID');
          command = path === '/api/agenda' ? { action: 'list', input: Object.fromEntries(url.searchParams) }
            : path === '/api/dispensary-commerce' ? { action: url.searchParams.get('collection'), input: { limit: Number(url.searchParams.get('limit') ?? 25), offset: Number(url.searchParams.get('offset') ?? 0), ...(url.searchParams.has('batchRef') ? { batchRef: url.searchParams.get('batchRef') } : {}) } }
            : { action: ['/api/team-invitations', '/api/dispensary-onboarding'].includes(path) ? 'list' : 'snapshot', input: {} };
        }
        json(res, 200, await admitted.dispatch(path, token, command));
      });
    } catch (error) {
      const status = [400,401,403,404,405,409,413,429].includes(error?.statusCode) ? error.statusCode : 503;
      const code = ['AUTH_REQUIRED', 'METHOD_NOT_ALLOWED', 'LOCAL_CONTEXT_EXPIRED', 'LOCAL_ORIGIN_REJECTED', 'LOCAL_NOT_FOUND', 'LOCAL_INPUT_INVALID', 'LOCAL_INPUT_TOO_LARGE', 'PILOT_INPUT_INVALID'].includes(error?.code) ? error.code : 'LOCAL_SERVICE_UNAVAILABLE';
      if (!res.headersSent) json(res, status, { code }); else res.destroy();
    }
  });
  server.on('upgrade', (_, socket) => socket.destroy());
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
  catch (error) { await runtime.close(); throw error; }
  origin = `http://127.0.0.1:${server.address().port}`;
  async function close() { if (closing) return; closing = true; await queue; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await runtime.close(); }
  return { origin, url: origin + '/#demo-access=' + bootstrap, close };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await startDemo(Number(process.argv[2] ?? 4331));
  console.log(`LOCAL_DEMO_READY ${demo.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await demo.close(); process.exit(0); });
  process.on('message', async message => { if (message === 'close') { await demo.close(); process.exit(0); } });
}
