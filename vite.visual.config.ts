import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localWaitlists } from './src/dev/localWaitlists';
import { CANNABIS_WAITLIST_REVIEW_MODE } from './src/lib/waitlist';

export default defineConfig(({ mode }) => {
  const waitlistReview = mode === CANNABIS_WAITLIST_REVIEW_MODE;
  return {
    plugins: [react(), tailwindcss(), waitlistReview && localWaitlists()],
    envDir: waitlistReview ? false : undefined,
    cacheDir: waitlistReview ? '.vite-visual-cache/waitlist' : '.vite-visual-cache',
    server: {
      host: '127.0.0.1', port: waitlistReview ? 5210 : 5186, strictPort: true,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/scratch/cannabis-waitlists/**'] },
      watch: { ignored: ['**/node_modules.incomplete/**', '**/.vite-visual-cache/**', '**/scratch/cannabis-waitlists/**'] },
    },
    optimizeDeps: waitlistReview
      ? { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'lucide-react'] }
      : { entries: ['visual-preview.html'], include: ['react', 'react-dom/client', 'lucide-react', 'motion/react'] },
    resolve: { dedupe: ['react', 'react-dom'] },
    build: { outDir: 'dist-visual', rollupOptions: { input: 'visual-preview.html' } },
  };
});
