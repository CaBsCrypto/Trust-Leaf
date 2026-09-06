import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// HTTP is intercepted by browser tests: no SQL plugin or draft migrations.
export default defineConfig({
  plugins: [tailwind()], esbuild: { jsx: 'automatic' },
  resolve: { alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name =>
    [name, fileURLToPath(new URL(`./node_modules/${name}${name === 'lucide-react' ? '/dist/esm/lucide-react.js' : ''}`, import.meta.url))])) },
  server: { host: '127.0.0.1', port: 4318, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
});
