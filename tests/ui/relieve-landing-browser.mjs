import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DEMO_PUBLIC_VERIFICATION_TOKENS } from '../../src/lib/publicVerification.ts';

// Run against the normal Vite dev/preview entry. Use PLAYWRIGHT_MODULE if
// Playwright is installed outside this package and PLAYWRIGHT_CHANNEL for Edge.
// Set RELIEVE_TEST_WAITLIST=1 against the local waitlist mode to verify submissions.
const baseUrl = process.env.RELIEVE_TEST_URL ?? 'http://127.0.0.1:5195';
const checkWaitlist = process.env.RELIEVE_TEST_WAITLIST === '1';
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/, 'Landing QA must stay local');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = new URL('../../scratch/redesign-qa/', import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const context = await browser.newContext({ locale: 'es-CL', reducedMotion: 'reduce' });
const page = await context.newPage();
// This fixture covers layout and navigation without contacting identity,
// analytics or external asset providers.
await context.route('**/*', route => new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort());
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function checkBrand(view, label) {
  await view.locator('header').getByText('TrustLeaf', { exact: true }).waitFor();
  assert.equal(await view.title(), 'TrustLeaf · Cannabis', `${label}: browser title`);
  assert.doesNotMatch(await view.locator('body').innerText(), /\b(?:Trusty|Trust\s+Leaf)\b/i, `${label}: only the current wordmark should appear`);
}

async function checkSectionFit(section, label) {
  await section.waitFor();
  const overflow = await section.evaluate(element => element.scrollWidth - element.clientWidth);
  assert.ok(overflow <= 1, `${label}: horizontal overflow of ${overflow}px`);
}

async function checkWaitlistForms() {
  const email = 'waitlist-verification@example.test';
  const cases = [
    ['patient', 'paciente', 'Pacientes'],
    ['doctor', 'medico', 'Médicos'],
    ['dispensary', 'dispensario', 'Dispensarios'],
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/#lista-de-espera`, { waitUntil: 'domcontentloaded' });
  const cards = page.locator('#lista-de-espera article');
  await cards.first().waitFor();
  assert.deepEqual(await cards.evaluateAll(elements => elements.map(element => element.id)),
    cases.map(([, anchor]) => `lista-de-espera-${anchor}`), 'patients are first in reading order');
  const boxes = await cards.evaluateAll(elements => elements.map(element => {
    const { left, bottom, top } = element.getBoundingClientRect();
    return { left, bottom, top };
  }));
  assert.ok(boxes.every((box, index) => box.left === boxes[0].left && (!index || box.top >= boxes[index - 1].bottom)),
    'mobile waitlist cards are stacked in reading order');
  await checkSectionFit(page.locator('#lista-de-espera'), 'mobile waitlists');
  assert.equal(await page.getByRole('textbox', { name: 'Correo electrónico' }).count(), 0, 'email fields are hidden until a list is selected');
  await page.locator('#lista-de-espera').screenshot({ path: fileURLToPath(new URL('waitlist-buttons-390.png', output)) });
  for (const [audience, anchor, label] of cases) {
    const trigger = page.locator(`#lista-de-espera-${anchor}`).getByRole('button', { name: label, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: `Lista de espera para ${label.toLowerCase()}`, exact: true });
    await dialog.waitFor();
    const field = dialog.getByRole('textbox', { name: 'Correo electrónico', exact: true });
    assert.ok(await field.evaluate(element => document.activeElement === element), 'focus moves to the email field');
    if (audience === 'doctor') {
      await page.screenshot({ path: fileURLToPath(new URL('waitlist-doctor-popup-390.png', output)) });
    }
    await field.fill(email);
    const submit = dialog.getByRole('button', { name: 'Inscribirme', exact: true });
    const [result] = await Promise.all([
      page.waitForResponse(response => response.url() === `${baseUrl}/api/cannabis-waitlist`
        && response.request().method() === 'POST'),
      submit.click(),
    ]);
    assert.equal(result.status(), 200, `${label}: waitlist submission`);
    assert.deepEqual(result.request().postDataJSON(), { audience, email });
    await dialog.getByText(`Inscripción de prueba registrada para ${label.toLowerCase()}.`, { exact: true }).waitFor();
    if (audience === 'doctor') await page.keyboard.press('Escape');
    else await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.ok(await trigger.evaluate(element => document.activeElement === element), 'focus returns to the selected list');
  }
  console.log('Mobile order and separate patient, doctor and dispensary signups passed.');
}

async function checkTechnicalRoutes() {
  const views = [
    ['/mvp', 'Estado del piloto'],
    ['/demo/pilot-flow', 'Recorrido técnico del piloto'],
    ['/demo/receipt-pilot', 'Revisión del comprobante por rol'],
    ['/demo/trust-registry', 'Autorización por rol y estado'],
  ];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 950 });
    for (const [path, heading] of views) {
      const label = `${path} at ${width}px`;
      const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200, label);
      await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor();
      await checkBrand(page, label);
      const overflow = await page.locator('.tl-technical').evaluate(frame => frame.scrollWidth - frame.clientWidth);
      assert.ok(overflow <= 1, `${label}: horizontal overflow of ${overflow}px`);
    }
  }
}

