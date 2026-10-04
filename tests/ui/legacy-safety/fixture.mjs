import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { build, normalizePath } from 'vite';
import tailwind from '@tailwindcss/vite';
import postcss from 'postcss';

export const repository = fileURLToPath(new URL('../../../', import.meta.url));
export const root = fileURLToPath(new URL('./', import.meta.url));
export const notice = 'Lectura heredada no disponible. Usa el piloto conectado de Trust Leaf.';
export const retiredKeys = ['trust_patient_dashboard', 'trust_has_rx', 'trust_prescription_allowance',
  'trust_pickups', 'trust_privacy_permissions'];
export const privateMarker = 'FOREIGN_PRIVATE_RX_SENTINEL';
export const walletA = `G${'A'.repeat(55)}`;
export async function currentSourceHash() {
  return createHash('sha256').update(await readFile(new URL('../../../src/components/MockupPortal.tsx', import.meta.url))).digest('hex');
}
export function seed(cache, connected = true) {
  const foreign = `GFOREIGN${'Z'.repeat(48)}`;
  const dashboard = { patientAddress: foreign, network: 'TESTNET', rpcUrl: '', latestLedger: 1,
    latestLedgerClosedAt: new Date().toISOString(), registryContractId: 'SYNTHETIC_REGISTRY',
    prescriptionContractId: 'SYNTHETIC_PRESCRIPTION', summary: { total: 73, active: 73, used: 0, expired: 0 },
    prescriptions: [{ id: 700001, patient: foreign, doctor: foreign, medicationHash: privateMarker,
      expiresAt: Math.floor(Date.now() / 1000) + 86400, totalQuantity: 999, dispensedQuantity: 0,
      remainingQuantity: 999, isUsed: false, status: 'active', issuedAt: new Date().toISOString(), issuedLedger: 1, txHash: privateMarker }],
    dispenseRecords: [] };
  return { trust_wallet_setup: JSON.stringify({ primaryMethod: connected ? 'passkey' : null,
    hasFreighterBackup: false, walletLabel: 'Synthetic own wallet', contractAccount: walletA, networkLabel: 'Synthetic isolated network' }),
    trust_patient_dashboard: cache === 'malformed' ? `${privateMarker}{` : JSON.stringify(dashboard),
    trust_has_rx: 'true', trust_prescription_allowance: cache === 'malformed' ? '{' : JSON.stringify({ monthlyLimitGrams: 999, usedGrams: 0 }),
    trust_cart: '[]',
    trust_pickups: cache === 'malformed' ? '{' : JSON.stringify([{ id: 'synthetic-foreign-pickup', status: 'pending',
      dispensary: { name: privateMarker }, strain: { name: privateMarker }, token: privateMarker, expires: 'Synthetic expiry' }]),
    trust_privacy_permissions: cache === 'malformed' ? '{' : JSON.stringify([{ id: 'synthetic-foreign-permission',
      kind: 'dispensary-prescription', actor: privateMarker, role: 'Dispensario', scope: privateMarker,
      expiresAt: '30 min desde emision del QR', status: 'active', hash: privateMarker, qrToken: privateMarker,
      createdAt: new Date().toISOString(), patientName: privateMarker, patientWallet: foreign }]),
    trust_doctor_agenda_blocks: '[]',
    trust_consultation_clinical_records: '[]', trust_dispensary_inventory: '[]' };
}

