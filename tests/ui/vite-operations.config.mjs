import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { operationsFixture } from './operations-fixture.mjs';
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)), plugins: [tailwind(), operationsFixture()], esbuild: { jsx: 'automatic' },
  resolve: { alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name => [name,
    fileURLToPath(new URL(`./node_modules/${name}${name === 'lucide-react' ? '/dist/esm/lucide-react.js' : ''}`, import.meta.url))])) },
  server: { host: '127.0.0.1', port: 4321, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
});