async function checkArt(width, language = 'es') {
  const heading = page.getByRole('heading', { level: 1, name: language === 'es' ? 'Tu cuidado, parte de tu historia.' : 'Your care is part of your story.' });
  await heading.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const figure = page.locator('.tl-relieve-figure');
  await figure.scrollIntoViewIfNeeded();
  const leaf = figure.locator('.tl-relieve-leaf');
  await leaf.evaluate(element => element.decode());

  const titles = await figure.locator('.tl-relieve-document-title').allTextContents();
  assert.deepEqual(titles, language === 'es' ? ['Ficha clínica', 'Receta médica'] : ['Clinical record', 'Medical prescription']);

  const layout = await figure.evaluate(element => {
    const titleIssues = [];
    const titles = element.querySelectorAll('.tl-relieve-document-title');
    for (const title of titles) {
      const card = title.closest('.tl-relieve-document');
      const label = [...title.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!label) {
        titleIssues.push(`${title.textContent} has no visible label`);
        continue;
      }
      const bounds = card.getBoundingClientRect();
      const range = new Range();
      range.selectNodeContents(label);
      const rects = [...range.getClientRects()];
      if (!rects.length) titleIssues.push(`${title.textContent} has no visible line`);
      for (const rect of rects) {
        if (rect.left < Math.max(0, bounds.left) - 1 || rect.right > Math.min(innerWidth, bounds.right) + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) {
          titleIssues.push(`${title.textContent} extends outside its card or viewport`);
        }
        const y = rect.top + rect.height / 2;
        if ([.2, .5, .8].some(fraction => !title.contains(document.elementFromPoint(rect.left + rect.width * fraction, y)))) {
          titleIssues.push(`${title.textContent} is visually covered`);
        }
      }
    }
    const img = element.querySelector('.tl-relieve-leaf');
    const leafBounds = img.getBoundingClientRect();
    return {
      titleIssues,
      overflow: document.documentElement.scrollWidth - innerWidth,
      renderedLeaf: img.complete && img.naturalWidth > 0 && leafBounds.width >= 40 && leafBounds.height >= 40,
    };
  });

  assert.deepEqual(layout.titleIssues, [], `${language} ${width}px: both document titles must remain fully visible`);
  assert.ok(layout.overflow <= 1, `${language} ${width}px: horizontal overflow of ${layout.overflow}px`);
  assert.ok(layout.renderedLeaf, `${language} ${width}px: the botanical artwork must be visible and loaded`);
}

