import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const baseUrl = process.env.AGENDA_FIXTURE_URL ?? 'http://127.0.0.1:4321';
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/, 'synthetic operations tests must stay local');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const output = new URL('../../scratch/operations-qa/', import.meta.url);
await mkdir(output, { recursive: true });
const bookingRef = '11111111-1111-4111-8111-111111111111';
const job = { booking_ref: bookingRef, state: 'error', attempts: 2, starts_at: '2026-09-09T16:00:00Z', error_code: 'CALENDAR_SYNC_FAILED' };
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, timezoneId: 'America/Santiago' });
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  let status = 200, writeStatus = 200;
  await page.route('**/api/google-calendar/**', async route => {
    const request = route.request();
    if (request.method() === 'POST') { writes.push(request.url()); return route.fulfill({ status: writeStatus, json: writeStatus === 200 ? { processed: true } : { code: 'CALENDAR_OPERATION_FAILED' } }); }
    return route.fulfill({ status, json: status === 200 ? { jobs: [job] } : { code: 'AUTH_REQUIRED' } });
  });
  await page.goto(`${baseUrl}/?calendarOperations&role=admin`);
  await page.getByText('Error de sincronizacion', { exact: true }).waitFor();

  // A command waiting for identity must not dispatch after that identity ends.
  await page.evaluate(() => window.dispatchEvent(new Event('fixture-hold-token')));
  await page.getByRole('button', { name: 'Procesar siguiente', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'signed-out' })));
  await page.evaluate(() => window.dispatchEvent(new Event('fixture-release-token')));
  await page.waitForTimeout(300);
  assert.equal(writes.length, 0, 'logout must cancel the deferred privileged operation');
  assert.equal(await page.getByText('Error de sincronizacion', { exact: true }).count(), 0, 'logout clears administrative jobs');
  assert.equal(await page.getByRole('button', { name: 'Procesar siguiente', exact: true }).isDisabled(), true);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'admin' })));
  await page.getByText(`Reserva ${bookingRef}`, { exact: true }).waitFor();
  await page.getByText('CALENDAR_SYNC_FAILED', { exact: true }).waitFor();
  for (const [size, viewport] of [['desktop', { width: 1365, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${size} overflow`);
    await page.screenshot({ path: fileURLToPath(new URL(`calendar-admin-${size}.png`, output)), fullPage: true });
  }
  status = 503;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('alert').waitFor({ timeout: 5000 });
  assert.equal(await page.getByText(`Reserva ${bookingRef}`, { exact: true }).count(), 1, 'transient read failure preserves the last snapshot');
  assert.equal(await page.getByRole('button', { name: 'Procesar siguiente', exact: true }).isDisabled(), true);
  status = 200; job.state = 'ready'; job.error_code = null;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Lista', { exact: true }).waitFor({ timeout: 5000 });
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  const processed = page.waitForResponse(r => r.url().endsWith('/api/google-calendar/process'));
  await page.getByRole('button', { name: 'Procesar siguiente', exact: true }).click();
  assert.equal((await processed).status(), 200);
  await page.getByText('Intento procesado.', { exact: true }).waitFor();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Procesar siguiente')?.disabled);
  assert.equal(writes.length, 1, 'one deliberate command sends one bounded worker request');
  writeStatus = 503;
  await page.getByRole('button', { name: 'Procesar siguiente', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Procesar siguiente')?.disabled);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(100);
  assert.match(await page.getByRole('alert').innerText(), /CALENDAR_OPERATION_FAILED/, 'successful background reads preserve failed command feedback');
  assert.equal(writes.length, 2, 'background recovery must not replay the worker command');
  status = 403;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('alert').waitFor({ timeout: 5000 });
  assert.equal(await page.locator('li').count(), 0, 'lost admin authorization clears prior operational records');
  assert.equal(await page.getByRole('button', { name: 'Preparar calendario', exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: isolated admin Calendar UI: incident reference, safe error, desktop/mobile, reconnection, authorization loss and deferred command cancelled on logout. Google and hosted identities are not exercised.');
} finally { await browser.close(); }
