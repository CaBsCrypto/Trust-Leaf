import type { Plugin } from 'vite';
import { CANNABIS_WAITLIST_MAX_BODY_BYTES, registerCannabisWaitlist } from '../../api/_lib/cannabis-waitlist';
import { CANNABIS_WAITLIST_PATH } from '../lib/waitlist';
import { openLocalWaitlistStore } from './localWaitlistStore';

export function localWaitlists(): Plugin {
  let store: Awaited<ReturnType<typeof openLocalWaitlistStore>> | undefined;

  return {
    name: 'trustleaf-local-waitlists',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const path = (context.originalUrl ?? context.path).split('?')[0];
        return path === '/' || path === '/index.html'
          ? html.replace('/src/main.tsx', '/src/dev/WaitlistLanding.tsx')
          : html;
      },
    },
    async configureServer(server) {
      const activeStore = await openLocalWaitlistStore(server.config.root);
      store = activeStore;
      server.middlewares.use((req, res, next) => {
        if (req.url !== CANNABIS_WAITLIST_PATH) return next();
        const reply = (status: number, registered = false) => {
          res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' });
          res.end(JSON.stringify({ registered }));
        };

        if (req.method !== 'POST') return reply(405);
        const host = req.headers.host ?? '';
        if (!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host) || req.headers.origin !== `http://${host}`) return reply(403);
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') return reply(415);

        const chunks: Buffer[] = [];
        let bytes = 0;
        req.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes <= CANNABIS_WAITLIST_MAX_BODY_BYTES) chunks.push(chunk);
        });
        req.on('end', async () => {
          if (bytes > CANNABIS_WAITLIST_MAX_BODY_BYTES) return reply(413);
          try {
            await registerCannabisWaitlist({ body: Buffer.concat(chunks).toString('utf8'), save: activeStore.save });
            return reply(200, true);
          } catch (error) {
            return reply((error as { statusCode?: number }).statusCode === 400 ? 400 : 503);
          }
        });
      });
    },
    async closeBundle() {
      await store?.close();
      store = undefined;
    },
  };
}
