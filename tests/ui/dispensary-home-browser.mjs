import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { navigateSection } from './workspace-navigation.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.OPERATIONS_TEST_URL ?? 'http://127.0.0.1:4321';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let failure = false, writes = 0;
    const now = Date.now();
    const data = { synthetic: true, joined: true, role: 'dispensary', actorRef: 'manager',
      membership: { organization_ref: 'org', role: 'manager' }, organizations: [{ organization_ref: 'org', name: 'Dispensario Demo' }],
      members: [{ organization_ref: 'org', role: 'manager' }], treatments: [], grants: [], deliveries: [],
      batches: [{ organization_ref: 'org', batch_ref: 'lot', state: 'active', product: 'Producto ficticio', lot_code: 'DEMO-01',
        stock_mg: 60000, expires_at: new Date(now + 20 * 86400000).toISOString() }] };
    await page.route('**/api/operations-pilot', route => {
      if (route.request().method() !== 'GET') writes++;
      return route.fulfill({ status: failure ? 503 : 200, json: failure ? {} : data });
    });
    await page.goto(`${base}/?operations&role=dispensary`);
    await page.getByRole('heading', { name: 'Jornada', exact: true }).waitFor();
    await page.getByText('1 lote(s) disponibles vencen en los proximos 30 dias.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox').count(), 0);
    assert.equal(await page.locator('.op-preparation').getAttribute('open'), null);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `scratch/operations-qa/home-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Revisar inventario', exact: true }).click();
    await page.getByRole('heading', { name: 'Inventario por lote' }).waitFor();
    await page.getByRole('searchbox').fill('not found');
    await navigateSection(page, 'Jornada');
    await page.getByRole('button', { name: 'Atender pacientes', exact: true }).click();
    assert.equal(await page.getByRole('searchbox').inputValue(), '');
    await navigateSection(page, 'Jornada');
    failure = true;
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('region', { name: 'Resumen del dispensario' }).count(), 0);
    failure = false;
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await page.getByRole('region', { name: 'Resumen del dispensario' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Jornada', exact: true }).waitFor();
    assert.equal(writes, 0);
    await page.close();
  }
  console.log('PASS home: role entry, five widths, persisted-derived overview, navigation, errors, reload and no writes');
} finally { await browser.close(); }
