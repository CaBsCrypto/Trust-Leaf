import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE + '/index.mjs').href);
const base = process.env.OPERATIONS_TEST_URL ?? 'http://127.0.0.1:4321';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const token = 'A'.repeat(43), old = 'B'.repeat(43);
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const requests = [], external = [];
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (!url.startsWith(base + '/')) { external.push(url); return route.abort(); }
      if (!url.includes('/api/')) return route.continue();
      const body = route.request().postDataJSON();
      requests.push({ url, body });
      assert.equal(body.action, 'inspect', 'navigation must not accept or write');
      return route.fulfill({ json: url.endsWith('/team-invitations') ? { organizationName: 'Synthetic team', accepted: false } : { accepted: false } });
    });
    await page.goto(base + '/dispensario?role=signed-out');
    await page.evaluate(old => {
      for (const key of ['trustleaf-team-invitation', 'trustleaf-dispensary-invitation']) sessionStorage.setItem(key, JSON.stringify({ token: old, until: Date.now() + 100000 }));
    }, old);
    await page.goto(base + '/dispensario?role=newManager#dispensary-invite=' + token);
    await page.getByRole('heading', { name: 'Invitacion para encargado', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Invitacion al equipo', exact: true }).count(), 0);
    assert.ok(requests.every(r => r.url.endsWith('/dispensary-onboarding') && r.body.token === token));
    assert.ok(!page.url().includes('#'));
    await page.reload();
    await page.getByRole('heading', { name: 'Invitacion para encargado', exact: true }).waitFor();
    await page.getByRole('checkbox').check();
    await page.evaluate(old => { location.hash = 'team-invite=' + old; }, old);
    await page.getByRole('heading', { name: 'Invitacion al equipo', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox').isChecked(), false);
    await page.reload();
    await page.getByRole('heading', { name: 'Invitacion al equipo', exact: true }).waitFor();
    await page.evaluate(token => { location.hash = 'dispensary-invite=' + token; }, token);
    await page.getByRole('heading', { name: 'Invitacion para encargado', exact: true }).waitFor();
    await page.evaluate(() => { location.hash = 'team-invite=invalid'; });
    await page.getByRole('heading', { name: 'Invitacion no valida', exact: true }).waitFor();
    const before = requests.length;
    await page.reload();
    await page.getByRole('heading', { name: 'Invitacion no valida', exact: true }).waitFor();
    assert.equal(requests.length, before);
    assert.equal(await page.getByRole('button', { name: 'Aceptar invitacion', exact: true }).count(), 0);
    assert.deepEqual(external, []);
    await page.close();
  }
  console.log('PASS browser: explicit manager/worker routing, stale legacy tokens, reload, hashchange, consent reset, invalid link; no writes or external requests. Synthetic identity, not live Privy.');
} finally { await browser.close(); }
