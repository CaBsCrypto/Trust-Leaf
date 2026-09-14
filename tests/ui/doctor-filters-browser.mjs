import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.AGENDA_FIXTURE_URL ?? 'http://127.0.0.1:4321';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  const bookings = [
    ['pending-z', '2030-01-01', 'confirmed'], ['pending-b', '2020-01-01', 'confirmed'], ['pending-a', '2020-01-01', 'confirmed'],
    ['active-b', '2030-01-01', 'confirmed'], ['active-a', '2020-01-01', 'confirmed'],
    ['done-old', '2020-01-01', 'confirmed'], ['done-new', '2030-01-01', 'confirmed'], ['cancelled', '2025-01-01', 'cancelled'],
  ].map(([booking_ref, date, state]) => ({ booking_ref, starts_at: `${date}T12:00:00Z`, state, patient_ref: 'patient', doctor_ref: 'doctor' }));
  const encounters = bookings.filter(b => /active|done|cancelled/.test(b.booking_ref)).map(b => ({ booking_ref: b.booking_ref, state: b.booking_ref.startsWith('active') ? 'active' : 'completed', version: 1 }));
  let fail = false;
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET') writes.push(route.request().url());
    return route.fulfill({ status: fail ? 503 : 200, json: { role: 'doctor', joined: true, synthetic: true, bookings, encounters, notes: [], treatments: [] } });
  });
  await page.goto(`${base}/?operations&role=doctor`);
  const rows = () => page.locator('article .op-reference').allTextContents();
  const select = async name => page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).click();
  await page.getByRole('button', { name: 'Pendientes (3)', exact: true }).waitFor();
  assert.deepEqual(await rows(), ['pending-a', 'pending-b', 'pending-z']);
  await select('En atención'); assert.deepEqual(await rows(), ['active-a', 'active-b']);
  await select('Finalizadas'); assert.deepEqual(await rows(), ['done-new', 'done-old']);
  await select('Canceladas'); assert.deepEqual(await rows(), ['cancelled']);
  await select('Todas'); assert.equal((await rows()).length, 8);
  assert.equal((await rows())[0], 'active-b');
  await page.getByRole('searchbox').fill('pending-a');
  await select('Pendientes'); assert.deepEqual(await rows(), ['pending-a']);
  assert.equal(await page.getByRole('button', { name: 'Pendientes (3)', exact: true }).count(), 1);
  await select('Finalizadas');
  await page.getByText('No hay consultas para esta busqueda.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('searchbox').inputValue(), 'pending-a');
  await page.getByRole('tab', { name: 'Tratamientos', exact: true }).click();
  assert.equal(await page.getByRole('searchbox').inputValue(), '');
  await page.getByRole('tab', { name: 'Consultas', exact: true }).click();
  await select('Pendientes');
  encounters.push(...bookings.filter(b => b.booking_ref.startsWith('pending')).map(b => ({ booking_ref: b.booking_ref, state: 'active', version: 1 })));
  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await page.getByText('No hay consultas en este estado.', { exact: true }).waitFor();
  fail = true;
  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByText('No hay consultas en este estado.', { exact: true }).count(), 0);
  fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  await select('Todas');
  assert.equal(new Set(await rows()).size, 8);
  await mkdir('scratch/operations-qa', { recursive: true });
  for (const [size, viewport] of [['desktop', { width: 1365, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `scratch/operations-qa/doctor-filters-${size}.png`, fullPage: true });
  }
  await page.getByRole('searchbox').fill('done');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'other-doctor' })));
  await page.locator('button[aria-pressed="true"]').filter({ hasText: 'Pendientes' }).waitFor();
  assert.equal(await page.getByRole('searchbox').inputValue(), '');
  await select('Todas'); await page.reload();
  await page.locator('button[aria-pressed="true"]').filter({ hasText: 'Pendientes' }).waitFor();
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  console.log('PASS doctor filters: states, cancellation precedence, ordering, counts, search, refresh, errors, responsive layout, session reset, reload, no writes.');
} finally { await browser.close(); }
