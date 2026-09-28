import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.OPERATIONS_TEST_URL ?? 'http://127.0.0.1:4341';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, 'Only the isolated loopback fixture is allowed');
const baseline = process.argv.includes('--baseline');
// Start with a fresh operations fixture: an existing active treatment blocks issuance.
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const failures = [];
const evidence = new URL('../../scratch/medical-note-guard/', import.meta.url);
await mkdir(evidence, { recursive: true });
try {
  const context = await browser.newContext({ timezoneId: 'America/Santiago' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  async function api(role, action, input = {}, path = 'operations-pilot') {
    const response = await context.request.post(`${base}/api/${path}`, {
      headers: { 'privy-id-token': `fixture-${role}` }, data: { action, input: { operationId: randomUUID(), ...input } },
    });
    assert.equal(response.status(), 200, `${action}: ${await response.text()}`);
    return response.json();
  }
  const snapshot = () => api('doctor', 'snapshot');
  async function submit(button, action, status = 200) {
    const response = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST' && r.request().postDataJSON().action === action);
    const refreshed = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'GET');
    await button.click();
    const result = await response;
    assert.equal(result.status(), status);
    await (await refreshed).finished();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Actualizar datos"]')?.disabled);
    return result.request().postDataJSON();
  }
  for (const role of ['doctor', 'patient']) await api(role, 'join', { acceptSyntheticOnly: true });
  async function fresh() {
    const slotRef = randomUUID(), bookingRef = randomUUID();
    const existing = await snapshot();
    const start = Math.max(Date.now() + 86400000, ...existing.bookings.map(b => Date.parse(b.starts_at) + 3600000));
    await api('doctor', 'publish', { slotRef, startsAt: new Date(start).toISOString(), endsAt: new Date(start + 1800000).toISOString() }, 'agenda');
    await api('patient', 'reserve', { slotRef, bookingRef, version: 1 }, 'agenda');
    await api('doctor', 'start-encounter', { resourceRef: bookingRef });
    await page.goto(`${base}/?operations&role=doctor`);
    await page.getByRole('button', { name: /^En atenci/ }).click();
    const row = page.locator('article').filter({ hasText: bookingRef });
    const note = row.getByLabel('Nota de prueba', { exact: true });
    await note.waitFor();
    return { row, note, bookingRef };
  }
  async function run(name, fn) {
    try { await fn(); console.log(`PASS ${name}`); }
    catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
  }
  await run('navigation preserves unsaved note', async () => {
    const { note } = await fresh();
    await note.fill('FICTICIO: borrador de navegacion');
    await page.getByRole('tab', { name: 'Tratamientos', exact: true }).click();
    if (!baseline && await page.getByRole('dialog').isVisible()) {
      await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
    } else {
      await page.getByRole('tab', { name: 'Consultas', exact: true }).click();
    }
    const actual = await note.inputValue();
    console.log(`EVIDENCE navigation draft=${JSON.stringify(actual)}`);
    assert.equal(actual, 'FICTICIO: borrador de navegacion');
  });
  for (const treatment of [true, false]) await run(`dirty completion treatment=${treatment}`, async () => {
    const { row, note, bookingRef } = await fresh();
    const beforeTreatments = (await snapshot()).treatments.map(t => t.treatment_ref);
    await note.fill('FICTICIO: nota sin guardar al finalizar');
    const finish = row.getByRole('button', { name: treatment ? 'Finalizar con tratamiento simulado' : 'Finalizar sin tratamiento', exact: true });
    await finish.click();
    if (baseline) {
      await page.getByRole('button', { name: 'Actualizar datos', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('button[aria-label="Actualizar datos"]')?.disabled);
      const data = await snapshot();
      const encounter = data.encounters.find(e => e.booking_ref === bookingRef);
      const notes = data.notes.filter(n => n.booking_ref === bookingRef);
      console.log(`EVIDENCE treatment=${treatment} state=${encounter.state} notes=${JSON.stringify(notes)}`);
      assert.equal(encounter.state, 'active', 'dirty completion must not close the encounter');
      return;
    }
    await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
    assert.equal(await note.inputValue(), 'FICTICIO: nota sin guardar al finalizar');
    assert.equal((await snapshot()).encounters.find(e => e.booking_ref === bookingRef).state, 'active');
    await finish.click();
    await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    assert.equal(await note.inputValue(), '');
    assert.equal((await snapshot()).encounters.find(e => e.booking_ref === bookingRef).state, 'active', 'discard must not execute completion');
    await note.fill('FICTICIO: nota guardada antes de finalizar');
    await submit(row.getByRole('button', { name: 'Guardar borrador', exact: true }), 'save-note');
    assert.equal((await snapshot()).notes.filter(n => n.booking_ref === bookingRef).at(-1).body, 'FICTICIO: nota guardada antes de finalizar');
    await page.route('**/api/operations-pilot', route => route.request().method() === 'POST' && route.request().postDataJSON().action === 'complete-encounter'
      ? route.fulfill({ status: 503, json: { code: 'ISOLATED_COMPLETE_FAILURE' } }) : route.continue());
    const failed = await submit(finish, 'complete-encounter', 503);
    await page.getByRole('alert').first().waitFor();
    assert.equal(await note.inputValue(), 'FICTICIO: nota guardada antes de finalizar');
    assert.equal((await snapshot()).encounters.find(e => e.booking_ref === bookingRef).state, 'active');
    await page.unroute('**/api/operations-pilot');
    const retried = await submit(page.getByRole('button', { name: 'Reintentar operacion', exact: true }), 'complete-encounter');
    assert.deepEqual(retried, failed, 'uncertain completion retries the identical command');
    const data = await snapshot();
    assert.equal(data.encounters.find(e => e.booking_ref === bookingRef).state, 'completed');
    assert.equal(data.treatments.filter(t => !beforeTreatments.includes(t.treatment_ref)).length, treatment ? 1 : 0);
  });
  if (!baseline) await run('filter, search, refresh and failed save preserve draft', async () => {
    const { row, note, bookingRef } = await fresh();
    const draft = 'FICTICIO: conservar tras error y actualizacion';
    await note.fill(draft);
    await page.getByRole('searchbox').fill('no-matching-booking');
    await page.getByRole('searchbox').fill('');
    assert.equal(await note.inputValue(), draft);
    await page.getByRole('button', { name: /^Pendientes/ }).click();
    await page.getByRole('button', { name: /^En atenci/ }).click();
    assert.equal(await note.inputValue(), draft);
    await page.route('**/api/operations-pilot', route => route.request().method() === 'POST' && route.request().postDataJSON().action === 'save-note'
      ? route.fulfill({ status: 503, json: { code: 'ISOLATED_SAVE_FAILURE' } }) : route.continue());
    const failed = await submit(row.getByRole('button', { name: 'Guardar borrador', exact: true }), 'save-note', 503);
    await page.getByRole('alert').first().waitFor();
    assert.equal(await note.inputValue(), draft);
    assert.equal((await snapshot()).notes.filter(n => n.booking_ref === bookingRef).length, 0);
    await page.unroute('**/api/operations-pilot');
    const refreshed = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await refreshed;
    assert.equal(await note.inputValue(), draft);
    assert.equal(await row.getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true);
    const retried = await submit(page.getByRole('button', { name: 'Reintentar operacion', exact: true }), 'save-note');
    assert.deepEqual(retried, failed, 'uncertain save retries the identical command and operation ID');
    await page.reload();
    await page.getByRole('button', { name: /^En atenci/ }).click();
    assert.equal(await note.inputValue(), draft, 'saved note survives full reload');
  });
  if (!baseline) for (const width of [320, 390, 768, 1024, 1440]) await run(`focus refresh, conflict and authorization loss width=${width}`, async () => {
    await page.setViewportSize({ width, height: 900 });
    const { row, note, bookingRef } = await fresh();
    const draft = 'FICTICIO: borrador local conservado ante conflicto';
    await note.fill(draft);
    const refresh = async event => {
      const response = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'GET');
      await page.evaluate(name => window.dispatchEvent(new Event(name)), event);
      await (await response).finished();
    };
    await refresh('focus');
    assert.equal(await note.inputValue(), draft);
    await api('doctor', 'save-note', { resourceRef: bookingRef, version: 1, note: 'FICTICIO: nota de otra sesion' });
    await refresh('focus');
    assert.equal(await note.inputValue(), draft, 'new server version cannot overwrite local draft');
    await row.getByRole('button', { name: 'Usar version actual y conservar borrador', exact: true }).waitFor();
    await submit(row.getByRole('button', { name: 'Guardar borrador', exact: true }), 'save-note', 409);
    await row.getByRole('alert').waitFor();
    assert.equal(await note.inputValue(), draft);
    assert.equal((await snapshot()).notes.filter(n => n.booking_ref === bookingRef).length, 1, 'conflict did not overwrite remote note');
    await page.getByRole('tab', { name: 'Tratamientos', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'dialog fits viewport');
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) <= 2, 'dialog is horizontally centered');
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - 450) <= 2, 'dialog is vertically centered');
    for (const button of await dialog.getByRole('button').all()) {
      const buttonBounds = await button.boundingBox();
      assert.ok(buttonBounds && buttonBounds.height >= 44, 'dialog buttons have at least 44px height');
    }
    assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, 'dialog has no horizontal overflow');
    assert.equal(await page.getByRole('button', { name: 'Seguir editando', exact: true }).evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if ([390, 1440].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`dirty-note-dialog-${width}.png`, evidence)), fullPage: false });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('tab', { name: 'Tratamientos', exact: true }).evaluate(el => el === document.activeElement), true, 'Escape restores invoking tab focus');
    assert.equal(await note.inputValue(), draft);
    await row.getByRole('button', { name: 'Usar version actual y conservar borrador', exact: true }).click();
    assert.equal(await note.inputValue(), draft);
    const adopted = await submit(row.getByRole('button', { name: 'Guardar borrador', exact: true }), 'save-note');
    assert.equal(adopted.input.version, 2, 'only explicit conflict resolution adopts the server version');
    await note.fill('FICTICIO: pendiente confidencial');
    await page.route('**/api/operations-pilot', route => route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: {} }) : route.continue());
    const uncertain = await submit(row.getByRole('button', { name: 'Guardar borrador', exact: true }), 'save-note', 503);
    await page.getByRole('button', { name: 'Reintentar operacion', exact: true }).waitFor();
    await page.unroute('**/api/operations-pilot');
    await page.route('**/api/operations-pilot', route => route.request().method() === 'GET'
      ? route.fulfill({ status: 403, json: {} }) : route.continue());
    await refresh('online');
    await note.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Reintentar operacion', exact: true }).count(), 0, 'GET 403 hides session-bound pending command');
    await page.unroute('**/api/operations-pilot');
    await refresh('online');
    await note.waitFor();
    assert.equal(await note.inputValue(), draft, '403 clears unsaved confidential draft, retaining only saved server note');
    assert.equal(await row.getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true, 'no new mutation before uncertain retry');
    const recovered = await submit(page.getByRole('button', { name: 'Reintentar operacion', exact: true }), 'save-note');
    assert.deepEqual(recovered, uncertain);
    await note.fill('FICTICIO: solo identidad doctor');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'patient' })));
    await page.getByRole('tab', { name: 'Mi atencion', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Nota de prueba', { exact: true }).count(), 0);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'doctor' })));
    await page.getByRole('button', { name: /^En atenci/ }).click();
    assert.equal(await note.inputValue(), 'FICTICIO: pendiente confidencial', 'identity change clears session-local draft');
  });
  if (!baseline) await run('committed lost save, GET403, authorized retry persists exactly one note', async () => {
    const { row, note, bookingRef } = await fresh();
    const text = 'FICTICIO: guardado confirmado solo tras recuperar acceso';
    await note.fill(text);
    let denyRead = false;
    await page.route('**/api/operations-pilot', async route => {
      const request = route.request();
      if (request.method() === 'POST' && request.postDataJSON().action === 'save-note') {
        const committed = await route.fetch();
        assert.equal(committed.status(), 200);
        denyRead = true;
        return route.fulfill({ status: 503, json: {} });
      }
      if (denyRead && request.method() === 'GET') return route.fulfill({ status: 403, json: {} });
      return route.continue();
    });
    const uncertain = await submit(row.getByRole('button', { name: 'Guardar borrador', exact: true }), 'save-note', 503);
    await note.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Reintentar operacion', exact: true }).count(), 0);
    // Dispatch only: no real navigation or native browser confirmation is required.
    const unloadPrevented = () => page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(await unloadPrevented(), true, 'uncertain clinical command warns on unload even when GET403 removes the visible role');
    assert.equal((await snapshot()).notes.filter(n => n.booking_ref === bookingRef).length, 1);
    await page.unroute('**/api/operations-pilot');
    const refreshed = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'GET');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await (await refreshed).finished();
    await note.waitFor();
    assert.equal(await row.getByRole('button', { name: 'Guardar borrador', exact: true }).isDisabled(), true);
    const retried = await submit(page.getByRole('button', { name: 'Reintentar operacion', exact: true }), 'save-note');
    assert.deepEqual(retried, uncertain, 'lost committed save retains exact operation ID and payload');
    const notes = (await snapshot()).notes.filter(n => n.booking_ref === bookingRef);
    assert.equal(notes.length, 1, 'idempotent retry cannot create a second note');
    assert.equal(notes[0].body, text);
    assert.equal(await note.inputValue(), text);
    assert.equal(await unloadPrevented(), false, 'successful retry and fresh snapshot remove the unload warning');
  });
  assert.deepEqual(errors, [], 'no browser runtime errors');
  assert.deepEqual(failures, [], baseline ? 'Baseline reproduced unsaved-note defects' : 'Medical note guard regressions');
} finally { await browser.close(); }
