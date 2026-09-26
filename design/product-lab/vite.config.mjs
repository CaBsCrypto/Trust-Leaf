import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  esbuild: { jsx: 'automatic' },
  plugins: [{ name: 'no-operational-api', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method ?? '')) {
        res.statusCode = 405; res.end('Local design prototype: no operational API'); return;
      }
      next();
    });
  } }],
  server: { host: '127.0.0.1', port: 4330, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
  build: { outDir: '../../scratch/product-lab-build', emptyOutDir: true },
});
