import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL ?? 'chrome'});
const base = process.env.OPERATIONS_TEST_URL ?? 'http://127.0.0.1:4321';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const future = new Date(Date.now() + 365 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const batches = ['available','quarantined','expired','empty'].map((state,index) => ({batch_ref:`batch-${index}`,organization_ref:'org',
  lot_code:`LOTE-${index}`,product:index ? `Producto ${index}` : 'Producto ficticio de nombre muy extenso para probar lectura responsive',source_reference:'ORIGEN FICTICIO',
  stock_mg:state === 'empty' ? 0 : 60000,expires_at:state === 'expired' ? past : future,state:state === 'quarantined' ? state : 'active',version:1}));
const deliveries = [0,1].map(i => ({delivery_ref:`receipt-${i}`,treatment_ref:'treatment',organization_ref:'org',operator_ref:'operator',batch_ref:`batch-${i}`,
  product:batches[i].product,lot_code:batches[i].lot_code,organization_name:'Dispensario QA',period_index:1,quantity_mg:10000,created_at:'2026-09-20T02:00:00Z'}));
await mkdir('scratch/operations-qa',{recursive:true});
try {
  for (const role of ['manager','operator']) for (const width of [360,390,768,1024,1440]) {
    const page = await browser.newPage({viewport:{width,height:900},timezoneId:'America/Santiago'});
    let failure = false, writes = 0;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/operations-pilot', route => {
      if (route.request().method() !== 'GET') writes++;
      return route.fulfill({status:failure ? 503 : 200,json:failure ? {} : {joined:true,synthetic:true,role:'dispensary',actorRef:role,
        membership:{organization_ref:'org',actor_ref:role,role},organizations:[{organization_ref:'org',name:'Dispensario QA'}],batches,deliveries,
        movements:[0,1].map(i => ({movement_ref:`movement-${i}`,batch_ref:`batch-${i}`,operator_ref:'operator',quantity_mg:-10000,reason:'Entrega simulada',created_at:'2026-09-20T02:00:00Z'}))}});
    });
    await page.route('**/api/team-invitations', route => {
      assert.equal(route.request().postDataJSON().action,'list');
      return route.fulfill({json:{organization:{name:'Dispensario QA'},membership:{role},invitationsEnabled:true,
        members:[{actorRef:role,email:'correo-muy-largo-de-trabajador@example.test',role}],invitations:[]}});
    });
    await page.goto(`${base}/?operations&role=dispensary`);
    const section = name => page.getByRole('tab',{name,exact:true});
    await section('Inventario').click();
    await page.locator('.op-stock-row').nth(3).waitFor();
    for (const [filter,label] of [['Disponibles','Disponible'],['Cuarentena','Cuarentena'],['Vencidos','Vencido'],['Agotados','Agotado']]) {
      await page.getByRole('button',{name:filter,exact:true}).click();
      await page.locator('.op-stock-row .op-batch-state').getByText(label,{exact:true}).waitFor();
      assert.equal(await page.locator('.op-stock-row').count(),1);
    }
    await page.getByRole('button',{name:'Todos',exact:true}).click();
    await page.locator('.op-stock-row').nth(3).waitFor();
    assert.equal(await page.getByRole('button',{name:'Recibir lote simulado',exact:true}).isVisible(),false);
    assert.equal(await page.getByRole('button',{name:'Registrar ajuste',exact:true}).first().isVisible(),false);
    if (role === 'operator') assert.equal(await page.getByText('Gestionar lote',{exact:true}).count(),0);
    else {
      await page.getByText('Recibir lote',{exact:true}).press('Enter');
      await page.getByLabel('Codigo de lote',{exact:true}).waitFor();
      await page.getByText('Recibir lote',{exact:true}).press('Enter');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:`scratch/operations-qa/daily-inventory-${role}-${width}.png`,fullPage:true});
    await page.getByRole('searchbox').fill('LOTE-0');
    await page.getByRole('button',{name:'Ver historial del lote',exact:true}).press('Enter');
    await page.getByLabel('Lote del historial').waitFor();
    assert.equal(await page.getByLabel('Lote del historial').inputValue(),'batch-0');
    assert.equal(await page.getByRole('searchbox').inputValue(),'');
    assert.equal(await page.getByRole('button',{name:'Entregas',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('article').count(),1);
    await page.getByLabel('Fecha de entrega').fill('2026-09-19');
    await page.getByRole('searchbox').fill('receipt-0');
    await page.getByText('Ver comprobante y trazabilidad',{exact:true}).press('Enter');
    await page.getByText('Comprobante: receipt-0',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Fecha de entrega').inputValue(),'2026-09-19');
    await page.getByRole('button',{name:'Movimientos de stock',exact:true}).click();
    await page.getByText('No hay movimientos para estos filtros.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
    await page.locator('article').nth(1).waitFor();
    await page.getByRole('searchbox').fill('LOTE-1');
    await page.getByText('Ver movimiento y trazabilidad',{exact:true}).click();
    await page.getByText('Operador: operator · Movimiento: movement-1',{exact:true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:`scratch/operations-qa/daily-history-${role}-${width}.png`,fullPage:true});
    await section('Inventario').click();
    await page.locator('.op-stock-row').nth(3).waitFor();
    assert.equal(await page.getByRole('searchbox').inputValue(),'');
    await section('Historial').click();
    assert.equal(await page.getByLabel('Lote del historial').inputValue(),'');
    assert.equal(await page.getByLabel('Fecha de entrega').inputValue(),'');
    await page.getByRole('searchbox').fill('Producto ficticio');
    await page.locator('article').getByText(batches[0].product,{exact:false}).waitFor();
    failure = true;
    await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
    await page.getByRole('alert').waitFor();
    await page.getByRole('searchbox').fill('no-match');
    assert.equal(await page.getByText('No hay entregas para estos filtros.',{exact:true}).count(),0);
    await section('Inventario').click();
    await page.getByRole('searchbox').fill('no-match');
    assert.equal(await page.getByText('No hay resultados para esta busqueda.',{exact:true}).count(),0);
    failure = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.getByRole('alert').waitFor({state:'hidden'});
    await page.getByText('No hay resultados para esta busqueda.',{exact:true}).waitFor();
    await section('Equipo').click();
    await page.locator('.op-team .op-line').filter({hasText:'correo-muy-largo-de-trabajador@example.test'}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.getByRole('searchbox').fill('no-match');
    await page.getByText('No hay miembros para esta busqueda.',{exact:true}).waitFor();
    assert.equal(writes,0,'navigation never writes'); assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS daily workspace: both roles, five widths, stock states, collapsed forms, lot history, date/product/reference search, reset, errors and team');
} finally { await browser.close(); }
