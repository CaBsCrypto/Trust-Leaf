import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import tailwind from '@tailwindcss/vite';
import { navigateSection } from './workspace-navigation.mjs';

// Default: future guard contract (expected to fail until inventory guards land).
// --baseline: characterize the pre-guard losses without treating them as fixes.
// No database, real identity, external API, or existing server is used.
const baseline = process.argv.includes('--baseline');
const beforeFix = process.argv.includes('--before-fix');
assert.ok(process.argv.slice(2).every(arg => ['--baseline', '--before-fix'].includes(arg)), 'Supported options: --baseline, --before-fix');
const historicalWorkspace = beforeFix ? execFileSync('git', ['show', 'ab2f4b3:src/features/operations/OperationsWorkspace.tsx'], {
  cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8',
}) : null;
const artifacts = fileURLToPath(new URL('../../scratch/inventory-draft-guard/', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:4342';
const root = fileURLToPath(new URL('./', import.meta.url));
const server = await createServer({
  configFile: false, envFile: false, root,
  cacheDir: fileURLToPath(new URL('../../scratch/inventory-draft-guard/vite-cache', import.meta.url)),
  plugins: [tailwind(), {
    name: 'inventory-signout-probe',
    enforce: 'pre',
    transform(code, id) {
      if (historicalWorkspace && id.split('?')[0].replaceAll('\\', '/').endsWith('/src/features/operations/OperationsWorkspace.tsx')) return historicalWorkspace;
      if (id.split('?')[0].replaceAll('\\', '/').endsWith('/tests/ui/main.tsx')) {
        const target = '<OperationsWorkspace email={`${actor}@example.test`}/>';
        assert.ok(code.includes(target), 'Fixture mount changed; update sign-out probe explicitly');
        return code.replace(target, '<OperationsWorkspace email={`${actor}@example.test`} onSignOut={() => window.dispatchEvent(new Event("inventory-test-signout"))}/>');
      }
    },
  }], esbuild: { jsx: 'automatic' },
  define: { 'import.meta.env.VITE_COMMERCE_CATALOG_ENABLED': JSON.stringify('false') },
  resolve: { alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name => [name,
    fileURLToPath(new URL(`./node_modules/${name}${name === 'lucide-react' ? '/dist/esm/lucide-react.js' : ''}`, import.meta.url))])) },
  server: { host: '127.0.0.1', port: 4342, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
});
let browser;
try {
  await server.listen();
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  for (const width of [360, 390, 768, 1024, 1440]) for (const role of ['manager', 'operator']) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.inventorySignouts = 0;
    window.addEventListener('inventory-test-signout', () => window.inventorySignouts++);
  });
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });
  page.setDefaultTimeout(15000);
  const errors = [], unexpected = [], posts = [], journal = new Map();
  let uncertain = false, movements = 0, authLost = false;
  let organizationRef = 'synthetic-org', membershipRole = role;
  const batch = { batch_ref: 'synthetic-batch-a', organization_ref: 'synthetic-org', lot_code: 'SYNTHETIC-A',
    product: 'Synthetic flower', source_reference: 'SYNTHETIC ONLY', stock_mg: 60000,
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(), state: 'active', version: 1 };
  const snapshot = () => ({ synthetic: true, joined: true, role: 'dispensary', actorRef: 'synthetic-manager',
    membership: { organization_ref: organizationRef, actor_ref: `synthetic-${role}`, role: membershipRole },
    organizations: [{ organization_ref: organizationRef, name: 'Synthetic inventory QA' }],
    batches: [organizationRef === 'synthetic-org' ? batch : { ...batch, organization_ref: organizationRef, batch_ref: 'synthetic-batch-b', lot_code: 'SYNTHETIC-B' }], deliveries: [], movements: [] });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async event => {
    if (event.type() !== 'beforeunload') unexpected.push(`native dialog: ${event.type()}`);
    await event.accept();
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { unexpected.push(request.url()); return route.abort(); }
    if (url.pathname === '/api/operations-pilot') {
      if (request.method() === 'GET') return route.fulfill({ status: authLost ? 401 : 200, json: authLost ? {} : snapshot() });
      const command = request.postDataJSON(); posts.push(command);
      assert.equal(membershipRole, 'manager', 'operator cannot mutate inventory');
      assert.ok(['adjust-stock', 'receive-batch', 'set-batch-state'].includes(command.action));
      const { operationId, resourceRef, version, quantityMg } = command.input;
      const prior = journal.get(operationId);
      if (prior) {
        assert.deepEqual(command, prior.command, 'retry preserves the entire intent');
        return route.fulfill({ json: { resourceRef, synthetic: true, replayed: true } });
      }
      if (['adjust-stock', 'set-batch-state'].includes(command.action)) {
        assert.equal(resourceRef, batch.batch_ref);
        if (version !== batch.version) return route.fulfill({ status: 409, json: { code: 'PILOT_CONFLICT' } });
        if (command.action === 'adjust-stock') batch.stock_mg += quantityMg;
        else batch.state = command.input.state;
        batch.version++;
      }
      movements++;
      journal.set(operationId, { command });
      if (uncertain) { uncertain = false; return route.fulfill({ status: 503, json: {} }); }
      return route.fulfill({ json: { resourceRef, synthetic: true, replayed: false } });
    }
    if (url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  const inventory = () => navigateSection(page, 'Inventario');
  const receipt = page.getByLabel('Codigo de lote', { exact: true });
  const delta = page.getByLabel('Variacion en gramos (+/-)', { exact: true });
  const reason = page.getByLabel('Motivo del ajuste', { exact: true });
  const dialog = page.getByRole('dialog', { name: 'Descartar cambios sin guardar' });
  const retry = page.getByRole('button', { name: 'Reintentar operacion', exact: true });
  const saveAdjustment = page.getByRole('button', { name: 'Registrar ajuste', exact: true });
  const readResponse = () => page.waitForResponse(response => response.url() === `${base}/api/operations-pilot` && response.request().method() === 'GET');
  async function assertLeaveWarning(expected) {
    // React's effect cleanup may follow the DOM update that hides the retry button.
    const settled = await page.waitForFunction(expected => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented === expected;
    }, expected, { timeout: 15000, polling: 'raf' });
    assert.equal(await settled.jsonValue(), true, 'native beforeunload guard follows dirty/uncertain state');
    await settled.dispose();
  }
  async function refresh() {
    const response = readResponse();
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await response;
  }
  async function assertLayout(target = page.locator('.op-dispensary')) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
    const box = await target.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `target fits viewport ${width}`);
  }
  async function cancelDiscard() {
    await dialog.waitFor(); await assertLayout(dialog);
    if ([390, 1440].includes(width)) await page.screenshot({ path: `${artifacts}/dialog-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Seguir editando', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  async function openReceipt() {
    if (!await receipt.isVisible()) await page.getByText('Recibir lote', { exact: true }).click();
  }
  async function openAdjustment() {
    const manage = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: 'Gestionar lote' }) });
    if (!await manage.evaluate(el => el.open)) await page.getByText('Gestionar lote', { exact: true }).click();
    if (!await delta.isVisible()) await page.getByText('Ajustar existencias', { exact: true }).click();
  }
  async function fillAdjustment() { await openAdjustment(); await delta.fill('2'); await reason.fill('Synthetic correction'); }
  await page.goto(`${base}/?operations&role=dispensary`);
  await inventory(); await assertLayout();
  if (role === 'operator') {
    assert.equal(await page.getByText('Recibir lote', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Gestionar lote', { exact: true }).count(), 0);
    assert.equal(await saveAdjustment.count(), 0);
    await page.getByRole('searchbox').fill('SYNTHETIC-A');
    await navigateSection(page, 'Historial');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(posts.length, 0); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log(`PASS operator controls ${width}`);
    await context.close(); continue;
  }
  await inventory(); await openReceipt(); await receipt.fill('UNSAVED-RECEIPT'); await fillAdjustment();
  if (!baseline) {
    await assertLeaveWarning(true);
    await navigateSection(page, 'Historial'); await cancelDiscard();
    assert.equal(await receipt.inputValue(), 'UNSAVED-RECEIPT'); assert.equal(await delta.inputValue(), '2');
    await navigateSection(page, 'Historial'); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await delta.inputValue(), '2');
    await page.getByRole('button', { name: 'Cerrar sesion', exact: true }).click(); await cancelDiscard();
    assert.equal(await page.evaluate(() => window.inventorySignouts), 0);
    await page.getByRole('button', { name: 'Cerrar sesion', exact: true }).click();
    await dialog.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    await page.waitForFunction(() => window.inventorySignouts === 1);
    // The probe deliberately does not unmount; start a fresh session after accepted sign-out.
    await page.reload(); await inventory(); await openReceipt(); await receipt.fill('UNSAVED-RECEIPT'); await fillAdjustment();
    await navigateSection(page, 'Historial');
    await dialog.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    await page.getByLabel('Lote del historial').waitFor();
  } else {
    await navigateSection(page, 'Historial');
  }
  await inventory(); await openReceipt(); await openAdjustment();
  assert.equal(await receipt.inputValue(), '', 'baseline: navigation loses receipt draft');
  assert.equal(await delta.inputValue(), '', 'baseline: navigation loses adjustment draft');
  assert.equal(await reason.inputValue(), '');
  if (!baseline) await assertLeaveWarning(false);
  assert.equal(posts.length, 0);
  console.log(baseline ? 'REPRO navigation: receipt and adjustment drafts lost; no POST' : 'PASS section/signout confirm, cancel, Escape and discard; no POST');

  await receipt.fill('RECEIPT-CONTROL'); await fillAdjustment();
  await page.getByRole('searchbox').fill('no-such-synthetic-lot');
  assert.equal(await delta.count(), 0);
  await page.getByRole('searchbox').fill(''); await openAdjustment();
  assert.equal(await delta.inputValue(), baseline ? '' : '2'); assert.equal(await reason.inputValue(), baseline ? '' : 'Synthetic correction');
  assert.equal(await receipt.inputValue(), 'RECEIPT-CONTROL');
  await fillAdjustment(); await page.getByRole('button', { name: 'Bloqueados', exact: true }).click();
  assert.equal(await delta.count(), 0);
  await page.getByRole('button', { name: 'Todos', exact: true }).click(); await openAdjustment();
  assert.equal(await delta.inputValue(), baseline ? '' : '2'); assert.equal(await reason.inputValue(), baseline ? '' : 'Synthetic correction');
  assert.equal(posts.length, 0);
  console.log(baseline ? 'REPRO filtering: search and status filters lose adjustment draft; receipt retained' : 'PASS filter-hidden draft retention');

  await fillAdjustment();
  await page.getByText('Ajustar existencias', { exact: true }).click();
  assert.equal(await delta.isVisible(), false);
  await openAdjustment(); assert.equal(await delta.inputValue(), '2');
  await page.getByText('Recibir lote', { exact: true }).click();
  assert.equal(await receipt.isVisible(), false);
  await openReceipt(); assert.equal(await receipt.inputValue(), 'RECEIPT-CONTROL');
  const refreshRead = page.waitForResponse(response => response.url() === `${base}/api/operations-pilot` && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await refreshRead;
  assert.equal(await delta.inputValue(), '2');
  const successRead = page.waitForResponse(response => response.url() === `${base}/api/operations-pilot` && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Registrar ajuste', exact: true }).click();
  await page.getByText('Cambio guardado.', { exact: true }).waitFor();
  await successRead;
  assert.equal(await delta.inputValue(), baseline ? '2' : '', 'successful adjustment resets only in guard mode');
  assert.equal(await reason.inputValue(), baseline ? 'Synthetic correction' : '');
  assert.equal(await receipt.inputValue(), 'RECEIPT-CONTROL', 'other draft must not reset');
  assert.equal(movements, 1);
  console.log(baseline ? 'REPRO success reset: submitted adjustment remains populated' : 'PASS success resets submitted adjustment only');

  uncertain = true;
  await delta.fill('3'); await reason.fill('Synthetic uncertain correction');
  await page.getByRole('button', { name: 'Registrar ajuste', exact: true }).click();
  await retry.waitFor();
  if (!baseline) {
    await assertLeaveWarning(true);
    await navigateSection(page, 'Historial');
    assert.equal(await page.getByRole('tab', { name: 'Inventario', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await dialog.isVisible(), false, 'uncertain writes block navigation without discard');
  }
  assert.equal(await page.getByRole('button', { name: 'Registrar ajuste', exact: true }).isDisabled(), true);
  await retry.click(); await retry.waitFor({ state: 'hidden' });
  await page.getByText('Cambio guardado.', { exact: true }).waitFor();
  assert.equal(posts.length, 3);
  assert.deepEqual(posts[1], posts[2]);
  assert.notEqual(posts[0].input.operationId, posts[1].input.operationId);
  assert.equal(movements, 2, 'uncertain retry must not add another synthetic movement');
  if (!baseline) {
    assert.equal(await delta.inputValue(), '');
    // Receipt success clears receive, not the separate batch draft.
    await fillAdjustment();
    await page.getByLabel('Referencia de origen', { exact: true }).fill('SYNTHETIC-ORIGIN');
    await page.getByLabel('Vencimiento', { exact: true }).fill('2099-01-01T12:00');
    const received = readResponse();
    await page.getByRole('button', { name: 'Recibir lote simulado', exact: true }).click();
    await received; await page.getByText('Cambio guardado.', { exact: true }).waitFor();
    assert.equal(await receipt.inputValue(), ''); assert.equal(await delta.inputValue(), '2');
    assert.equal(await reason.inputValue(), 'Synthetic correction');
    assert.equal(await page.getByLabel('Producto', { exact: true }).inputValue(), 'Flor de prueba');
    assert.equal(await page.getByLabel('Cantidad en gramos', { exact: true }).inputValue(), '100');
    assert.equal(await page.getByLabel('Referencia de origen', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('Vencimiento', { exact: true }).inputValue(), '');

    // Preserve the draft's base version instead of silently rebasing on refresh.
    const baseVersion = batch.version;
    batch.version++; await refresh();
    await page.getByRole('searchbox').fill('missing'); await page.getByRole('searchbox').fill(''); await openAdjustment();
    const conflict = page.waitForResponse(response => response.request().method() === 'POST' && response.status() === 409);
    await saveAdjustment.click(); await conflict;
    assert.equal(posts.at(-1).input.version, baseVersion);
    assert.equal(await delta.inputValue(), '2'); assert.equal(await reason.inputValue(), 'Synthetic correction');
    assert.equal(await retry.isVisible(), false);
    const rejectedCommand = structuredClone(posts.at(-1));
    const rebase = page.getByRole('button', { name: 'Usar existencias actuales y conservar ajuste', exact: true });
    await rebase.waitFor();
    const beforeRebase = posts.length;
    await rebase.click();
    assert.equal(posts.length, beforeRebase, 'explicit rebase does not submit');
    assert.equal(await delta.inputValue(), '2'); assert.equal(await reason.inputValue(), 'Synthetic correction');
    const rebasedRead = readResponse();
    await saveAdjustment.click(); await rebasedRead;
    await page.getByText('Cambio guardado.', { exact: true }).waitFor();
    assert.equal(posts.at(-1).input.version, baseVersion + 1);
    assert.notEqual(posts.at(-1).input.operationId, rejectedCommand.input.operationId);
    assert.equal(await delta.inputValue(), ''); assert.equal(await reason.inputValue(), '');
    await assertLeaveWarning(false);

    // Fresh same-actor session, then lose read authorization after an uncertain commit.
    await page.reload(); await inventory(); await fillAdjustment();
    uncertain = true; await saveAdjustment.click(); await retry.waitFor();
    const uncertainCommand = structuredClone(posts.at(-1)), committedMovements = movements;
    authLost = true; await refresh();
    await page.getByRole('tab', { name: 'Inventario', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await delta.count(), 0); assert.equal(await receipt.count(), 0);
    assert.equal(await retry.isVisible(), false, 'pending intent must be hidden during auth loss');
    assert.equal(await page.getByText('Synthetic correction', { exact: true }).count(), 0);
    await assertLeaveWarning(true);
    authLost = false; await refresh(); await inventory(); await openAdjustment();
    assert.equal(await delta.inputValue(), '', 'auth loss clears visible draft values');
    assert.equal(await reason.inputValue(), '');
    await retry.waitFor(); await retry.click(); await retry.waitFor({ state: 'hidden' });
    assert.deepEqual(posts.at(-1), uncertainCommand, 'same-actor recovery retains hidden pending intent and ID');
    assert.equal(movements, committedMovements);
    await assertLeaveWarning(false);
    console.log('PASS receipt defaults, explicit conflict rebase, native leave warning, auth-loss clearing and hidden retry recovery');

    // Membership updates must invalidate both draft values and an already-open discard dialog.
    await openReceipt(); await receipt.fill('SCOPE-PRIVATE'); await fillAdjustment();
    await navigateSection(page, 'Historial'); await dialog.waitFor();
    organizationRef = 'synthetic-org-b';
    const scopeRead = readResponse();
    await page.evaluate(() => window.dispatchEvent(new Event('online'))); await scopeRead;
    await dialog.waitFor({ state: 'hidden' });
    await openReceipt(); await openAdjustment();
    assert.equal(await receipt.inputValue(), ''); assert.equal(await delta.inputValue(), '');
    await assertLeaveWarning(false);
    organizationRef = 'synthetic-org'; await refresh(); await openAdjustment();
    assert.equal(await delta.inputValue(), '', 'returning to prior scope cannot resurrect discarded drafts');

    await fillAdjustment(); uncertain = true;
    await saveAdjustment.click(); await retry.waitFor();
    const scopedCommand = structuredClone(posts.at(-1)), scopedMovements = movements, scopedPosts = posts.length;
    const priorAccess = page.getByRole('alert').filter({ hasText: 'La operacion pendiente pertenece al acceso anterior.' });
    organizationRef = 'synthetic-org-b'; await refresh(); await priorAccess.waitFor();
    assert.equal(await retry.isVisible(), false); await assertLeaveWarning(true);
    await openReceipt(); await openAdjustment();
    assert.equal(await receipt.inputValue(), ''); assert.equal(await delta.inputValue(), '');
    assert.equal(await saveAdjustment.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Recibir lote simulado', exact: true }).isDisabled(), true);
    // Force form submission too: disabled controls alone must not be the command guard.
    await page.locator('form').filter({ has: receipt }).evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(posts.length, scopedPosts, 'organization swap sends no new POST');

    organizationRef = 'synthetic-org'; membershipRole = 'operator';
    await refresh(); await priorAccess.waitFor();
    assert.equal(await retry.isVisible(), false);
    assert.equal(await receipt.count(), 0); assert.equal(await delta.count(), 0);
    assert.equal(posts.length, scopedPosts); await assertLeaveWarning(true);
    membershipRole = 'manager'; await refresh(); await retry.waitFor();
    await openReceipt(); await openAdjustment();
    assert.equal(await receipt.inputValue(), ''); assert.equal(await delta.inputValue(), '');
    await retry.click(); await retry.waitFor({ state: 'hidden' });
    assert.deepEqual(posts.at(-1), scopedCommand, 'original organization/manager access retries the exact pending intent');
    assert.equal(posts.length, scopedPosts + 1); assert.equal(movements, scopedMovements);
    await assertLeaveWarning(false);
    console.log('PASS scope change clears dialog/drafts; org swap and demotion block writes; original access recovers exact ID');

    // An uncertain state change must block leaving before any dirty-draft discard.
    await fillAdjustment();
    uncertain = true;
    await page.getByRole('button', { name: 'Poner en cuarentena', exact: true }).click();
    await retry.waitFor();
    const stateCommand = structuredClone(posts.at(-1)), statePosts = posts.length, stateMovements = movements;
    assert.equal(stateCommand.action, 'set-batch-state');
    await navigateSection(page, 'Historial');
    assert.equal(await dialog.isVisible(), false, 'pending state change blocks navigation before offering discard');
    assert.equal(await page.getByRole('tab', { name: 'Inventario', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await delta.inputValue(), '2');
    assert.equal(await reason.inputValue(), 'Synthetic correction');
    await assertLeaveWarning(true);
    await page.locator('form').filter({ has: delta }).evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await refresh();
    assert.equal(posts.length, statePosts, 'pending state ID blocks a new adjustment command even on forced submit');
    assert.equal(await delta.inputValue(), '2');
    if ([390, 1440].includes(width)) await page.screenshot({ path: `${artifacts}/state-pending-${width}.png`, fullPage: true });

    membershipRole = 'operator'; await refresh(); await priorAccess.waitFor();
    assert.equal(await retry.isVisible(), false, 'operator cannot retry pending set-batch-state');
    assert.equal(await delta.count(), 0);
    assert.equal(await page.getByText('Gestionar lote', { exact: true }).count(), 0);
    assert.equal(posts.length, statePosts);
    await assertLeaveWarning(true);
    if ([390, 1440].includes(width)) await page.screenshot({ path: `${artifacts}/state-demoted-${width}.png`, fullPage: true });
    membershipRole = 'manager'; await refresh(); await retry.waitFor();
    await openAdjustment(); assert.equal(await delta.inputValue(), '');
    assert.equal(await reason.inputValue(), '');
    await openReceipt(); assert.equal(await receipt.inputValue(), '');
    await assertLeaveWarning(true);
    await retry.click(); await retry.waitFor({ state: 'hidden' });
    assert.deepEqual(posts.at(-1), stateCommand, 'restored manager retries exact state-change intent and ID');
    assert.equal(posts.length, statePosts + 1);
    assert.equal(movements, stateMovements, 'state-change retry does not duplicate a committed movement');
    await assertLeaveWarning(false);
    console.log('PASS pending set-batch-state preserves draft on blocked navigation, blocks new commands, and forbids operator retry');

    // Isolate pending state from dirty drafts: it alone must install the leave guard.
    await page.reload(); await inventory(); await openReceipt(); await openAdjustment();
    assert.equal(await receipt.inputValue(), '');
    assert.equal(await delta.inputValue(), ''); assert.equal(await reason.inputValue(), '');
    await assertLeaveWarning(false);
    uncertain = true;
    await page.getByRole('button', { name: 'Liberar cuarentena', exact: true }).click();
    await retry.waitFor();
    const cleanStateCommand = structuredClone(posts.at(-1)), cleanStateMovements = movements;
    assert.equal(cleanStateCommand.action, 'set-batch-state');
    assert.equal(await receipt.inputValue(), '');
    assert.equal(await delta.inputValue(), ''); assert.equal(await reason.inputValue(), '');
    await assertLeaveWarning(true);
    await retry.click(); await retry.waitFor({ state: 'hidden' });
    assert.deepEqual(posts.at(-1), cleanStateCommand);
    assert.equal(movements, cleanStateMovements);
    await assertLeaveWarning(false);
    console.log('PASS pending set-batch-state alone warns beforeunload without drafts; successful retry removes warning');
  }
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  if ([390, 1440].includes(width)) await page.screenshot({ path: `${artifacts}/inventory-${width}.png`, fullPage: true });
  console.log('PASS uncertain retry: identical operationId/payload, one movement for the uncertain operation');
  console.log(`PASS ${baseline ? 'baseline characterization' : 'guard regression'} manager ${width}: ${posts.length} intercepted POSTs, ${movements} synthetic movements, no external requests`);
  await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
  console.log('Stopped owned fixture server on 127.0.0.1:4342');
}
