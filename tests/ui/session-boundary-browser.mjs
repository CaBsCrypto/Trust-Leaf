import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  let observed;
  const started = new Promise(resolve => { observed = resolve; });
  await page.route('**/fixture-session?**', async route => {
    const actor = new URL(route.request().url()).searchParams.get('actor');
    if (actor === 'doctor') { observed(); await delayed; }
    await route.fulfill({ json: { email: `${actor}@example.test` } });
  });
  await page.goto('http://127.0.0.1:4318/?role=doctor&sessionProbe=1');
  await page.getByRole('button', { name: 'Verify fixture session' }).click();
  await started;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'patient' })));
  await page.getByRole('button', { name: 'Verify fixture session' }).click();
  await page.getByText('patient@example.test', { exact: true }).waitFor();
  const oldResponse = page.waitForResponse(response => response.url().endsWith('actor=doctor'));
  release(); await oldResponse;
  // Let the retired component's async callback complete before checking its replacement.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.getByTestId('session-email').innerText(), 'patient@example.test');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'signed-out' })));
  await page.getByText('patient@example.test', { exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await page.getByTestId('session-email').innerText(), '');
  console.log('PASS session boundary: delayed prior identity response and logout reset (synthetic provider)');
} finally { await browser.close(); }
