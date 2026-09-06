import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { fixtureApi } from './fixture-api.mjs';
export default defineConfig({plugins:[tailwind(),fixtureApi()],esbuild:{jsx:'automatic'},resolve:{alias:{react:fileURLToPath(new URL('./node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('./node_modules/react-dom',import.meta.url)),'lucide-react':fileURLToPath(new URL('./node_modules/lucide-react/dist/esm/lucide-react.js',import.meta.url))}},server:{fs:{allow:[fileURLToPath(new URL('../../',import.meta.url))]}}});