try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 780 ? 844 : 950 });
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await checkArt(width);
    await checkBrand(page, `Landing at ${width}px`);
    await checkSectionFit(page.locator('#trazabilidad'), `Traceability at ${width}px`);
    if (checkWaitlist) await checkSectionFit(page.locator('#lista-de-espera'), `Waitlists at ${width}px`);
    if (width === 390 || width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: fileURLToPath(new URL(`landing-${width}.png`, output)), fullPage: true });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  const openMenu = navigation.getByRole('button', { name: 'Abrir menú' });
  const closeMenu = navigation.getByRole('button', { name: 'Cerrar menú' });
  await openMenu.click();
  assert.equal(await closeMenu.getAttribute('aria-expanded'), 'true');
  await navigation.getByRole('link', { name: 'Cómo funciona' }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await openMenu.getAttribute('aria-expanded'), 'false');
  assert.ok(await openMenu.evaluate(element => element === document.activeElement), 'Escape must restore focus to the menu button');

  await openMenu.click();
  await navigation.getByRole('button', { name: 'View in English' }).click();
  await checkArt(390, 'en');
  await checkBrand(page, 'English landing');
  const englishNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  await englishNavigation.getByRole('button', { name: 'Ver en español' }).click();
  await navigation.getByRole('link', { name: 'Cómo funciona' }).click();
  await page.waitForURL(`${baseUrl}/#como-funciona`);
  assert.equal(await openMenu.getAttribute('aria-expanded'), 'false', 'Following a menu link must collapse it');

  await openMenu.click();
  const traceabilityLink = navigation.getByRole('link', { name: 'Trazabilidad', exact: true });
  assert.equal(await traceabilityLink.getAttribute('href'), '#trazabilidad');
  await traceabilityLink.click();
  await page.waitForURL(`${baseUrl}/#trazabilidad`);
  const traceability = await page.locator('#trazabilidad').innerText();
  for (const grams of [100, 10, 90]) assert.match(traceability, new RegExp(`\\b${grams}\\s*g\\b`));

  if (checkWaitlist) {
    await openMenu.click();
    const waitlistLink = navigation.getByRole('link', { name: 'Lista de espera', exact: true });
    assert.equal(await waitlistLink.getAttribute('href'), '#lista-de-espera');
    await waitlistLink.click();
    await page.waitForURL(`${baseUrl}/#lista-de-espera`);
    await checkWaitlistForms();
  }

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const hero = page.getByRole('region', { name: 'Tu cuidado, parte de tu historia.' });
  const process = hero.getByRole('link', { name: 'Conocer el proceso' });
  const access = hero.getByRole('link', { name: 'Acceder' });
  assert.equal(await process.getAttribute('href'), '#como-funciona');
  assert.equal(await access.getAttribute('href'), '/paciente');
  for (const button of [process, access]) {
    const box = await button.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, 'Primary mobile actions need a 44 px touch target');
  }
  await process.click();
  await page.waitForURL(`${baseUrl}/#como-funciona`);
  if (!checkWaitlist) {
    await access.click();
    await page.waitForURL(`${baseUrl}/paciente`);
  }

  const portals = [
    ['Pacientes', '/paciente', 'Entra como paciente'],
    ['Profesionales', '/medico', /^(Cuenta profesional|Acceso m[eé]dico)$/],
    ['Dispensarios', '/dispensario', /^(Cuenta de dispensario|Acceso operativo|Incorporar dispensario)$/],
    ['Administración', '/admin', /^(Acceso de administración|Admin aprueba actores antes de tocar Testnet\.)$/],
  ];
  for (const [label, path, heading] of portals) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const container = path === '/admin' ? page.locator('footer') : page.locator('#profesionales');
    const portal = container.getByRole('link', { name: new RegExp(`^${label}(?: |$)`) });
    assert.equal(await portal.getAttribute('href'), path);
    if (checkWaitlist) continue;
    await portal.click();
    await page.waitForURL(`${baseUrl}${path}`);
    await page.locator('.tl-relieve-hero').waitFor({ state: 'detached' });
    await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor();
    await checkBrand(page, path);
  }

  console.log('TrustLeaf landing passed at 320/390/768/1024/1440 px, with mobile navigation, ES/EN, traceability and portal destinations.');
  if (checkWaitlist) {
    console.log('Local waitlist mode verified the landing and all three forms. Run normal preview mode to verify the protected access screens, technical views and QR.');
  } else {
    await checkTechnicalRoutes();
    console.log('The four TrustLeaf technical views passed at 390/1440 px.');

    await page.setViewportSize({ width: 390, height: 844 });
    const verifierCases = [
      [DEMO_PUBLIC_VERIFICATION_TOKENS[0], 'Vigente'],
      [DEMO_PUBLIC_VERIFICATION_TOKENS[1], 'Revocada'],
      [DEMO_PUBLIC_VERIFICATION_TOKENS[2], 'Expirada'],
      ['unknown-demo-receipt', 'No disponible'],
    ];
    for (const [token, label] of verifierCases) {
      const url = new URL(`/verify/${encodeURIComponent(token)}`, baseUrl).href;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { level: 1, name: 'Verificación de comprobante', exact: true }).waitFor();
      await page.getByRole('heading', { name: label, exact: true }).waitFor();
      await checkBrand(page, `QR ${label}`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: label, exact: true }).waitFor();
      const secondTab = await context.newPage();
      secondTab.on('pageerror', error => errors.push(error.message));
      try {
        await secondTab.goto(url, { waitUntil: 'domcontentloaded' });
        await secondTab.getByRole('heading', { name: label, exact: true }).waitFor();
      } finally {
        await secondTab.close();
      }
    }
    console.log('All four demo QR states survived a direct visit, reload and new tab.');
  }
  assert.deepEqual(errors, [], 'Landing, access, technical views and demo verification must not raise uncaught errors');
} catch (error) {
  const failure = fileURLToPath(new URL('landing-failure.png', output));
  await page.screenshot({ path: failure, fullPage: true, timeout: 5000 }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
