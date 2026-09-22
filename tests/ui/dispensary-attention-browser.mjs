import assert from 'node:assert/strict';
import { navigateSection } from './workspace-navigation.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const base = process.env.OPERATIONS_TEST_URL ?? 'http://127.0.0.1:4321';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const treatment = (ref, patient) => ({ treatment_ref: ref, patient_ref: patient, state: 'active', version: 1, issued_at: past,
  prescription_valid_until: future, treatment_ends_at: future, allowance_mg: 30000, period_count: 1,
  periods: [{ period_index: 1, starts_at: past, ends_at: future, allowance_mg: 30000, used_mg: 20000 }] });
const seed = () => ({ joined: true, synthetic: true, role: 'dispensary', actorRef: 'operator',
  membership: { organization_ref: 'org', actor_ref: 'operator', role: 'operator' },
  organizations: [{ organization_ref: 'org', name: 'Dispensario de pruebas con nombre extenso' }], members: [],
  treatments: [treatment('t1','11111111-patient'), treatment('t2','22222222-patient'), treatment('t3','22222222-patient'), treatment('t4','33333333-patient')],
  grants: ['t1','t2','t3','t4'].map(treatment_ref => ({ treatment_ref, organization_ref: 'org', expires_at: future })),
  patientProfiles: ['11111111-patient','22222222-patient'].map(patient_ref => ({patient_ref, name: 'Paciente con nombre repetido y muy extenso', email: 'test@example.test', phone: '000000', version: 1})),
  batches: [{ batch_ref: 'batch', organization_ref: 'org', product: 'Flor de prueba', lot_code: 'LOTE-PRUEBA', state: 'active', stock_mg: 60000, expires_at: future, version: 1 }], deliveries: [] });
