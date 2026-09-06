import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const failures = [];
try {
  for (const scenario of ['identity-change', 'saved-refresh-failure']) {
    const page = await browser.newPage();
    let writes = 0;
    await page.route('**/api/agenda**', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        writes++;
        return route.fulfill({ status: scenario === 'identity-change' ? 503 : 200, json: {} });
      }
      if (writes && scenario === 'saved-refresh-failure') return route.fulfill({ status: 429, json: {} });
      return route.fulfill({ json: { role: request.headers()['privy-id-token'].includes('patient') ? 'patient' : 'doctor', slots: [] } });
    });
    await page.goto('http://127.0.0.1:4318/?role=doctor');
    await page.getByRole('button', { name: 'Publicar horario', exact: true }).click();
    try {
      if (scenario === 'identity-change') {
        await page.getByRole('button', { name: 'Reintentar cambio' }).waitFor();
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'patient' })));
        await page.getByRole('heading', { name: 'Horarios y citas' }).waitFor();
        await page.getByRole('status').filter({ hasText: 'Cargando' }).waitFor({ state: 'hidden' });
        assert.equal(await page.getByRole('button', { name: 'Reintentar cambio' }).count(), 0, 'old actor command must be discarded');
      } else {
        await page.getByText('Cambio guardado.', { exact: true }).waitFor();
        await page.getByRole('alert').waitFor();
        assert.match(await page.getByRole('alert').innerText(), /guardado.*actualizar/i, 'read failure must not imply failed write');
        assert.equal(await page.getByRole('button', { name: 'Reintentar cambio' }).count(), 0);
      }
      assert.equal(writes, 1);
      console.log(`PASS ${scenario}`);
    } catch (error) { failures.push(`${scenario}: ${error.message}`); }
    await page.close();
  }
  assert.deepEqual(failures, []);
} finally { await browser.close(); }
