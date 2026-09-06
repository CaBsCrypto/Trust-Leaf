import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  for (const mode of ['both', 'storage-only', 'channel-only', 'focus-recovery']) {
    const context = await browser.newContext();
    if (mode === 'storage-only' || mode === 'focus-recovery') await context.addInitScript(() => { window.BroadcastChannel = undefined; });
    if (mode === 'focus-recovery') await context.addInitScript(() => {
      const add = window.addEventListener.bind(window);
      window.addEventListener = (type, ...args) => { if (type !== 'storage') add(type, ...args); };
    });
    if (mode === 'channel-only') await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'trustleaf.session-change.v1') throw new Error('fixture storage blocked');
        return original.call(this, key, value);
      };
    });
    const first = await context.newPage(); const second = await context.newPage();
    let loads = 0;
    second.on('request', request => { if (request.isNavigationRequest() && request.frame() === second.mainFrame()) loads++; });
    const url = 'http://127.0.0.1:4318/?crossTab=1';
    await first.goto(url); await second.goto(url);
    await first.getByText('doctor', { exact: true }).waitFor();
    await second.getByText('doctor', { exact: true }).waitFor();
    await first.getByRole('button', { name: 'Switch to patient' }).click();
    if (mode === 'focus-recovery') await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await second.getByText('patient', { exact: true }).waitFor();
    assert.equal(loads, 2, 'receiver reloads once without an echo loop');
    await first.getByRole('button', { name: 'Sign out', exact: true }).click();
    if (mode === 'focus-recovery') await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await second.getByText('signed-out', { exact: true }).waitFor();
    assert.equal(loads, 3);
    const revision = await first.evaluate(() => localStorage.getItem('trustleaf.session-change.v1'));
    if (mode === 'channel-only') assert.equal(revision, null);
    else assert.match(revision, /^[0-9a-f-]{36}$/i, 'only an opaque revision, not identity or token');
    assert.equal(await first.getByTestId('actor').innerText(), 'signed-out');
    console.log(`PASS cross-tab account change/logout, no reload echo, opaque marker (${mode})`);
    await context.close();
  }
} finally { await browser.close(); }
