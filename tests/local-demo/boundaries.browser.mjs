import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const address = new URL(process.env.LOCAL_DEMO_URL), base = address.origin;
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const bootstrap = new URLSearchParams(address.hash.slice(1)).get('demo-access');
assert.match(bootstrap, /^[A-Za-z0-9_-]{43}$/);
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const context = await browser.newContext({ timezoneId: 'America/Santiago', serviceWorkers: 'block' });
const external = [], errors = [];
await context.route('**/*', route => {
  if (new URL(route.request().url()).origin !== base) { external.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient'); }
  return route.continue();
});
const metadata = await (await context.request.get(base + '/__local_demo/meta', { headers: { 'x-demo-bootstrap': bootstrap } })).json();
const patient = await context.newPage(), admin = await context.newPage(), inbox = await context.newPage();
for (const page of [patient, admin, inbox]) page.on('pageerror', error => errors.push(error.message));
let release, releaseInbox;
try {
  await patient.goto(`${base}/dispensario?actor=patient#demo-access=${bootstrap}`);
  await patient.getByRole('tab', { name: 'Tratamientos', exact: true }).click();
  const name = await patient.getByLabel('Nombre ficticio', { exact: true }).inputValue();
  assert.ok(name, 'the completed journey must provide a profile before boundary QA');
  await patient.getByRole('tab', { name: 'Historial', exact: true }).click();
  await patient.getByText('Ver comprobante y trazabilidad', { exact: true }).waitFor();
  const committed = new Promise(resolve => { release = resolve; });
  let fetched;
  const fetchedSignal = new Promise(resolve => { fetched = resolve; });
  await patient.route('**/api/operations-pilot', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch(); assert.equal(response.status(), 200);
    fetched(); await committed;
    try { await route.fulfill({ response }); } catch { /* The expired component aborts its old request. */ }
  });
  await patient.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await fetchedSignal;
  const mailCommitted = new Promise(resolve => { releaseInbox = resolve; });
  let mailFetched;
  const mailSignal = new Promise(resolve => { mailFetched = resolve; });
  await inbox.goto(`${base}/?actor=admin#demo-access=${bootstrap}`);
  await inbox.route('**/__local_demo/mail', async route => {
    const response = await route.fetch(); assert.equal(response.status(), 200);
    mailFetched(); await mailCommitted;
    try { await route.fulfill({ response }); } catch { /* Reset aborts the obsolete inbox request. */ }
  });
  await inbox.getByRole('button', { name: 'Buzon local', exact: true }).click();
  await mailSignal;
  await admin.goto(`${base}/?actor=admin#demo-access=${bootstrap}`);
  const reset = admin.waitForResponse(response => new URL(response.url()).pathname === '/__local_demo/reset' && response.status() === 200);
  await admin.getByRole('button', { name: 'Reiniciar escenario', exact: true }).click();
  await admin.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  const next = await (await reset).json(); assert.equal(next.generation, metadata.generation + 1);
  await patient.getByRole('alert').filter({ hasText: 'El escenario anterior ya no esta disponible.' }).waitFor();
  assert.equal(await patient.locator('.local-product .op-workspace, .local-product .op-content, .local-product input').count(), 0);
  assert.equal(await patient.getByText(name, { exact: true }).count(), 0);
  await inbox.getByRole('alert').filter({ hasText: 'El escenario anterior ya no esta disponible.' }).waitFor();
  releaseInbox(); await inbox.unroute('**/__local_demo/mail');
  assert.equal(await inbox.getByRole('dialog').count(), 0, 'a late mailbox body must not reopen an expired dialog');
  release(); await patient.unroute('**/api/operations-pilot');
  await patient.getByRole('button', { name: 'Recuperar escenario', exact: true }).click();
  await patient.getByRole('heading', { name: 'Incorporaciones', exact: true }).waitFor();
  assert.equal(await patient.getByLabel('Actor de demostracion', { exact: true }).inputValue(), 'admin');
  await patient.getByText('No hay invitaciones.', { exact: true }).waitFor();
  const blocked = await patient.evaluate(async () => {
    const outcomes = [];
    for (const [name, operation] of [
      ['fetch', () => fetch('https://external.invalid/')],
      ['other-loopback', () => fetch('http://127.0.0.1:9/')],
      ['xhr', () => { const request = new XMLHttpRequest(); request.open('GET', 'https://external.invalid/'); request.send(); }],
      ['websocket', () => new WebSocket('wss://external.invalid/')],
      ['eventsource', () => new EventSource('https://external.invalid/')],
      ['beacon', () => navigator.sendBeacon('https://external.invalid/', 'synthetic')],
      ['popup', () => window.open('https://external.invalid/')],
    ]) { try { await operation(); outcomes.push({ name, blocked: false }); } catch { outcomes.push({ name, blocked: true }); } }
    const anchor = document.createElement('a'); anchor.href = 'https://external.invalid/'; document.body.append(anchor);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true }); anchor.dispatchEvent(click); outcomes.push({ name: 'anchor', blocked: click.defaultPrevented }); anchor.remove();
    return outcomes;
  });
  assert.ok(blocked.every(item => item.blocked)); assert.deepEqual(external, []); assert.deepEqual(errors, []);
  await mkdir('scratch/local-demo', { recursive: true });
  await writeFile('scratch/local-demo/boundaries-report.json', JSON.stringify({ status: 'PASS', crossTabReset: true, lateResponseWithdrawn: true, lateMailboxWithdrawn: true, explicitRecovery: true, blocked, externalAttempts: external, pageErrors: errors,
    limits: ['Synthetic identities, viewport browser only; not an OS sandbox or physical-phone autonomy approval.'] }, null, 2));
  console.log('PASS browser boundaries: cross-tab reset withdraws profile/treatment/receipt, late response cannot restore them, explicit recovery starts fresh; eight browser transports/navigation attempts rejected before network.');
} finally { release?.(); releaseInbox?.(); await context.close(); await browser.close(); }
