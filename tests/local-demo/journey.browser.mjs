import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const localDemoURL = process.env.LOCAL_DEMO_URL;
assert.equal(typeof localDemoURL, 'string', 'Set LOCAL_DEMO_URL to the complete startup URL, including its bootstrap fragment.');
let entry;
try { entry = new URL(localDemoURL); } catch { throw new Error('LOCAL_DEMO_URL must be a valid loopback startup URL.'); }
const base = entry.origin;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base) && !entry.username && !entry.password
  && entry.pathname === '/' && !entry.search, 'Only an explicit IPv4 loopback origin with a bootstrap fragment is allowed.');
assert.ok(Number(entry.port) > 0 && Number(entry.port) <= 65535);
const bootstrapMatch = /^#demo-access=([A-Za-z0-9_-]{43})$/.exec(entry.hash);
assert.ok(bootstrapMatch, 'LOCAL_DEMO_URL requires one 43-character demo-access capability in its fragment.');
const bootstrap = bootstrapMatch[1];
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = new URL('../../scratch/local-demo/journey/', import.meta.url);
const keys = ['admin', 'doctor', 'patient', 'newManager', 'newWorker'];
const widths = [360, 390, 768, 1024, 1440];
const orgName = 'Dispensario local QA';
const patientName = 'Paciente sintetico QA';
const productName = 'Flor sintetica local QA';
const lotCode = 'LOCAL-QA-001';
const note = 'NOTA SINTETICA QA: consulta local, sin datos reales.';
const commercialReceipts = '/api/dispensary-commerce?collection=receipts&limit=25&offset=0';
const report = { status: 'RUNNING', origin: base, stages: [], screenshots: [], qaReads: [],
  externalAttempts: [], unexpectedRequests: [], headerViolations: [], httpErrors: [],
  pageErrors: [], consoleErrors: [], requestFailures: [], expectedRequestFailures: [], expectedConsoleErrors: [],
  uncertainRetries: [], posts: [], cleanup: { contextClosed: false, browserClosed: false },
  limits: ['Uses an already-running SQL-backed synthetic server; never starts or resets it.',
    'No provider, production, reset, cross-tab, or negative transport scenario is exercised here.',
    'Responsive captures cover manager inventory and worker receipts at five widths.'] };
let browser, context, page, metadata, identities, actor = 'admin', failure, closing = false;
const lostResponses = new Map(), injectedRequests = new Map();
function redact(value) {
  let text = String(value);
  for (const capability of [bootstrap, metadata?.access, ...(metadata?.identities ?? []).map(id => id.token)])
    if (typeof capability === 'string' && capability) text = text.replaceAll(capability, '[redacted]');
  return text;
}
const apiPaths = new Set(['/api/operations-pilot', '/api/dispensary-onboarding',
  '/api/team-invitations', '/api/dispensary-commerce', '/api/agenda']);
