import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      // Raise the warning threshold — we've already split the bundles below.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Stellar SDK — largest single dependency (~1MB, unavoidable crypto)
            if (
              id.includes('@stellar/stellar-sdk') ||
              id.includes('node_modules/stellar-sdk') ||
              id.includes('stellar-base')
            ) {
              return 'stellar';
            }
            // Firebase — lazy split since we async-import Firestore everywhere
            if (id.includes('node_modules/firebase')) {
              return 'firebase';
            }
            // PDF generation tools — already dynamic-imported via await import()
            if (
              id.includes('node_modules/jspdf') ||
              id.includes('node_modules/html2canvas') ||
              id.includes('node_modules/qrcode')
            ) {
              return 'pdf-tools';
            }
          },
        },
      },
    },
  };
});
