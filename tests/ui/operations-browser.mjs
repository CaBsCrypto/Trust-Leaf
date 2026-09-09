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
async function agendaCommand(page, button) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/agenda') && r.request().method() === 'POST');
  await button.click();
  const r = await response; assert.equal(r.status(), 200, await r.text());
  await page.getByText('Cargando agenda...', { exact: true }).waitFor({ state: 'hidden' });
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

  // Cancel and complete without treatment from the same interfaces, not SQL updates.
  for (const [hour, cancel] of [['15:00', true], ['16:00', false]]) {
    await doctor.getByRole('tab', { name: 'Agenda', exact: true }).click();
    await doctor.getByLabel('Hora', { exact: true }).fill(hour);
    await agendaCommand(doctor, doctor.getByRole('button', { name: 'Publicar horario', exact: true }));
    await doctor.getByText('Disponible', { exact: true }).waitFor();
    await patient.evaluate(() => window.dispatchEvent(new Event('focus')));
    await patient.getByRole('button', { name: 'Reservar', exact: true }).waitFor({ timeout: 5000 });
    const before = await refresh(patient);
    await agendaCommand(patient, patient.getByRole('button', { name: 'Reservar', exact: true }));
    const after = await refresh(patient);
    const booking = after.bookings.find(b => !before.bookings.some(old => old.booking_ref === b.booking_ref));
    assert.ok(booking, 'booking is persisted for the related patient');
    if (cancel) {
      patient.once('dialog', dialog => dialog.accept());
      await agendaCommand(patient, patient.locator('li').filter({ hasText: booking.booking_ref }).getByRole('button', { name: 'Cancelar cita', exact: true }));
      await doctor.getByRole('tab', { name: 'Consultas', exact: true }).click();
      const cancelled = await refresh(doctor);
      assert.equal(cancelled.bookings.find(b => b.booking_ref === booking.booking_ref).state, 'cancelled');
      const row = doctor.locator('article').filter({ hasText: booking.booking_ref });
      await row.getByText('Cancelada', { exact: true }).waitFor();
      assert.equal(await row.getByRole('button', { name: 'Iniciar consulta simulada' }).count(), 0);
      await doctor.getByRole('tab', { name: 'Agenda', exact: true }).click();
      doctor.once('dialog', dialog => dialog.accept());
      await agendaCommand(doctor, doctor.getByRole('button', { name: 'Retirar horario', exact: true }));
    } else {
      await doctor.getByRole('tab', { name: 'Consultas', exact: true }).click(); await refresh(doctor);
      await command(doctor, 'Iniciar consulta simulada');
      doctor.once('dialog', dialog => dialog.accept());
      await command(doctor, 'Finalizar sin tratamiento');
      const completed = await refresh(patient);
      assert.equal(completed.encounters.find(e => e.booking_ref === booking.booking_ref).state, 'completed');
      assert.equal(completed.treatments.length, before.treatments.length, 'closing without treatment does not create a prescription');
    }
  }
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
  const operator = await (await browser.newContext({ viewport: { width: 1365, height: 900 }, timezoneId: 'America/Santiago' })).newPage();
  pages.operator = operator; operator.on('pageerror', e => errors.push(e.message));
  await dispensary.getByRole('tab', { name: 'Equipo', exact: true }).click();
  await dispensary.getByLabel('Correo del trabajador', { exact: true }).fill('operator@example.test');
  await dispensary.getByRole('button', { name: 'Preparar invitacion', exact: true }).click();
  await dispensary.getByRole('group', { name: 'Confirmar invitacion' }).waitFor();
  for (const [name, width, height] of [['desktop', 1365, 900], ['mobile', 390, 844]]) {
    await dispensary.setViewportSize({ width, height });
    assert.equal(await dispensary.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await dispensary.screenshot({ path: fileURLToPath(new URL(`team-invitation-${name}.png`, output)), fullPage: true });
  }
  await dispensary.setViewportSize({ width: 1365, height: 900 });
  const invitationSent = dispensary.waitForResponse(r => r.url().endsWith('/api/team-invitations') && r.request().postDataJSON()?.action === 'create');
  await dispensary.getByRole('button', { name: 'Enviar invitacion', exact: true }).click();
  assert.equal((await invitationSent).status(), 200);
  const emails = await (await dispensary.request.get(`${baseUrl}/__team-mail`)).json();
  const invitationToken = emails.find(m => m.to[0] === 'operator@example.test').text.match(/#team-invite=([A-Za-z0-9_-]+)/)[1];
  await operator.goto(`${baseUrl}/dispensario?operations&role=patient#team-invite=${invitationToken}`);
  await operator.getByRole('alert').waitFor();
  assert.equal(await operator.getByRole('button', { name: 'Aceptar invitacion como operador' }).count(), 0);
  assert.equal(new URL(operator.url()).hash, '', 'token removed from the address bar');
  await operator.getByRole('button', { name: 'Usar otra cuenta' }).click();
  await operator.getByText('Sin sesion', { exact: true }).waitFor();
  await operator.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'operator' })));
  await operator.getByRole('button', { name: 'Aceptar invitacion como operador' }).waitFor();
  assert.equal(await operator.getByRole('button', { name: 'Aceptar invitacion como operador' }).isDisabled(), true);
  await operator.getByRole('checkbox').check();
  const accepted = operator.waitForResponse(r => r.url().endsWith('/api/team-invitations') && r.request().postDataJSON()?.action === 'accept');
  await operator.getByRole('button', { name: 'Aceptar invitacion como operador' }).click();
  assert.equal((await accepted).status(), 200);
  await operator.goto(`${baseUrl}/?operations&role=operator`);
  await operator.reload();
  await operator.getByRole('tab', { name: 'Equipo', exact: true }).click();
  await operator.getByText('Operador', { exact: true }).first().waitFor();
  assert.equal(await operator.getByRole('button', { name: 'Agregar operador', exact: true }).count(), 0);
  await operator.getByRole('tab', { name: 'Inventario', exact: true }).click();
  await operator.getByText('100 g', { exact: false }).waitFor();
  for (const name of ['Recibir lote simulado', 'Registrar ajuste', 'Poner en cuarentena']) {
    assert.equal(await operator.getByRole('button', { name, exact: true }).count(), 0, `operator cannot ${name}`);
  }
  const operatorSnapshot = await refresh(operator);
  const operatorRef = operatorSnapshot.actorRef;
  const otherInventory = await refresh(dispensaryB);
  assert.notEqual(operatorSnapshot.batches[0].batch_ref, otherInventory.batches[0].batch_ref, 'stock belongs to an organization, not a shared user');
  const forged = await operator.request.post(`${baseUrl}/api/operations-pilot`, { headers: { 'privy-id-token': 'fixture-operator' },
    data: { action: 'adjust-stock', input: { operationId: crypto.randomUUID(), resourceRef: operatorSnapshot.batches[0].batch_ref, version: operatorSnapshot.batches[0].version, quantityMg: 1000, reason: 'INTENTO OPERADOR QA' } } });
  assert.equal(forged.status(), 403, 'server rejects a forged manager operation');
  await patient.getByRole('tab', { name: 'Tratamientos', exact: true }).click(); await refresh(patient);
  for (const name of ['Dispensario A QA', 'Dispensario B QA']) {
    const row = patient.locator('.op-line').filter({ hasText: name });
    const response = patient.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST');
    await row.getByRole('button', { name: 'Autorizar 24 horas' }).click(); assert.equal((await response).status(), 200); await refresh(patient);
  }
  await operator.getByRole('tab', { name: 'Atenciones', exact: true }).click(); await refresh(operator);
  await operator.getByRole('button', { name: 'Registrar entrega simulada', exact: true }).waitFor();
  await operator.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('NO-MATCH-QA');
  await operator.getByText('No hay resultados para esta busqueda.', { exact: true }).waitFor();
  assert.equal(await operator.getByText('No hay pacientes que hayan compartido un tratamiento vigente con este dispensario.', { exact: true }).count(), 0);
  await operator.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('   ');
  await operator.getByRole('button', { name: 'Registrar entrega simulada', exact: true }).waitFor();
  await operator.getByLabel('Lote', { exact: true }).selectOption({ index: 1 });
  await dispensary.getByRole('tab', { name: 'Inventario', exact: true }).click();
  await dispensary.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('NO-MATCH-QA');
  await dispensary.getByText('No hay resultados para esta busqueda.', { exact: true }).waitFor();
  await dispensary.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('');
  await command(dispensary, 'Poner en cuarentena');
  await refresh(operator);
  await operator.getByText('No hay lotes disponibles con stock y vigencia para esta entrega.', { exact: true }).waitFor();
  assert.equal(await operator.getByRole('button', { name: 'Registrar entrega simulada', exact: true }).isDisabled(), true);
  assert.equal(await operator.getByLabel('Lote', { exact: true }).inputValue(), '', 'a quarantined selected lot is no longer usable');
  assert.equal((await refresh(operator)).deliveries.length, 0);
  await operator.setViewportSize({ width: 390, height: 844 });
  assert.equal(await operator.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'unavailable inventory mobile layout');
  await operator.screenshot({ path: fileURLToPath(new URL('operator-no-lots-mobile.png', output)), fullPage: true });
  await operator.setViewportSize({ width: 1365, height: 900 });
  await command(dispensary, 'Liberar cuarentena');
  await refresh(operator);
  await operator.getByText('No hay lotes disponibles con stock y vigencia para esta entrega.', { exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await operator.getByRole('button', { name: 'Registrar entrega simulada', exact: true }).isEnabled(), true);
  const revoke = patient.locator('.op-line').filter({ hasText: 'Dispensario A QA' });
  const revoked = patient.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST');
  await revoke.getByRole('button', { name: 'Revocar permiso', exact: true }).click(); assert.equal((await revoked).status(), 200);
  await refresh(operator);
  await operator.getByRole('button', { name: 'Registrar entrega simulada', exact: true }).waitFor({ state: 'hidden' });
  assert.equal((await refresh(operator)).treatments.length, 0, 'revoking a patient grant removes the protected treatment');
  await refresh(patient);
  const granted = patient.waitForResponse(r => r.url().endsWith('/api/operations-pilot') && r.request().method() === 'POST');
  await revoke.getByRole('button', { name: 'Autorizar 24 horas', exact: true }).click(); assert.equal((await granted).status(), 200);
  for (const [page, grams] of [[operator, '10'], [dispensaryB, '20']]) {
    await page.getByRole('tab', { name: 'Atenciones', exact: true }).click(); await refresh(page);
    const delivery = form(page, 'Registrar entrega simulada');
    await delivery.getByLabel('Lote', { exact: true }).selectOption({ index: 1 });
    await delivery.getByLabel('Cantidad en gramos', { exact: true }).fill(grams);
    await command(page, 'Registrar entrega simulada');
  }
  assert.equal((await refresh(dispensary)).deliveries[0].operator_ref, operatorRef, 'delivery retains the responsible team member');
  assert.equal((await refresh(dispensary)).batches[0].stock_mg, 90000);
  assert.equal((await refresh(dispensaryB)).batches[0].stock_mg, 80000);
  await operator.evaluate(() => window.dispatchEvent(new Event('focus')));
  await operator.locator('.op-stats div').filter({ hasText: 'Disponible ahora' }).getByText('0 g', { exact: true }).waitFor({ timeout: 5000 });
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
  await dispensary.getByRole('tab', { name: 'Equipo', exact: true }).click();
  dispensary.once('dialog', dialog => dialog.accept());
  await command(dispensary, 'Retirar operator@example.test');
  await refresh(operator);
  await operator.getByRole('tab', { name: 'Inventario', exact: true }).click();
  await operator.getByText('No hay lotes registrados.', { exact: true }).waitFor();
  const removedMembership = (await refresh(operator)).membership;
  assert.equal(removedMembership?.organization_ref ?? null, null, 'removed organization does not survive refresh');
  assert.equal(removedMembership?.role ?? null, null, 'removed privileges do not survive refresh');
  await operator.reload();
  await operator.getByRole('tab', { name: 'Atenciones', exact: true }).click();
  assert.equal((await refresh(operator)).treatments.length, 0, 'removed operator cannot access former organization patients');
  await operator.getByRole('tab', { name: 'Equipo', exact: true }).click();
  assert.equal(await operator.getByRole('button', { name: 'Crear dispensario de prueba' }).count(), 0, 'removed staff never become managers');
  const createAsRemoved = await operator.request.post(`${baseUrl}/api/operations-pilot`, { headers: { 'privy-id-token': 'fixture-operator' }, data: { action: 'create-organization', input: { name: 'Forbidden', operationId: crypto.randomUUID() } } });
  assert.equal(createAsRemoved.status(), 403);
  const recover = await (await browser.newContext()).newPage();
  await recover.goto(`${baseUrl}/?operations&role=dispensaryRecovery`);
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
  await otherSession.goto(`${baseUrl}/?operations&role=dispensaryRecovery`);
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
  // A person without an actor joins through email acceptance, not onboarding.
  await dispensaryB.getByRole('tab', { name: 'Equipo', exact: true }).click();
  await dispensaryB.getByLabel('Correo del trabajador', { exact: true }).fill('newworker@example.test');
  await dispensaryB.getByRole('button', { name: 'Preparar invitacion', exact: true }).click();
  const inviteIds = [];
  await dispensaryB.route('**/api/team-invitations', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'create') return route.continue();
    inviteIds.push(body.operationId);
    const result = await route.fetch(); assert.equal(result.status(), 200);
    return inviteIds.length === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ response: result });
  });
  await dispensaryB.getByRole('button', { name: 'Enviar invitacion', exact: true }).click();
  const recoveredInvitation = dispensaryB.waitForResponse(r => r.url().endsWith('/api/team-invitations') && r.request().postDataJSON()?.action === 'create' && r.status() === 200);
  await dispensaryB.getByRole('button', { name: 'Reintentar operacion', exact: true }).click();
  await recoveredInvitation;
  await dispensaryB.getByRole('button', { name: 'Reintentar operacion', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(inviteIds.length, 2); assert.equal(inviteIds[0], inviteIds[1]);
  await dispensaryB.unroute('**/api/team-invitations');
  const sent = (await (await dispensaryB.request.get(`${baseUrl}/__team-mail`)).json()).filter(m => m.to[0] === 'newworker@example.test');
  assert.equal(sent.length, 1, 'lost response does not send twice');
  const newToken = sent[0].text.match(/#team-invite=([A-Za-z0-9_-]+)/)[1];
  const newcomer = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  pages.newWorker = newcomer; newcomer.on('pageerror', e => errors.push(e.message));
  await newcomer.goto(`${baseUrl}/dispensario?operations&role=newWorker#team-invite=${newToken}`);
  await newcomer.getByRole('button', { name: 'Aceptar invitacion como operador', exact: true }).waitFor();
  await newcomer.reload();
  await newcomer.getByRole('checkbox').check();
  await newcomer.screenshot({ path: fileURLToPath(new URL('team-accept-mobile.png', output)), fullPage: true });
  const acceptanceAttempts = [];
  await newcomer.route('**/api/team-invitations', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'accept') return route.continue();
    acceptanceAttempts.push(body.token);
    const result = await route.fetch(); assert.equal(result.status(), 200);
    return acceptanceAttempts.length === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ response: result });
  });
  await newcomer.getByRole('button', { name: 'Aceptar invitacion como operador', exact: true }).click();
  await newcomer.getByRole('alert').waitFor();
  await newcomer.getByRole('button', { name: 'Aceptar invitacion como operador', exact: true }).click();
  await newcomer.getByRole('tab', { name: 'Equipo', exact: true }).click();
  assert.equal(acceptanceAttempts.length, 2); assert.equal(acceptanceAttempts[0], acceptanceAttempts[1]);
  await newcomer.locator('.op-line').filter({ hasText: 'newworker@example.test' }).waitFor();
  assert.equal(await newcomer.getByRole('button', { name: 'Crear dispensario de prueba', exact: true }).count(), 0);
  assert.equal(await newcomer.getByLabel('Correo del trabajador', { exact: true }).count(), 0);
  assert.equal(await newcomer.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await newcomer.getByRole('tab', { name: 'Inventario', exact: true }).click();
  await newcomer.getByText('80 g', { exact: false }).waitFor();
  await newcomer.screenshot({ path: fileURLToPath(new URL('team-new-worker-mobile.png', output)), fullPage: true });
  await patient.route('**/api/operations-pilot', route => route.fulfill({ status: 403, json: {} }));
  await refresh(patient);
  await patient.getByRole('alert').waitFor();
  assert.equal(await patient.locator('.op-reference').count(), 0, 'authorization loss clears cached medical and delivery records');
  assert.deepEqual(errors, []);
  console.log('PASS: browser + actual isolated SQL: join, publish, reserve, cancel, close with/without treatment, organizations, operator enrollment/removal and permissions, lots, grant revocation, 10g + 20g deliveries, responsible operator, persistent history, privacy, desktop/mobile, identity reset, rejected-write refresh across sessions and reconnection.');
} catch (error) {
  for (const [role, page] of Object.entries(pages)) await page.screenshot({ path: fileURLToPath(new URL(`failure-${role}.png`, output)), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
