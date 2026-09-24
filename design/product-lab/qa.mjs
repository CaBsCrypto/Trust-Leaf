import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = new URL('../../scratch/product-lab-evidence/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const direction of (process.env.LAB_DIRECTION ? [process.env.LAB_DIRECTION] : ['A', 'B', 'C', 'D', 'E'])) for (const width of [360, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const violations = [], errors = [];
    page.on('request', request => {
      if (request.method() !== 'GET' || new URL(request.url()).pathname.startsWith('/api/') || new URL(request.url()).hostname !== '127.0.0.1') violations.push(request.url());
    });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4330/');
    assert.equal(await page.locator('.lab-bar').isVisible(), false);
    await page.getByLabel('Configuración del prototipo', { exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Mesa de atención', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: { A: 'A · Operativo', B: 'B · Por tareas', C: 'C · Combinada', D: 'D · Clínica', E: 'Mesa de atención' }[direction], exact: true }).click();
    async function fit(label) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${direction}/${width}/${label}: page overflow`);
    }
    async function shot(label) {
      await fit(label);
      if ([390,1440].includes(width)) {
        await page.getByLabel('Configuración del prototipo', { exact: true }).click();
        await page.screenshot({ path: fileURLToPath(new URL(`${direction}-${width}-${label}.png`, output)), fullPage: true });
        await page.getByLabel('Configuración del prototipo', { exact: true }).click();
      }
    }
    async function navigate(name) {
      const menu = page.getByRole('button', { name: /Jornada|Atender|Existencias|Comprobantes/ }).filter({ has: page.locator('svg.lucide-menu') });
      if (await menu.isVisible()) await menu.click();
      const label = direction === 'E' ? ({ Atender: 'Pacientes', Existencias: 'Inventario', Comprobantes: 'Historial' }[name] || name) : name;
      await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
    }
    await shot('home');
    for (const role of ['operator','manager']) {
      await page.getByLabel(/^Rol/).selectOption(role);
      if (role === 'manager') await navigate('Atender');
      await page.getByRole('searchbox').fill('P-104');
      await page.getByRole('button', { name: /Camila Torres.*P-104/ }).click();
      if (direction === 'E') {
        assert.equal(await page.getByRole('radio', { name: /NOR-018/ }).isEnabled(), false);
        assert.equal(await page.getByRole('radio', { name: /SUR-009/ }).isEnabled(), false);
        await page.getByRole('radio', { name: /ALB-024/ }).check();
        for (const value of ['0', '-1', '11', '1.0001']) {
          await page.getByLabel('Cantidad en gramos').fill(value);
          assert.equal(await page.getByRole('button', { name: 'Revisar entrega', exact: true }).isEnabled(), false);
        }
      } else await page.getByLabel('Lote disponible').selectOption('ALB-024');
      await page.getByLabel('Cantidad en gramos').fill('5');
      if (direction === 'E' && width >= 1024) {
        await page.getByRole('searchbox').fill('');
        await page.getByRole('button', { name: /Camila Torres.*P-218/ }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Seguir editando' }).click();
        assert.equal(await page.getByLabel('Cantidad en gramos').inputValue(), '5');
        await page.getByRole('searchbox').fill('P-104');
      }
      await shot(`${role}-detail`);
      await page.getByRole('button', { name: 'Revisar entrega', exact: true }).click();
      await page.getByText('Saldo hipotético', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Confirmar entrega/ }).count(), 0);
      await shot(`${role}-review`);
      await page.getByRole('button', { name: 'Volver a editar' }).click();
      if (direction === 'E') {
        await navigate('Existencias');
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Seguir editando' }).click();
        assert.equal(await page.getByLabel('Cantidad en gramos').inputValue(), '5');
        if (width < 1024) {
          await page.setViewportSize({ width, height: 520 });
          await page.getByLabel('Cantidad en gramos').focus();
          await page.getByRole('button', { name: 'Revisar entrega', exact: true }).scrollIntoViewIfNeeded();
          const action = await page.getByRole('button', { name: 'Revisar entrega', exact: true }).boundingBox();
          const nav = await page.getByRole('navigation').boundingBox();
          assert.ok(action.y + action.height <= nav.y, 'Review must not overlap bottom navigation');
          await page.setViewportSize({ width, height: 960 });
        }
      }
      await page.getByRole('button', { name: 'Volver a pacientes' }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByLabel('Cantidad en gramos').inputValue(), '5');
      await page.getByRole('button', { name: 'Volver a pacientes' }).click();
      await page.getByRole('button', { name: 'Descartar cambios' }).click();
      await page.getByRole('button', { name: /Camila Torres.*P-104/ }).waitFor({ state: 'visible' });
      assert.equal(await page.getByRole('searchbox').inputValue(), 'P-104');
      await page.waitForFunction(() => document.activeElement?.classList.contains('patient-row'));
      await page.getByRole('searchbox').fill('noexiste');
      await page.getByText('No hay pacientes para esta búsqueda.').waitFor();
      await page.getByRole('searchbox').fill('');
      await shot(`${role}-list`);
      for (const state of ['loading','empty','error']) {
        await page.getByLabel(/^Estado/).selectOption(state);
        await fit(state);
        assert.equal(await page.getByRole('button', { name: 'Revisar entrega', exact: true }).count(), 0);
      }
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await navigate('Existencias');
      await page.getByRole('button', { name: 'Cuarentena', exact: true }).click();
      assert.equal(await page.locator('.stock-row').count(), 1);
      await page.getByRole('button', { name: 'Todos', exact: true }).click();
      await shot(`${role}-inventory`);
      await page.locator('.stock-row').filter({ hasText: 'ALB-024' }).getByRole('button', { name: 'Ver historial' }).click();
      assert.equal(await page.locator('.lot-filter select').inputValue(), 'ALB-024');
      await page.getByRole('button', { name: /REC-001/ }).click();
      await page.getByRole('region', { name: 'Detalle del comprobante' }).waitFor();
      await shot(`${role}-history`);
      await page.getByRole('button', { name: 'Limpiar filtros' }).click();
      assert.equal(await page.locator('.lot-filter select').inputValue(), '');
    }
    assert.deepEqual(violations, []);
    assert.deepEqual(errors, []);
    results.push({ direction, width, roles: ['operator','manager'], result: 'passed', productionRequests: 0 });
    await context.close();
  }
  await writeFile(new URL('results.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
