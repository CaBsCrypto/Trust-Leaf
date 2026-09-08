import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const output = new URL('../../scratch/operations-qa/', import.meta.url);
const baseUrl = process.env.OPERATIONS_TEST_URL ?? 'http://127.0.0.1:4321';
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/, 'synthetic browser tests must stay local');
await mkdir(output, { recursive: true });
const errors = [], pages = {};
const form = (page, button) => page.locator('form').filter({ has: page.getByRole('button', { name: button, exact: true }) });
async function refresh(page) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click(); return (await response).json();
}
async function command(page, name) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST');
  await page.getByRole('button', { name, exact: true }).click();
  const r = await response; assert.equal(r.status(), 200, `${name}: ${await r.text()}`);
  await refresh(page);
}
try {
  for (const role of ['doctor', 'patient', 'dispensary', 'dispensaryB', 'admin']) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, timezoneId: 'America/Santiago' });
    const page = await context.newPage(); pages[role] = page;
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${baseUrl}/?operations&role=${role}`);
    await command(page, 'Aceptar y participar');
  }
  const { doctor, patient, dispensary, dispensaryB, admin } = pages;
  await admin.getByRole('tab', { name: 'Organizaciones', exact: true }).click();
  await admin.getByText('No hay organizaciones registradas.', { exact: true }).waitFor();
  await admin.getByRole('tab', { name: 'Actividad', exact: true }).click();
  await doctor.getByRole('tab', { name: 'Agenda', exact: true }).click();
  await doctor.getByLabel('Hora', { exact: true }).fill('14:00');
  await doctor.getByRole('button', { name: 'Publicar horario', exact: true }).click();
  await doctor.getByText('Disponible', { exact: true }).waitFor();
  await patient.getByRole('tab', { name: 'Agenda', exact: true }).click();
  await patient.getByRole('button', { name: 'Reservar', exact: true }).click();
  await patient.getByText('Cita confirmada', { exact: true }).waitFor();
  await doctor.getByRole('tab', { name: 'Consultas', exact: true }).click(); await refresh(doctor);
  await command(doctor, 'Iniciar consulta simulada');
  await doctor.getByLabel('Nota de prueba', { exact: true }).fill('NOTA FICTICIA PARA QA: consulta simulada, sin datos reales.');
  await command(doctor, 'Guardar borrador');
  assert.deepEqual((await refresh(patient)).notes, [], 'patient cannot read an unfinished clinical draft');
  await command(doctor, 'Finalizar con tratamiento simulado');
  assert.equal((await refresh(patient)).notes.length, 1, 'completed notes are available to the related patient');
  await doctor.getByText('Atencion finalizada', { exact: true }).waitFor();
  for (const [page, name] of [[dispensary, 'Dispensario A QA'], [dispensaryB, 'Dispensario B QA']]) {
    await page.getByRole('tab', { name: 'Equipo', exact: true }).click();
    await page.getByLabel('Nombre del dispensario', { exact: true }).fill(name);
    await command(page, 'Crear dispensario de prueba');
    await page.getByRole('tab', { name: 'Inventario', exact: true }).click();
    await page.getByLabel('Codigo de lote', { exact: true }).fill('LOTE-QA-001');
    await page.getByLabel('Referencia de origen', { exact: true }).fill('ORIGEN FICTICIO QA');
    await page.getByLabel('Vencimiento', { exact: true }).fill('2027-12-01T12:00');
    await command(page, 'Recibir lote simulado');
  }
  await patient.getByRole('tab', { name: 'Tratamientos', exact: true }).click(); await refresh(patient);
  for (const name of ['Dispensario A QA', 'Dispensario B QA']) {
    const row = patient.locator('.op-line').filter({ hasText: name });
    const response = patient.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST');
    await row.getByRole('button', { name: 'Autorizar 24 horas' }).click(); assert.equal((await response).status(), 200); await refresh(patient);
  }
  for (const [page, grams] of [[dispensary, '10'], [dispensaryB, '20']]) {
    await page.getByRole('tab', { name: 'Atenciones', exact: true }).click(); await refresh(page);
    const delivery = form(page, 'Registrar entrega simulada');
    await delivery.getByLabel('Lote', { exact: true }).selectOption({ index: 1 });
    await delivery.getByLabel('Cantidad en gramos', { exact: true }).fill(grams);
    await command(page, 'Registrar entrega simulada');
  }
  await patient.reload(); await patient.getByRole('tab', { name: 'Tratamientos', exact: true }).click();
  await patient.locator('.op-stats div').filter({ hasText: 'Disponible ahora' }).getByText('0 g', { exact: true }).waitFor();
  assert.equal(await dispensaryB.getByRole('button', { name: 'Registrar entrega simulada', exact: true }).isDisabled(), true, 'exhausted period disables another delivery');
  await patient.getByRole('tab', { name: 'Historial', exact: true }).click();
  assert.equal(await patient.locator('.op-reference').filter({ hasText: 'Comprobante:' }).count(), 2);
  await refresh(admin); assert.equal(await admin.getByText('NOTA FICTICIA', { exact: false }).count(), 0);
  for (const [role, page] of Object.entries(pages)) {
    for (const [size, viewport] of [['desktop', { width: 1365, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${role} ${size} horizontal overflow`);
      await page.screenshot({ path: fileURLToPath(new URL(`${role}-${size}.png`, output)), fullPage: true });
    }
  }
  // An in-flight draft and its contents must not survive an identity transition.
  await doctor.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'otherPatient' })));
  await doctor.getByRole('heading', { name: 'Mi atencion', exact: true }).waitFor();
  assert.equal(await doctor.getByText('NOTA FICTICIA PARA QA:', { exact: false }).count(), 0);
  const recover = await (await browser.newContext()).newPage();
  await recover.goto(`${baseUrl}/?operations&role=operator`);
  await command(recover, 'Aceptar y participar');
  await recover.getByRole('tab', { name: 'Equipo', exact: true }).click();
  await recover.getByLabel('Nombre del dispensario', { exact: true }).fill('Organizacion recuperada QA');
  const operationIds = [];
  await recover.route('**/api/operations-pilot', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    operationIds.push(route.request().postDataJSON().input.operationId);
    const response = await route.fetch(); assert.equal(response.status(), 200);
    return operationIds.length === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ response });
  });
  await recover.getByRole('button', { name: 'Crear dispensario de prueba', exact: true }).click();
  await recover.getByRole('button', { name: 'Reintentar operacion', exact: true }).waitFor();
  await command(recover, 'Reintentar operacion');
  await recover.getByRole('heading', { name: 'Organizacion recuperada QA', exact: true }).waitFor();
  assert.equal(operationIds.length, 2); assert.equal(operationIds[0], operationIds[1], 'recovery reuses the committed operation ID');
  await recover.unroute('**/api/operations-pilot');
  await recover.getByRole('tab', { name: 'Inventario', exact: true }).click();
  await recover.getByLabel('Codigo de lote', { exact: true }).fill('LOTE-RECOVERY-001');
  await recover.getByLabel('Referencia de origen', { exact: true }).fill('ORIGEN FICTICIO RECOVERY');
  await recover.getByLabel('Vencimiento', { exact: true }).fill('2027-12-01T12:00');
  await command(recover, 'Recibir lote simulado');
  const otherSession = await (await browser.newContext()).newPage();
  otherSession.on('pageerror', e => errors.push(e.message));
  await otherSession.goto(`${baseUrl}/?operations&role=operator`);
  await otherSession.getByRole('tab', { name: 'Inventario', exact: true }).click();
  await otherSession.getByText('100 g', { exact: false }).waitFor();

  // A rejected write must not invalidate every subsequent background read.
  const adjustment = form(recover, 'Registrar ajuste');
  await adjustment.getByLabel('Variacion en gramos (+/-)', { exact: true }).fill('-200');
  await adjustment.getByLabel('Motivo del ajuste', { exact: true }).fill('RECHAZO FICTICIO SIN STOCK');
  const rejected = recover.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST');
  await adjustment.getByRole('button', { name: 'Registrar ajuste', exact: true }).click();
  assert.equal((await rejected).status(), 409);
  await recover.getByRole('alert').waitFor();
  const otherAdjustment = form(otherSession, 'Registrar ajuste');
  await otherAdjustment.getByLabel('Variacion en gramos (+/-)', { exact: true }).fill('10');
  await otherAdjustment.getByLabel('Motivo del ajuste', { exact: true }).fill('AJUSTE FICTICIO OTRA SESION');
  await command(otherSession, 'Registrar ajuste');
  await recover.evaluate(() => window.dispatchEvent(new Event('focus')));
  await recover.getByText('110 g', { exact: false }).waitFor({ timeout: 5000 });
  assert.match(await recover.getByRole('alert').innerText(), /El registro cambio/, 'background success does not hide a rejected action');
  await refresh(recover);
  await recover.getByRole('alert').waitFor({ state: 'hidden' });
  await recover.route('**/api/operations-pilot', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, json: {} }) : route.continue());
  await refresh(recover);
  await recover.getByRole('alert').waitFor();
  await recover.unroute('**/api/operations-pilot');
  await recover.evaluate(() => window.dispatchEvent(new Event('online')));
  await recover.getByRole('alert').waitFor({ state: 'hidden', timeout: 5000 });
  await otherSession.close();
  await recover.close();
  await patient.route('**/api/operations-pilot', route => route.fulfill({ status: 403, json: {} }));
  await refresh(patient);
  await patient.getByRole('alert').waitFor();
  assert.equal(await patient.locator('.op-reference').count(), 0, 'authorization loss clears cached medical and delivery records');
  assert.deepEqual(errors, []);
  console.log('PASS: browser + actual isolated SQL: join, publish, reserve, consult, draft, issue, organizations, lots, consent, 10g + 20g deliveries, persistent history, privacy, desktop/mobile, identity reset, rejected-write refresh across sessions and reconnection.');
} catch (error) {
  for (const [role, page] of Object.entries(pages)) await page.screenshot({ path: fileURLToPath(new URL(`failure-${role}.png`, output)), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