await mkdir('scratch/operations-qa', { recursive: true });
try {
  for (const role of ['manager','operator']) for (const width of [360,390,768,1024,1440]) {
    const page = await browser.newPage({viewport: { width, height: 900 }});
    let data = seed(), failure = false, posts = 0;
    data.membership.role = role;
    await page.route('**/api/operations-pilot', route => {
      if (route.request().method() !== 'GET') posts++;
      return route.fulfill({ status: failure ? 503 : 200, json: failure ? {} : data });
    });
    await page.goto(`${base}/?operations&role=dispensary`);
    await page.getByRole('tab', { name: role === 'manager' ? 'Inicio' : 'Atenciones', selected: true, includeHidden: true }).waitFor({state:'attached'});
    if (role === 'manager') await navigateSection(page, 'Atenciones');
    await page.locator('.op-patient').first().waitFor();
    assert.equal(await page.locator('.op-patient').count(), 3);
    assert.equal(await page.getByLabel('Lote', { exact: true }).count(), 0, 'no automatic selection');
    assert.equal(await page.locator('.op-mobile-menu').isVisible(), width < 1024);
    assert.equal(await page.locator('.op-sidebar').isVisible(), width >= 1024);
    assert.ok((await page.locator('.op-patient').first().boundingBox()).y < 800, 'patient list begins in first viewport');
    await page.screenshot({path:`scratch/operations-qa/attention-list-${role}-${width}.png`,fullPage:true});
    await page.locator('.op-patient').first().focus();
    await page.locator('.op-patient').first().press('Enter');
    await page.locator('.op-patient-detail h2:focus').waitFor();
    await page.getByRole('button', {name:'Volver a pacientes'}).press('Enter');
    await page.locator('.op-patient:focus').waitFor();
    const search = page.getByRole('searchbox');
    await search.fill('nothing');
    await page.getByText('No hay pacientes para esta busqueda.').waitFor();
    await search.fill('11111111');
    await page.locator('.op-patient').click();
    await page.getByLabel('Lote', {exact:true}).selectOption('batch');
    page.once('dialog', dialog => dialog.dismiss());
    await navigateSection(page, 'Inventario');
    assert.equal(await page.getByLabel('Lote', {exact:true}).inputValue(), 'batch', 'cancelled navigation preserves the draft');
    if (width < 1024) await page.locator('.op-mobile-menu').click();
    await page.getByLabel('Cantidad en gramos', {exact:true}).fill('5');
    page.once('dialog', d => d.dismiss());
    await page.getByRole('button', {name:'Volver a pacientes'}).click();
    assert.equal(await page.getByLabel('Lote', {exact:true}).inputValue(), 'batch');
    page.once('dialog', d => d.accept());
    await page.getByRole('button', {name:'Volver a pacientes'}).click();
    await page.locator('.op-patient:focus').waitFor();
    assert.equal(await search.inputValue(), '11111111');
    await search.fill('');
    await page.locator('.op-patient').nth(1).click();
    await page.getByLabel('Tratamiento', {exact:true}).waitFor();
    assert.equal(await page.getByLabel('Tratamiento', {exact:true}).locator('option').count(), 2);
    await page.getByLabel('Lote', {exact:true}).selectOption('batch');
    await page.getByRole('button', {name:'Registrar entrega simulada',exact:true}).click();
    failure = true;
    await page.getByRole('button', {name:'Actualizar datos',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', {name:'Confirmar entrega',exact:true}).isDisabled(), true);
    failure = false;
    await page.getByRole('button', {name:'Actualizar datos',exact:true}).click();
    await page.getByRole('alert').waitFor({state:'hidden'});
    assert.equal(await page.getByRole('button', {name:'Confirmar entrega',exact:true}).isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path:`scratch/operations-qa/attention-${role}-${width}.png`,fullPage:true});
    data.grants = [];
    await page.getByRole('button', {name:'Actualizar datos',exact:true}).click();
    await page.getByLabel('Lote', {exact:true}).waitFor({state:'hidden'});
    await page.getByText('No hay pacientes con permiso vigente.').waitFor();
    assert.equal(posts, 0, 'navigation and review never write');
    await page.reload();
    if (role === 'manager') await navigateSection(page, 'Atenciones');
    await page.getByText('No hay pacientes con permiso vigente.').waitFor();
    await page.close();
  }
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const data = seed(), attempts = [];
  await page.route('**/api/operations-pilot', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json:data});
    const command = route.request().postDataJSON(); attempts.push(command.input.operationId);
    assert.equal(command.action, 'dispense');
    if (attempts.length === 1) {
      data.deliveries.push({delivery_ref:'receipt',treatment_ref:'t1',organization_ref:'org',operator_ref:'operator',batch_ref:'batch',period_index:1,quantity_mg:5000,created_at:new Date().toISOString(),product:'Flor de prueba',lot_code:'LOTE-PRUEBA'});
      data.treatments[0].periods[0].used_mg += 5000;
      data.batches[0].stock_mg -= 5000;
      return route.abort('failed');
    }
    return route.fulfill({json:{resourceRef:'receipt'}});
  });
  await page.goto(`${base}/?operations&role=dispensary`);
  await page.locator('.op-patient').first().click();
  await page.getByLabel('Lote', {exact:true}).selectOption('batch');
  await page.getByLabel('Cantidad en gramos', {exact:true}).fill('5');
  await page.getByRole('button', {name:'Registrar entrega simulada',exact:true}).click();
  await page.getByRole('button', {name:'Confirmar entrega',exact:true}).dblclick();
  await page.getByRole('button', {name:'Reintentar operacion',exact:true}).click();
  await page.getByRole('region', {name:'Entrega registrada',exact:true}).waitFor();
  assert.equal(attempts.length, 2);
  assert.equal(new Set(attempts).size, 1, 'lost response retries the same operation');
  assert.equal(data.deliveries.length, 1);
  assert.equal(await page.getByRole('button', {name:'Registrar entrega simulada',exact:true}).count(), 0);
  await page.close();
  console.log('PASS attention: roles and five widths, grouping, drafts, errors, revocation, navigation, double click and lost response');
} finally { await browser.close(); }
