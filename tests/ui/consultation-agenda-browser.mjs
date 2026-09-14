import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.AGENDA_FIXTURE_URL ?? 'http://127.0.0.1:4321';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
await mkdir('scratch/operations-qa', { recursive: true });
try {
  for (const role of ['doctor', 'patient']) for (const timezoneId of ['America/Santiago', 'Asia/Tokyo']) {
    const page = await browser.newPage({ timezoneId, viewport: { width: 390, height: 844 } });
    const writes = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const booking = { booking_ref: 'selected-booking', starts_at: '2025-01-02T01:30:00Z', patient_ref: 'patient', doctor_ref: 'doctor', state: 'confirmed' };
    let missing = false, failed = false, requests = [];
    await page.route('**/api/**', async route => {
      const r = route.request();
      if (r.method() !== 'GET') writes.push(r.url());
      if (r.url().includes('/api/operations-pilot')) return route.fulfill({ json: { synthetic: true, joined: true, role: r.headers()['privy-id-token'] === 'fixture-admin' ? 'admin' : role, bookings: [booking], encounters: [], notes: [], treatments: [], deliveries: [], organizations: [] } });
      if (r.url().includes('/api/agenda?')) {
        requests.push(new URL(r.url()));
        return route.fulfill({ status: failed ? 503 : 200, json: { role, slots: missing ? [] : [{ slotRef: 'slot', doctorRef: 'doctor', startsAt: booking.starts_at, endsAt: new Date(Date.parse(booking.starts_at) + 1800000).toISOString(), state: 'reserved', version: 1, bookingRef: booking.booking_ref, bookingState: booking.state, conference: { state: 'ready', meetUrl: 'https://meet.google.com/abc-defg-hij' } }] } });
      }
      return route.fulfill({ json: {} });
    });
    await page.context().route('https://meet.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Isolated Meet destination</p>' }));
    await page.goto(`${base}/?operations&role=${role}`);
    for (const startsAt of ['2025-01-02T01:30:00Z', '2030-12-31T23:30:00Z']) {
      booking.starts_at = startsAt;
      await page.reload();
      await page.getByRole('button', { name: 'Ver en agenda' }).waitFor();
      await page.getByRole('searchbox').fill('selected');
      await page.getByRole('button', { name: 'Ver en agenda' }).click();
      const selected = page.locator('li[aria-current="true"]');
      await selected.waitFor();
      const expected = await page.evaluate(value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, startsAt);
      assert.equal(await page.getByLabel('Inicio de semana').inputValue(), expected);
      assert.equal(await page.getByRole('searchbox').count(), 0);
      assert.ok(Date.parse(requests.at(-1).searchParams.get('from')) <= Date.parse(startsAt));
      assert.ok(Date.parse(requests.at(-1).searchParams.get('to')) > Date.parse(startsAt));
      assert.match(await selected.innerText(), /selected-booking/);
      const box = await selected.boundingBox();
      assert.ok(box.y < 844 && box.y + box.height > 0, 'selected booking scrolled into viewport');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (timezoneId === 'America/Santiago') await page.screenshot({ path: `scratch/operations-qa/agenda-target-${role}-mobile.png`, fullPage: true });
      assert.equal(await selected.getByRole('link', { name: 'Unirse a consulta' }).getAttribute('href'), 'https://meet.google.com/abc-defg-hij');
      const popupEvent = page.waitForEvent('popup');
      await selected.getByRole('link', { name: 'Unirse a consulta' }).click();
      const popup = await popupEvent;
      await popup.getByText('Isolated Meet destination').waitFor();
      await popup.close();
      await page.getByRole('tab', { name: role === 'doctor' ? 'Consultas' : 'Mi atencion', exact: true }).click();
      assert.equal(await page.getByRole('searchbox').inputValue(), '');
      await page.getByRole('button', { name: 'Ver en agenda' }).click();
      await selected.waitFor();
    }
    failed = true;
    await page.getByRole('button', { name: 'Actualizar agenda', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Actualizar reserva' }).count(), 0, 'network failure is not missing booking');
    failed = false; missing = true;
    await page.getByRole('button', { name: 'Actualizar agenda', exact: true }).click();
    await page.getByRole('button', { name: 'Actualizar reserva' }).waitFor();
    missing = false; booking.state = 'cancelled';
    await page.getByRole('button', { name: 'Actualizar reserva' }).click();
    await page.locator('li[aria-current="true"]').waitFor();
    assert.equal(await page.getByRole('link', { name: 'Unirse a consulta' }).count(), 0);
    await page.setViewportSize({ width: 1365, height: 900 });
    if (timezoneId === 'America/Santiago') await page.screenshot({ path: `scratch/operations-qa/agenda-target-${role}-desktop.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'admin' })));
    await page.getByRole('heading', { name: 'Supervision del piloto' }).waitFor();
    assert.equal(await page.locator('li[aria-current="true"]').count(), 0);
    booking.state = 'confirmed';
    await page.evaluate(actor => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: actor })), role);
    await page.getByRole('button', { name: 'Ver en agenda' }).waitFor();
    await page.getByRole('tab', { name: 'Agenda', exact: true }).click();
    await page.getByLabel('Inicio de semana').waitFor();
    assert.equal(await page.locator('li[aria-current="true"]').count(), 0, 'previous identity selection discarded');
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS consultation navigation: both roles, timezones, historical/future dates, search, scroll, error recovery, cancellation, responsive layout, session reset, no writes.');
} finally { await browser.close(); }