const actions = {
  '/api/operations-pilot': { doctor: ['join', 'start-encounter', 'save-note', 'complete-encounter'],
    patient: ['join', 'save-profile', 'grant'], newManager: ['join'], newWorker: ['join', 'dispense'] },
  '/api/dispensary-onboarding': { admin: ['list', 'invite', 'review'],
    newManager: ['inspect', 'read-draft', 'accept', 'save-draft', 'submit'] },
  '/api/team-invitations': { newManager: ['list', 'create'], newWorker: ['inspect', 'accept', 'list'] },
  '/api/dispensary-commerce': { newManager: ['save-supplier', 'save-product', 'receive'] },
  '/api/agenda': { doctor: ['publish'], patient: ['reserve'] },
};
const readPosts = new Set(['list', 'inspect', 'read-draft']);
const button = (name, root = page) => root.getByRole('button', { name, exact: true });
const actorSelect = () => page.locator('.local-toolbar').getByLabel('Actor de demostracion');
const form = name => page.locator('form').filter({ has: button(name) });
const pathOf = url => new URL(url).pathname;
const payload = request => { try { return request.postDataJSON(); } catch { return null; } };
function headers(key) {
  return { 'x-demo-access': metadata.access, 'x-demo-generation': String(metadata.generation),
    'privy-id-token': identities.get(key).token };
}
async function read(path, key = actor) {
  assert.ok(['/api/operations-pilot', '/__local_demo/health', commercialReceipts].includes(path), 'QA reads use an explicit GET allowlist.');
  const response = await context.request.get(`${base}${path}`, { headers: headers(key), maxRedirects: 0 });
  assert.equal(response.status(), 200, `QA GET ${path} (${key})`);
  const value = await response.json();
  if (path.startsWith('/api/')) assert.equal(value.synthetic, true);
  report.qaReads.push({ path, actor: key });
  return value;
}
async function deniedSnapshot(key) {
  const path = '/api/operations-pilot';
  const response = await context.request.get(`${base}${path}`, { headers: headers(key), maxRedirects: 0 });
  assert.equal(response.status(), 403, `${key} has no approved operational actor yet`);
  report.qaReads.push({ path, actor: key, expectedStatus: 403 });
}
async function stage(name, run) {
  const entry = { name, status: 'RUNNING' }; report.stages.push(entry);
  console.log(`STAGE ${name}`);
  try { await run(); entry.status = 'PASS'; } catch (error) { entry.status = 'FAIL'; throw error; }
}
async function settle() {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function account(key) {
  await page.locator('.local-account').waitFor();
  await page.waitForFunction(email => document.querySelector('.local-account')?.firstChild?.textContent === email, identities.get(key).email);
}
async function switchActor(key) {
  assert.ok(identities.has(key));
  const select = actorSelect();
  actor = key;
  await select.selectOption(key);
  await page.waitForFunction(expected => document.querySelector('.local-toolbar select')?.value === expected, key);
  await account(key);
  await settle();
}
async function retainedActor(key) {
  await page.waitForFunction(expected => document.querySelector('.local-toolbar select')?.value === expected, key);
  await account(key);
  assert.equal(actor, key, 'a rejected actor transition does not change the test authentication context');
}
async function cancelActorChange(next) {
  const previous = actor, postCount = report.posts.length;
  assert.notEqual(next, previous);
  await actorSelect().selectOption(next);
  const dialog = page.getByRole('dialog', { name: 'Descartar cambios sin guardar', exact: true });
  await dialog.waitFor(); await button('Seguir editando', dialog).click();
  await dialog.waitFor({ state: 'hidden' }); await retainedActor(previous);
  assert.equal(report.posts.length, postCount, 'cancelled actor switch sends no POST');
}
async function blockedActorChange(next) {
  const previous = actor, postCount = report.posts.length;
  assert.notEqual(next, previous);
  await actorSelect().selectOption(next);
  await page.getByRole('alert').filter({ hasText: 'Recupera la operacion pendiente antes de cambiar de actor. Se conserva su identificador.' }).waitFor();
  await retainedActor(previous);
  assert.equal(await page.getByRole('dialog', { name: 'Descartar cambios sin guardar', exact: true }).isVisible(), false);
  assert.equal(report.posts.length, postCount, 'uncertain actor switch sends no new command');
}
async function enabled(target) { await target.and(page.locator(':enabled')).waitFor(); }
async function tab(name) { await page.getByRole('tab', { name, exact: true }).click(); }
async function command(path, action, target) {
  const [response] = await Promise.all([
    page.waitForResponse(r => pathOf(r.url()) === path && r.request().method() === 'POST'
      && payload(r.request())?.action === action),
    target.click(),
  ]);
  assert.equal(response.status(), 200, `UI ${actor}: ${action} (${await response.text()})`);
  await settle();
  return response.json();
}
async function operations(action, name, root = page) {
  return command('/api/operations-pilot', action, button(name, root));
}
async function uncertainRetry(path, action, target, retry, notice, onCommitted) {
  const key = `${path}:${action}:${actor}`;
  assert.equal(lostResponses.has(key), false);
  const fault = { path, action, actor, dropped: false, attempts: [], committed: null, consoleCount: 0 };
  lostResponses.set(key, fault);
  const [failedRequest] = await Promise.all([
    page.waitForEvent('requestfailed', { predicate: request => pathOf(request.url()) === path
      && request.method() === 'POST' && payload(request)?.action === action }),
    target.click(),
  ]);
  assert.equal(injectedRequests.get(failedRequest), fault, 'failure belongs to the deliberate lost acknowledgement');
  assert.equal(failedRequest.failure()?.errorText, 'net::ERR_FAILED');
  assert.ok(fault.committed?.synthetic === true && typeof fault.committed.resourceRef === 'string', 'real SQL commit precedes abort');
  assert.equal(fault.committed.replayed, false);
  await enabled(retry);
  const verify = await onCommitted(fault.committed);
  await blockedActorChange(actor === 'newManager' ? 'doctor' : 'patient');
  await enabled(retry);
  const result = await command(path, action, retry);
  await retry.waitFor({ state: 'hidden' }); await notice.waitFor();
  assert.equal(fault.attempts.length, 2, 'exactly one lost acknowledgement and one retry');
  assert.deepEqual(fault.attempts[1], fault.attempts[0], 'retry preserves the entire command');
  assert.equal(typeof fault.attempts[0].input.operationId, 'string');
  assert.ok(fault.attempts[0].input.operationId.length > 0);
  assert.equal(result.replayed, true); assert.equal(result.resourceRef, fault.committed.resourceRef);
  await verify(result);
  report.uncertainRetries.push({ path, action, actor, attempts: 2, sameCommand: true,
    operationId: fault.attempts[0].input.operationId, resourceRef: result.resourceRef, replayed: true, sqlWrites: 1 });
  return result;
}
async function join() {
  await settle();
  if (await button('Aceptar y participar').isVisible()) await operations('join', 'Aceptar y participar');
  assert.equal((await read('/api/operations-pilot')).joined, true, `${actor} joined through UI`);
}
async function refresh() {
  const [response] = await Promise.all([
    page.waitForResponse(r => pathOf(r.url()) === '/api/operations-pilot' && r.request().method() === 'GET'),
    button('Actualizar datos').click(),
  ]);
  assert.equal(response.status(), 200); await settle();
  return response.json();
}
async function inbox(key, heading) {
  await button('Buzon local').click();
  const dialog = page.getByRole('dialog', { name: 'Buzon local', exact: true });
  await dialog.waitFor();
  const message = dialog.locator('article').filter({ has: page.getByText(identities.get(key).email, { exact: true }) });
  assert.equal(await message.count(), 1, `one invitation for ${key}`);
  actor = key;
  await button('Abrir invitacion', message).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
  assert.equal(await actorSelect().inputValue(), key);
}
async function receipt(deliveryRef) {
  await tab('Historial');
  const row = page.locator('article').filter({ hasText: deliveryRef });
  assert.equal(await row.count(), 1, `${actor} sees one matching receipt`);
  const summary = row.getByText('Ver comprobante y trazabilidad', { exact: true });
  if (!await summary.evaluate(element => element.closest('details').open)) await summary.click();
  await row.locator('.op-reference').filter({ hasText: `Comprobante: ${deliveryRef}` }).waitFor();
  assert.ok((await row.textContent()).includes(`10 g`));
  assert.ok((await row.textContent()).includes(lotCode));
  assert.ok((await row.textContent()).includes(productName));
}
async function reload(key) {
  await page.reload(); await settle();
  assert.equal(new URL(page.url()).hash, '', 'bootstrap capability stays out of the URL after reload');
  assert.equal(await actorSelect().inputValue(), key, 'native actor survives reload');
  await account(key);
}
function ledger(snapshot) {
  return { membership: snapshot.membership, batches: snapshot.batches, movements: snapshot.movements,
    deliveries: snapshot.deliveries, treatments: snapshot.treatments, grants: snapshot.grants };
}
function treatment(snapshot) {
  assert.equal(snapshot.treatments.length, 1);
  const value = snapshot.treatments[0];
  assert.equal(value.allowance_mg, 30000);
  assert.equal(value.period_count, 1); assert.equal(value.periods.length, 1);
  assert.equal(Date.parse(value.periods[0].ends_at) - Date.parse(value.periods[0].starts_at), 720 * 3600000, 'one period lasts exactly 720 hours');
  return value;
}
function activePeriod(value) {
  const now = Date.now();
  const period = value.periods.find(p => Date.parse(p.starts_at) <= now && now < Date.parse(p.ends_at));
  assert.ok(period, 'one active treatment period'); return period;
}

await mkdir(output, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Santiago',
    locale: 'es-CL', serviceWorkers: 'block' });
  context.setDefaultTimeout(15000);
  const metaResponse = await context.request.get(`${base}/__local_demo/meta`, {
    headers: { 'x-demo-bootstrap': bootstrap }, maxRedirects: 0,
  });
  assert.equal(metaResponse.status(), 200, 'coordinator-owned demo metadata');
  metadata = await metaResponse.json();
  assert.ok(Number.isInteger(metadata.generation) && metadata.generation > 0);
  assert.equal(typeof metadata.access, 'string'); assert.ok(metadata.access.length >= 16);
  assert.ok(Array.isArray(metadata.identities));
  identities = new Map(metadata.identities.map(id => [id.key, id]));
  assert.equal(identities.size, metadata.identities.length, 'identity keys are unique');
  for (const key of keys) {
    const id = identities.get(key); assert.ok(id, `metadata contains ${key}`);
    for (const field of ['label', 'subject', 'email', 'token']) assert.equal(typeof id[field], 'string');
    assert.ok(id.subject && id.token); assert.match(id.email, /@example\.test$/);
  }
  assert.equal(new Set(keys.map(key => identities.get(key).token)).size, keys.length);
  report.generation = metadata.generation;
  // Inspect and abort before a request can leave the allowed origin or perform an unrelated write.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (url.origin !== base || url.username || url.password) {
      report.externalAttempts.push({ method, origin: url.origin, path: url.pathname });
      return route.abort('blockedbyclient');
    }
    const path = url.pathname, body = method === 'POST' ? payload(request) : null;
    if (method === 'POST') report.posts.push({ path, action: body?.action ?? null, actor, readOnly: readPosts.has(body?.action) });
    const localRead = ['/__local_demo/meta', '/__local_demo/mail', '/__local_demo/health'].includes(path);
    if (path.startsWith('/api/') && !apiPaths.has(path) || path.startsWith('/__local_demo/') && !localRead
      || !['GET', 'POST'].includes(method) || method === 'POST' && (!apiPaths.has(path) || !actions[path]?.[actor]?.includes(body?.action))) {
      report.unexpectedRequests.push({ path, method, action: body?.action ?? null, actor });
      return route.abort('blockedbyclient');
    }
    if (apiPaths.has(path) || localRead) {
      const actual = await request.allHeaders();
      const fields = path === '/__local_demo/meta' ? ['x-demo-bootstrap']
        : ['x-demo-access', 'x-demo-generation', ...(apiPaths.has(path) ? ['privy-id-token'] : [])];
      const expected = path === '/__local_demo/meta' ? { 'x-demo-bootstrap': bootstrap } : headers(actor);
      const mismatch = fields.filter(field => actual[field] !== expected[field]);
      if (mismatch.length) {
        report.headerViolations.push({ path, method, actor, fields: mismatch });
        return route.abort('blockedbyclient');
      }
    }
    const fault = lostResponses.get(`${path}:${body?.action}:${actor}`);
    if (method === 'POST' && fault) {
      fault.attempts.push(body);
      if (!fault.dropped) {
        fault.dropped = true; injectedRequests.set(request, fault);
        const response = await route.fetch({ maxRedirects: 0 });
        if (response.status() !== 200) return route.fulfill({ response });
        fault.committed = await response.json();
        return route.abort('failed');
      }
    }
    return route.continue();
  });
  assert.equal(typeof context.routeWebSocket, 'function', 'Playwright must support WebSocket interception.');
  await context.routeWebSocket(/.*/, socket => {
    const url = new URL(socket.url());
    report.externalAttempts.push({ method: 'WEBSOCKET', origin: url.origin, path: url.pathname }); socket.close();
  });
  context.on('page', opened => {
    opened.on('pageerror', error => { if (!closing) report.pageErrors.push(redact(error.message)); });
    opened.on('console', message => {
      if (closing || message.type() !== 'error') return;
      const location = message.location().url;
      const fault = [...lostResponses.values()].find(value => value.dropped && value.committed && value.consoleCount === 0
        && location === `${base}${value.path}` && message.text() === 'Failed to load resource: net::ERR_FAILED');
      if (fault) {
        fault.consoleCount++; report.expectedConsoleErrors.push({ path: fault.path, action: fault.action, message: message.text() });
      } else report.consoleErrors.push(redact(message.text()));
    });
    opened.on('requestfailed', request => {
      if (closing) return;
      const fault = injectedRequests.get(request), error = request.failure()?.errorText;
      if (fault && error === 'net::ERR_FAILED') {
        report.expectedRequestFailures.push({ path: fault.path, action: fault.action, actor: fault.actor, error });
      } else if (error !== 'net::ERR_ABORTED' || request.method() !== 'GET'
        && !readPosts.has(payload(request)?.action)) {
        report.requestFailures.push({ path: pathOf(request.url()), method: request.method(), error });
      }
    });
    opened.on('response', response => {
      if (!closing && new URL(response.url()).origin === base && response.status() >= 400)
        report.httpErrors.push({ path: pathOf(response.url()), status: response.status(), method: response.request().method() });
    });
  });
  page = await context.newPage();
  await stage('fresh-sql-read-preconditions', async () => {
    const admin = await read('/api/operations-pilot', 'admin');
    assert.deepEqual(admin.organizations ?? [], [], 'do not run on an already-used SQL demo');
    for (const key of ['doctor', 'patient']) {
      const snapshot = await read('/api/operations-pilot', key);
      assert.equal(snapshot.joined, false, `${key} starts active but not joined`);
      assert.deepEqual(snapshot.bookings ?? [], []); assert.deepEqual(snapshot.treatments ?? [], []);
    }
    for (const key of ['newManager', 'newWorker']) await deniedSnapshot(key);
    const health = await read('/__local_demo/health');
    assert.equal(health.generation, metadata.generation); assert.deepEqual(health.blockedTransports, []);
    await page.goto(`${base}/#demo-access=${bootstrap}`, { waitUntil: 'networkidle' });
    await actorSelect().waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).hash, '', 'UI captures and removes the bootstrap fragment');
    const options = await actorSelect().locator('option').evaluateAll(rows => rows.map(row => row.value));
    for (const key of keys) assert.ok(options.includes(key), `native actor selector contains ${key}; actual keys: ${options.join(', ')}`);
    assert.equal(await actorSelect().inputValue(), 'admin');
  });
  await stage('unsaved-invitation-survives-list-and-cancelled-actor-change', async () => {
    const email = page.getByLabel('Correo del encargado', { exact: true });
    await email.fill(identities.get('newManager').email);
    await command('/api/dispensary-onboarding', 'list', button('Actualizar incorporaciones'));
    await enabled(button('Revisar invitacion'));
    await cancelActorChange('doctor');
    assert.equal(await email.inputValue(), identities.get('newManager').email);
    assert.deepEqual((await read('/api/operations-pilot', 'admin')).organizations ?? [], []);
  });
  await stage('admin-invites-manager', async () => {
    await page.getByLabel('Correo del encargado', { exact: true }).fill(identities.get('newManager').email);
    await button('Revisar invitacion').click();
    await command('/api/dispensary-onboarding', 'invite', button('Confirmar envio'));
  });
  await stage('manager-accepts-and-submits', async () => {
    await inbox('newManager', 'Invitacion para encargado');
    await page.getByRole('checkbox').check();
    await command('/api/dispensary-onboarding', 'accept', button('Aceptar invitacion'));
    await page.getByRole('heading', { name: 'Borrador', exact: true }).waitFor();
    for (const [label, value] of [['Nombre del encargado', 'Encargado sintetico QA'], ['Telefono', '000000000'],
      ['Nombre comercial', orgName], ['Comuna', 'Santiago'], ['Direccion de la sede', 'Direccion sintetica 123'],
      ['Descripcion de actividad', 'Pruebas locales sinteticas sin atencion real']]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await command('/api/dispensary-onboarding', 'save-draft', button('Guardar borrador'));
    await page.locator('.onboarding-form button:enabled').filter({ hasText: 'Revisar datos guardados' }).click();
    await page.getByRole('checkbox').check();
    await command('/api/dispensary-onboarding', 'submit', button('Enviar solicitud a revision'));
    await page.getByRole('heading', { name: 'En revision', exact: true }).waitFor();
    await deniedSnapshot('newManager');
  });
  await stage('admin-approves-and-manager-reloads', async () => {
    await switchActor('admin'); await page.getByRole('tab', { name: 'Solicitudes', exact: true }).click();
    const application = page.locator('.onboarding-row').filter({ hasText: orgName });
    await button('Revisar solicitud', application).click();
    page.once('dialog', dialog => dialog.accept());
    await command('/api/dispensary-onboarding', 'review', button('Aprobar piloto'));
    await switchActor('newManager'); await join();
    await page.getByRole('heading', { name: orgName, level: 1, exact: true }).waitFor();
    const manager = await read('/api/operations-pilot');
    assert.equal(manager.membership.role, 'manager'); assert.equal(manager.organizations.length, 1);
    await reload('newManager');
    assert.deepEqual((await read('/api/operations-pilot')).membership, manager.membership);
  });
  await stage('manager-invites-worker-and-worker-accepts', async () => {
    await tab('Gestion');
    await button('Equipo', page.getByRole('group', { name: 'Gestion del dispensario', exact: true })).click();
    await page.getByLabel('Correo del trabajador', { exact: true }).fill(identities.get('newWorker').email);
    await button('Preparar invitacion').click();
    await command('/api/team-invitations', 'create', button('Enviar invitacion', page.getByRole('group', { name: 'Confirmar invitacion', exact: true })));
    await inbox('newWorker', 'Invitacion al equipo');
    assert.equal(await button('Aceptar invitacion como operador').isDisabled(), true);
    await page.getByRole('checkbox').check();
    await command('/api/team-invitations', 'accept', button('Aceptar invitacion como operador'));
    await join();
    const worker = await read('/api/operations-pilot'), manager = await read('/api/operations-pilot', 'newManager');
    assert.equal(worker.membership.role, 'operator');
    assert.equal(worker.membership.organization_ref, manager.membership.organization_ref);
    await reload('newWorker'); assert.equal((await read('/api/operations-pilot')).membership.role, 'operator');
  });
  await stage('manager-catalog-and-100g-receipt', async () => {
    await switchActor('newManager'); await tab('Gestion');
    const panel = page.getByRole('region', { name: 'Gestion comercial', exact: true });
    await button('Proveedores', panel).click(); await button('Nuevo proveedor', panel).click();
    await panel.getByLabel('Nombre', { exact: true }).fill('Proveedor sintetico local');
    await panel.getByLabel('Referencia interna', { exact: true }).fill('LOCAL-SUPPLIER');
    await panel.getByLabel('Contacto comercial', { exact: true }).fill('proveedor@example.test');
    await command('/api/dispensary-commerce', 'save-supplier', button('Guardar', panel));
    await button('Catalogo', panel).click(); await button('Nuevo producto', panel).click();
    await panel.getByLabel('Codigo interno', { exact: true }).fill('LOCAL-PRODUCT');
    await panel.getByLabel('Nombre', { exact: true }).fill(productName);
    await panel.getByLabel('Presentacion', { exact: true }).fill('Gramos');
    await panel.getByLabel('Precio de referencia (CLP)', { exact: true }).fill('2500');
    await tab('Inventario'); await button('Seguir editando').click();
    assert.equal(await panel.getByLabel('Nombre', { exact: true }).inputValue(), productName);
    await command('/api/dispensary-commerce', 'save-product', button('Guardar', panel));
    await button('Abrir producto', panel).click(); await panel.getByText(/^Recibir lote de/).click();
    await panel.getByLabel('Codigo de lote', { exact: true }).fill(lotCode);
    await panel.getByLabel('Referencia de origen', { exact: true }).fill('Origen sintetico local');
    await panel.getByLabel('Cantidad (g)', { exact: true }).fill('100');
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 16);
    await panel.getByLabel('Vencimiento', { exact: true }).fill(expiry);
    await panel.getByLabel('Costo total (CLP)', { exact: true }).fill('15000');
    await panel.getByLabel('Proveedor de la recepcion', { exact: true }).selectOption({ label: 'Proveedor sintetico local' });
    await uncertainRetry('/api/dispensary-commerce', 'receive', button('Registrar recepcion simulada', panel),
      button('Reintentar la misma operacion', panel), panel.getByRole('status').filter({ hasText: 'Guardado. Referencia:' }),
      async committed => {
        const snapshot = await read('/api/operations-pilot'), receipts = await read(commercialReceipts);
        assert.equal(snapshot.batches.length, 1); assert.equal(snapshot.batches[0].stock_mg, 100000);
        assert.equal(receipts.items.length, 1); assert.equal(receipts.items[0].receipt_ref, committed.resourceRef);
        assert.equal(receipts.items[0].quantity_mg, 100000);
        return async () => {
          assert.deepEqual(ledger(await read('/api/operations-pilot')), ledger(snapshot), 'receipt replay does not increment stock or batch version');
          assert.deepEqual(await read(commercialReceipts), receipts, 'receipt replay creates no second receipt');
        };
      });
    await tab('Inventario'); await page.getByText(lotCode, { exact: false }).first().waitFor();
    const snapshot = await read('/api/operations-pilot'); assert.equal(snapshot.batches.length, 1);
    assert.equal(snapshot.batches[0].stock_mg, 100000); assert.equal(snapshot.batches[0].lot_code, lotCode);
    await reload('newManager'); await tab('Inventario');
    await page.getByText(lotCode, { exact: false }).first().waitFor();
    assert.equal((await read('/api/operations-pilot')).batches[0].stock_mg, 100000);
  });
  await stage('doctor-publishes-patient-reserves', async () => {
    await switchActor('doctor'); await join(); await tab('Agenda');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago',
      year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Date.now() + 86400000))
      .map(part => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    await page.getByLabel('Inicio de semana', { exact: true }).fill(date);
    await page.getByLabel('Fecha', { exact: true }).fill(date);
    await page.getByLabel('Hora', { exact: true }).fill('14:00');
    await page.getByLabel('Duracion').selectOption('30');
    await command('/api/agenda', 'publish', button('Publicar horario'));
    await page.getByText('Disponible', { exact: true }).waitFor();
    await switchActor('patient'); await join(); await tab('Agenda');
    await page.getByLabel('Inicio de semana', { exact: true }).fill(date);
    await command('/api/agenda', 'reserve', button('Reservar'));
    await page.getByText('Cita confirmada', { exact: true }).waitFor();
    const patient = await read('/api/operations-pilot'), doctor = await read('/api/operations-pilot', 'doctor');
    assert.equal(patient.bookings.length, 1); assert.equal(doctor.bookings.length, 1);
    assert.equal(patient.bookings[0].booking_ref, doctor.bookings[0].booking_ref);
  });
  await stage('doctor-consults-and-issues-30g-treatment', async () => {
    await switchActor('doctor'); await tab('Consultas'); await refresh();
    await operations('start-encounter', 'Iniciar consulta simulada');
    await page.getByRole('button', { name: /^En atenci\u00f3n/ }).click();
    await page.getByLabel('Nota de prueba', { exact: true }).fill(note);
    await operations('save-note', 'Guardar borrador'); await refresh();
    assert.deepEqual((await read('/api/operations-pilot', 'patient')).notes, [], 'patient cannot read an unfinished note');
    assert.deepEqual((await read('/api/operations-pilot', 'newWorker')).notes, [], 'operator cannot read a clinical draft');
    const complete = form('Finalizar con tratamiento simulado');
    await complete.getByLabel('Gramos por periodo', { exact: true }).fill('30');
    await complete.getByLabel('Periodos de 30 dias', { exact: true }).fill('1');
    await operations('complete-encounter', 'Finalizar con tratamiento simulado', complete);
    const patient = await read('/api/operations-pilot', 'patient');
    assert.equal(patient.notes.length, 1); assert.equal(patient.notes[0].body, note);
    assert.equal(patient.encounters.length, 1); assert.equal(patient.encounters[0].state, 'completed');
    assert.equal(patient.encounters[0].version, 3);
    assert.equal(activePeriod(treatment(patient)).used_mg, 0);
    report.treatment = { allowanceMg: 30000, periodCount: 1, durationHours: 720, encounterState: 'completed', encounterVersion: 3 };
    const worker = await read('/api/operations-pilot', 'newWorker');
    assert.deepEqual(worker.notes, []); assert.deepEqual(worker.treatments, [], 'no patient grant yet');
  });
  await stage('patient-saves-profile', async () => {
    await switchActor('patient'); await tab('Tratamientos');
    const profile = form('Guardar perfil de prueba');
    await profile.getByLabel('Nombre ficticio', { exact: true }).fill(patientName);
    await profile.getByLabel('Correo ficticio', { exact: true }).fill(identities.get('patient').email);
    await profile.getByLabel('Telefono ficticio', { exact: true }).fill('000000000');
    await profile.getByRole('checkbox').check();
    await operations('save-profile', 'Guardar perfil de prueba', profile);
  });
  await stage('unsaved-profile-survives-grant-and-cancelled-actor-change', async () => {
    const profile = form('Guardar perfil de prueba'), saved = (await read('/api/operations-pilot')).profile;
    const draftEmail = 'borrador.patient@example.test', draftPhone = '000000001';
    await profile.getByLabel('Correo ficticio', { exact: true }).fill(draftEmail);
    await profile.getByLabel('Telefono ficticio', { exact: true }).fill(draftPhone);
    const permission = page.locator('.op-line').filter({ hasText: orgName });
    await operations('grant', 'Autorizar 24 horas', permission);
    await button('Revocar permiso', permission).waitFor();
    await cancelActorChange('doctor');
    assert.equal(await profile.getByLabel('Correo ficticio', { exact: true }).inputValue(), draftEmail);
    assert.equal(await profile.getByLabel('Telefono ficticio', { exact: true }).inputValue(), draftPhone);
    const patient = await read('/api/operations-pilot');
    assert.deepEqual(patient.profile, saved, 'grant does not persist an unrelated contact draft');
    assert.equal(patient.profile.name, patientName); assert.equal(patient.profile.email, identities.get('patient').email);
    const worker = await read('/api/operations-pilot', 'newWorker');
    assert.equal(treatment(worker).treatment_ref, treatment(patient).treatment_ref);
    assert.deepEqual(worker.notes, [], 'grant shares treatment logistics, never the clinical note');
    assert.equal(worker.grants.length, 1); assert.equal(worker.patientProfiles[0].name, patientName);
    await profile.getByLabel('Correo ficticio', { exact: true }).fill(saved.email);
    await profile.getByLabel('Telefono ficticio', { exact: true }).fill(saved.phone);
    await reload('patient'); await tab('Tratamientos');
    assert.equal(await page.getByLabel('Nombre ficticio', { exact: true }).inputValue(), patientName);
    await page.locator('.op-stats div').filter({ hasText: 'Disponible ahora' }).getByText('30 g', { exact: true }).waitFor();
  });
  let deliveryRef;
  await stage('worker-dispenses-10g-local-and-both-receipts', async () => {
    await switchActor('newWorker'); await tab('Pacientes'); await refresh();
    await page.getByRole('button', { name: new RegExp(patientName) }).click();
    const preparation = form('Revisar entrega');
    await preparation.getByRole('radio').check();
    await preparation.getByLabel('Cantidad en gramos', { exact: true }).fill('10');
    const postCount = report.posts.length;
    await button('Revisar entrega', preparation).click();
    const review = page.getByRole('region', { name: 'Confirmar entrega', exact: true });
    await review.waitFor(); assert.ok((await review.textContent()).includes('Entrega: 10 g'));
    assert.equal(report.posts.length, postCount, 'review does not send a command');
    await uncertainRetry('/api/operations-pilot', 'dispense', button('Confirmar entrega', review),
      button('Reintentar operacion'), page.getByRole('status').filter({ hasText: 'Entrega guardada. Comprobante:' }),
      async committed => {
        const worker = await read('/api/operations-pilot'), patient = await read('/api/operations-pilot', 'patient');
        assert.equal(worker.deliveries.length, 1); assert.equal(worker.deliveries[0].delivery_ref, committed.resourceRef);
        assert.equal(worker.deliveries[0].quantity_mg, 10000); assert.equal(worker.batches[0].stock_mg, 90000);
        assert.equal(activePeriod(treatment(patient)).used_mg, 10000);
        return async () => {
          assert.deepEqual(ledger(await read('/api/operations-pilot')), ledger(worker), 'delivery replay does not increment batch version or decrement stock twice');
          assert.deepEqual(ledger(await read('/api/operations-pilot', 'patient')), ledger(patient), 'delivery replay leaves one receipt and one balance debit');
        };
      });
    const worker = await read('/api/operations-pilot'), patient = await read('/api/operations-pilot', 'patient');
    assert.equal(worker.deliveries.length, 1); assert.equal(patient.deliveries.length, 1);
    const delivery = worker.deliveries[0]; deliveryRef = delivery.delivery_ref;
    assert.equal(delivery.quantity_mg, 10000); assert.equal(delivery.operator_ref, worker.actorRef);
    assert.equal(delivery.organization_ref, worker.membership.organization_ref);
    assert.equal(delivery.batch_ref, worker.batches[0].batch_ref);
    assert.equal(patient.deliveries[0].delivery_ref, deliveryRef);
    assert.equal(worker.batches[0].stock_mg, 90000);
    assert.equal(activePeriod(treatment(patient)).used_mg, 10000);
    assert.equal(activePeriod(treatment(worker)).allowance_mg - activePeriod(treatment(worker)).used_mg, 20000);
    await receipt(deliveryRef); await reload('newWorker'); await receipt(deliveryRef);
    await switchActor('patient'); await tab('Tratamientos');
    await page.locator('.op-stats div').filter({ hasText: 'Disponible ahora' }).getByText('20 g', { exact: true }).waitFor();
    await receipt(deliveryRef);
    report.receipt = { deliveryRef, quantityMg: 10000, stockMg: 90000, remainingMg: 20000 };
  });
  await stage('review-1g-only-and-discard-without-post', async () => {
    await switchActor('newWorker'); await tab('Pacientes'); await refresh();
    await page.getByRole('button', { name: new RegExp(patientName) }).click();
    const before = ledger(await read('/api/operations-pilot')), postCount = report.posts.length;
    const preparation = form('Revisar entrega');
    await preparation.getByRole('radio').check();
    await preparation.getByLabel('Cantidad en gramos', { exact: true }).fill('1');
    await button('Revisar entrega', preparation).click();
    const review = page.getByRole('region', { name: 'Confirmar entrega', exact: true });
    await review.waitFor(); await settle();
    assert.ok((await review.textContent()).includes('Entrega: 1 g'));
    assert.equal(await button('Confirmar entrega', review).isEnabled(), true);
    assert.equal(report.posts.length, postCount, '1g is reviewed, not confirmed');
    assert.deepEqual(ledger(await read('/api/operations-pilot')), before, 'review leaves SQL stock, balances, and receipts unchanged');
    await tab('Historial'); await button('Descartar cambios').click(); await settle();
    assert.equal(report.posts.length, postCount, 'discard sends no POST');
    assert.deepEqual(ledger(await read('/api/operations-pilot')), before);
    await receipt(deliveryRef);
  });
  await stage('manager-worker-five-widths', async () => {
    for (const key of ['newManager', 'newWorker']) {
      await switchActor(key);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        if (key === 'newManager') {
          await tab('Inventario'); await page.getByText(lotCode, { exact: false }).first().waitFor();
          await page.locator('.op-row').getByText('90 g', { exact: true }).waitFor();
        } else {
          await receipt(deliveryRef);
          assert.equal(await button('Registrar ajuste').count(), 0);
          assert.equal(await button('Poner en cuarentena').count(), 0);
        }
        await settle();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${key} ${width}: horizontal overflow`);
        const select = actorSelect();
        const bounds = await select.boundingBox();
        assert.ok(bounds && bounds.width > 0 && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `${key} ${width}: native actor control fits`);
        const name = `${key}-${width}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(name, output)), fullPage: true });
        report.screenshots.push({ actor: key, width, path: fileURLToPath(new URL(name, output)) });
      }
      if (key === 'newWorker') {
        await tab('Gestion');
        const panel = page.getByRole('region', { name: 'Gestion comercial', exact: true });
        await panel.getByText(productName, { exact: true }).waitFor();
        assert.equal(await button('Nuevo producto', panel).count(), 0);
        assert.equal(await button('Proveedores', panel).count(), 0);
        await button('Recepciones', panel).click();
        await panel.getByRole('heading', { name: '100 g', exact: true }).waitFor();
        assert.equal(await panel.getByText(/^Costo:/).count(), 0, 'operator receives no supplier cost view');
      }
    }
  });
  await stage('final-read-only-isolation-and-single-write', async () => {
    const worker = await read('/api/operations-pilot', 'newWorker'), patient = await read('/api/operations-pilot', 'patient');
    assert.equal(worker.deliveries.length, 1); assert.equal(patient.deliveries.length, 1);
    assert.equal(worker.batches[0].stock_mg, 90000); assert.equal(activePeriod(treatment(patient)).used_mg, 10000);
    assert.equal(report.posts.filter(entry => entry.action === 'dispense').length, 2, 'one lost dispense acknowledgement plus one identical retry');
    assert.equal(report.posts.filter(entry => entry.action === 'receive').length, 2, 'one lost receive acknowledgement plus one identical retry');
    assert.equal((await read(commercialReceipts, 'newManager')).items.length, 1);
    assert.equal(report.uncertainRetries.length, 2);
    assert.equal(report.expectedRequestFailures.length, 2, 'only the two deliberately aborted acknowledgements fail');
    const health = await read('/__local_demo/health');
    assert.equal(health.generation, metadata.generation, 'journey never resets shared SQL');
    assert.deepEqual(health.blockedTransports, [], 'no server transport attempted to reach an external provider');
    for (const field of ['externalAttempts', 'unexpectedRequests', 'headerViolations', 'httpErrors', 'pageErrors', 'consoleErrors', 'requestFailures'])
      assert.deepEqual(report[field], [], field);
    assert.equal(report.screenshots.length, 10);
  });
  report.status = 'PASS';
} catch (error) {
  failure = error; report.status = 'FAIL'; report.failure = redact(error.message);
  if (page && !page.isClosed()) {
    try {
      report.failureScreenshot = fileURLToPath(new URL(`failure-${entry.port}.png`, output));
      await page.screenshot({ path: report.failureScreenshot, fullPage: true });
    }
    catch { /* Preserve the original failure when the browser itself is unavailable. */ }
  }
} finally {
  closing = true;
  if (context) {
    try { await context.close(); report.cleanup.contextClosed = true; }
    catch (error) { failure ??= error; report.status = 'FAIL'; report.cleanup.contextError = redact(error.message); }
  }
  if (browser) {
    try { await browser.close(); report.cleanup.browserClosed = true; }
    catch (error) { failure ??= error; report.status = 'FAIL'; report.cleanup.browserError = redact(error.message); }
  }
  const result = `${redact(JSON.stringify(report, null, 2))}\n`;
  await writeFile(new URL(`report-${entry.port}.json`, output), result);
  await writeFile(new URL('report.json', output), result);
}
if (failure) {
  failure.message = redact(failure.message);
  if (failure.stack) failure.stack = redact(failure.stack);
  throw failure;
}
console.log(`PASS local SQL journey: five identities, UI-only mutations, dirty drafts survive reads/grants, exact uncertain retries write once, 100g received / 30g for 720h / 10g dispensed, 1g review without POST, ten captures, zero external requests. Report: ${fileURLToPath(new URL('report.json', output))}`);
