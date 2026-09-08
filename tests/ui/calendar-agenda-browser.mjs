import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const baseUrl = process.env.AGENDA_FIXTURE_URL ?? 'http://127.0.0.1:4318';
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/, 'synthetic calendar tests must stay local');
const browser = await chromium.launch({headless:true, channel:process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'});
try {
  for (const role of ['doctor','patient']) {
    const page = await browser.newPage();
    let reads=0, cancelled=false, status=200;
    await page.route('**/api/agenda**', async route => {
      assert.equal(route.request().method(), 'GET', 'refresh must never mutate reservations');
      reads++;
      if (status !== 200) return route.fulfill({ status, json: {} });
      const start=new Date(); start.setHours(18,0,0,0);
      await route.fulfill({json:{role,slots:[{slotRef:'test-slot',doctorRef:'test-doctor',
        startsAt:start.toISOString(),endsAt:new Date(start.getTime()+1800000).toISOString(),
        state:cancelled?'cancelled':'booked',version:2,bookingRef:'test-booking',bookingState:cancelled?'cancelled':'confirmed',
        conference:reads===1?{state:'pending'}:{state:'ready',meetUrl:'https://meet.google.com/abc-defg-hij'}}]}});
    });
    await page.goto(`${baseUrl}/?role=${role}`);
    const join=page.getByRole('link',{name:'Unirse a consulta'});
    await join.waitFor({state:'visible',timeout:25000});
    assert.equal(await join.getAttribute('href'),'https://meet.google.com/abc-defg-hij');
    assert.ok(reads>=2,'must refresh pending conference automatically');
    status=503;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alert').waitFor({ timeout: 5000 });
    assert.equal(await join.count(), 1, 'transient failure preserves the usable agenda');
    status=200;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.getByRole('alert').waitFor({ state:'hidden', timeout:5000 });
    cancelled=true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByText('Cancelada', { exact:true }).waitFor({ timeout:5000 });
    assert.equal(await join.count(), 0, 'cancellation removes a previously ready Meet link');
    status=403;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alert').waitFor({ timeout:5000 });
    assert.equal(await page.locator('li').count(), 0, 'authorization loss clears protected appointments');
    console.log(`PASS ${role}: pending Meet, ready agenda refresh, cancellation, transient recovery and authorization loss without manual refresh`);
    await page.close();
  }
} finally { await browser.close(); }
