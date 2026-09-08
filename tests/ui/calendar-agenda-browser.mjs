import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({headless:true, channel:process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'});
try {
  for (const role of ['doctor','patient']) {
    const page = await browser.newPage();
    let reads=0;
    await page.route('**/api/agenda**', async route => {
      assert.equal(route.request().method(), 'GET', 'refresh must never mutate reservations');
      reads++;
      const start=new Date(); start.setHours(18,0,0,0);
      await route.fulfill({json:{role,slots:[{slotRef:'test-slot',doctorRef:'test-doctor',
        startsAt:start.toISOString(),endsAt:new Date(start.getTime()+1800000).toISOString(),
        state:'booked',version:2,bookingRef:'test-booking',bookingState:'confirmed',
        conference:reads===1?{state:'pending'}:{state:'ready',meetUrl:'https://meet.google.com/abc-defg-hij'}}]}});
    });
    await page.goto(`http://127.0.0.1:4318/?role=${role}`);
    const join=page.getByRole('link',{name:'Unirse a consulta'});
    await join.waitFor({state:'visible',timeout:25000});
    assert.equal(await join.getAttribute('href'),'https://meet.google.com/abc-defg-hij');
    assert.ok(reads>=2,'must refresh pending conference automatically');
    console.log(`PASS ${role}: pending Meet becomes joinable without manual refresh`);
    await page.close();
  }
} finally { await browser.close(); }