export async function fixture(beforeFix, artifacts) {
  const portalPath = fileURLToPath(new URL('../../../src/components/MockupPortal.tsx', import.meta.url));
  // The baseline is loaded into memory only; neither the worktree nor Git is changed.
  const source = beforeFix ? execFileSync('git', ['show', '3243904:src/components/MockupPortal.tsx'],
    { cwd: repository, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }) : await readFile(portalPath, 'utf8');
  const css = postcss.parse(await readFile(new URL('../../../src/index.css', import.meta.url), 'utf8'));
  css.walkAtRules('import', rule => {
    if (rule.params.includes('https://fonts.googleapis.com/')) rule.remove();
    else if (/https?:/.test(rule.params)) throw new Error('UNEXPECTED_EXTERNAL_CSS_IMPORT');
    else if (rule.params === '"tailwindcss"') rule.params += ' source(none)';
  });
  for (const name of ['MockupPortal', 'WalletOnboarding', 'DispensaryDashboard', 'PrivyAgenda']) {
    css.append(postcss.atRule({ name: 'source', params: `"../../../src/components/${name}.tsx"` }));
  }
  const services = fileURLToPath(new URL('./services.mjs', import.meta.url));
  const servicePaths = [
    /^(?:\.\.\/lib\/|\.\/)(?:firebase|trustData|auditLogger)(?:\.ts)?$/,
    /^(?:\.\.\/lib\/stellar\/|\.\/)(?:config|freighter|passkeys|passkeyService|cryptoHelpers)(?:\.ts)?$/,
    /^firebase\/firestore$/,
  ];
  const output = await build({ configFile: false, envFile: false, envPrefix: [], root,
    cacheDir: `${artifacts}/vite-cache`, esbuild: { jsx: 'automatic' },
    plugins: [{ name: 'isolated-legacy-boundaries', enforce: 'pre', resolveId(id, importer) {
      if (importer && normalizePath(importer).startsWith(`${normalizePath(repository).replace(/\/$/, '')}/src/`)
        && servicePaths.some(pattern => pattern.test(id))) return services;
    }, load(id) {
      if (normalizePath(id) === normalizePath(fileURLToPath(new URL('./style.css', import.meta.url)))) return css.toString();
    }, transform(_code, id) {
      if (normalizePath(id.split('?')[0]) === normalizePath(portalPath)) return { code: source, map: null };
    } }, tailwind()],
    define: Object.fromEntries(['VITE_PRIVY_APP_ID', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_SUPABASE_ANON_KEY', 'VITE_STELLAR_RPC_URL', 'VITE_STELLAR_WALLET_WASM_HASH',
      'VITE_OPERATIONS_PILOT_ENABLED', 'VITE_COMMERCE_CATALOG_ENABLED', 'VITE_DISPENSARY_ONBOARDING_ENABLED']
      .map(name => [`import.meta.env.${name}`, JSON.stringify(name.endsWith('_ENABLED') ? 'false' : '')])),
    resolve: { dedupe: ['react', 'react-dom'], alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name =>
      [name, fileURLToPath(new URL(`../node_modules/${name}${name === 'lucide-react' ? '/dist/esm/lucide-react.js' : ''}`, import.meta.url))])) },
    build: { write: false, minify: false, sourcemap: false },
  });
  const unhandledApis = [];
  const files = new Map(output.output.map(item => [`/${item.fileName}`, item.type === 'chunk' ? item.code : item.source]));
  const httpServer = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/api/')) {
      unhandledApis.push({ method: req.method, path: pathname });
      res.statusCode = 451; res.end('ISOLATED_API_ONLY'); return;
    }
    const name = pathname === '/' ? '/index.html' : pathname;
    if (!['GET', 'HEAD'].includes(req.method) || !files.has(name)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css')
      ? 'text/css; charset=utf-8' : name.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(req.method === 'HEAD' ? undefined : files.get(name));
  });
  const server = { httpServer,
    listen: () => new Promise((resolve, reject) => {
      httpServer.once('error', reject); httpServer.listen(0, '127.0.0.1', resolve);
    }),
    close: () => new Promise((resolve, reject) => {
      if (!httpServer.listening) { resolve(); return; }
      httpServer.close(error => error ? reject(error) : resolve()); httpServer.closeAllConnections();
    }),
  };
  return { server, unhandledApis, sourceHash: createHash('sha256').update(source).digest('hex') };
}
