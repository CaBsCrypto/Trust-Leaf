import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { fixture, notice, privateMarker, retiredKeys, seed, walletA, currentSourceHash } from './legacy-safety/fixture.mjs';

const beforeFix = process.argv.includes('--before-fix');
assert.ok(process.argv.slice(2).every(arg => arg === '--before-fix'), 'only --before-fix is supported');
const mode = beforeFix ? 'before-fix' : 'fixed';
const artifacts = fileURLToPath(new URL(`../../scratch/legacy-ui-read-safety/${mode}/`, import.meta.url));
const require = createRequire(import.meta.url);
const bannerText = `${notice} Esta vista no valida elegibilidad para entregar.`;
const report = { mode, baseline: beforeFix ? '3243904' : null, sourceHash: null, cases: [], nodeAttempts: [],
  retiredResponse: { status: 410, code: 'LEGACY_PRIVATE_ROUTE_DISABLED' },
  limits: ['Synthetic identity and service boundaries; no provider authentication or ledger validation.',
    'Chromium viewport simulation, not physical phones, keyboard, safe areas or other engines.',
    'System font fallback: Google Fonts import removed; full-page capture does not expand internal scrollers.'] };
const originals = [];
function deny(object, method, label) {
  originals.push([object, method, object[method]]);
  object[method] = () => { report.nodeAttempts.push(label); throw new Error('NODE_NETWORK_FORBIDDEN'); };
}
deny(globalThis, 'fetch', 'fetch');
for (const object of [http, https]) for (const method of ['request', 'get']) deny(object, method, `${object === http ? 'http' : 'https'}.${method}`);
deny(net.Socket.prototype, 'connect', 'tcp.connect'); deny(tls, 'connect', 'tls.connect');
let server, browser, owned;
const contexts = new Set();
function check(result, condition, code) { if (!condition && !result.violations.includes(code)) result.violations.push(code); }
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function session(role, width, cache, connected = true, options = {}) {
  const result = { role, width, height: width < 768 ? 844 : 900, cache, stages: [], violations: [],
    scenario: options.privy ? 'privy agenda' : options.view ?? (connected ? 'legacy views' : 'address transitions'), completed: false,
    externalAttempts: [], retiredRequests: [], mutations: [], unexpectedApis: [], pageErrors: [],
    consoleErrors: 0, privateConsoleMarkers: 0, renderError: null, responsive: [], diagnostics: [] };
  report.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: result.height }, serviceWorkers: 'block',
    timezoneId: 'America/Santiago', locale: 'es-CL', reducedMotion: 'reduce' });
  contexts.add(context);
  await context.addInitScript(({ entries, marker, keys }) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    window.__legacyServiceCalls = []; window.__legacyPrivateRenderings = 0;
    window.__legacyStorageWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && keys.includes(String(key))) window.__legacyStorageWrites.push(String(key));
      return setItem.call(this, key, value);
    };
    // Test reseeding is distinct from product writes and never touches component state.
    window.addEventListener('legacy-fixture-seed', event => {
      for (const key of keys) if (Object.hasOwn(event.detail, key)) setItem.call(localStorage, key, event.detail[key]);
    });
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.textContent?.includes(marker)) window.__legacyPrivateRenderings++;
      }
    }).observe(document, { subtree: true, childList: true });
  }, { entries: seed(cache, connected), marker: privateMarker, keys: retiredKeys });
  const page = await context.newPage(), logs = [];
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => { result.pageErrors.push(error.name); result.diagnostics.push(error.message); });
  page.on('console', message => {
    if (message.type() === 'error') { result.consoleErrors++; result.diagnostics.push(message.text()); }
    logs.push(Promise.all(message.args().map(argument => argument.evaluate(value => {
      if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack}`;
      try { return JSON.stringify(value); } catch { return String(value); }
    }).catch(() => message.text()))).then(values => {
      if (values.some(value => value?.includes(privateMarker))) result.privateConsoleMarkers++;
    }));
  });
  await context.routeWebSocket('**/*', socket => {
    result.externalAttempts.push('UNEXPECTED_WEBSOCKET'); socket.close();
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== owned.base) {
      result.externalAttempts.push('EXTERNAL_REQUEST_BLOCKED'); return route.abort('blockedbyclient');
    }
    if (!['GET', 'HEAD'].includes(request.method())) result.mutations.push({ method: request.method(), path: url.pathname });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (/^\/api\/stellar\/(?:patient\/[^/]+\/dashboard|dispensary\/validate-prescription)\/?$/.test(url.pathname)) {
      result.retiredRequests.push({ method: request.method(), path: url.pathname });
      return route.fulfill({ status: 410, json: { code: 'LEGACY_PRIVATE_ROUTE_DISABLED', message: privateMarker } });
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      return route.fulfill({ status: 451, json: { code: 'SYNTHETIC_MUTATION_FORBIDDEN' } });
    }
    if (options.privy && url.pathname === '/api/agenda') {
      check(result, request.headers()['privy-id-token'] === 'SYNTHETIC_ID_TOKEN', 'SYNTHETIC_TOKEN_MISMATCH');
      result.agendaReads = (result.agendaReads ?? 0) + 1;
      return route.fulfill({ json: { role: 'doctor', slots: [], selectedBooking: null } });
    }
    if (url.pathname === '/api/stellar/readiness') return route.fulfill({ json: {
      network: 'Synthetic isolated network', rpcUrl: '', contracts: { registryContractId: '', dispensaryRegistryContractId: '',
        prescriptionContractId: '', dispenseRecordContractId: '' },
      capabilities: { readContracts: false, issuePrescriptions: false, dispensePrescriptions: false, passkeyRelay: false, passkeyDiscovery: false },
      signers: { doctor: { configured: false, address: null }, dispensary: { configured: false, address: null } }, missing: [],
    } });
    result.unexpectedApis.push({ method: request.method(), path: url.pathname });
    return route.fulfill({ status: 451, json: { code: 'UNEXPECTED_SYNTHETIC_API' } });
  });
  await page.goto(`${owned.base}/?${new URLSearchParams({ role, ...(options.view ? { view: options.view } : {}),
    ...(options.privy ? { privy: 'true' } : {}), ...(options.technical ? { technical: 'true' } : {}) })}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__legacyFixtureListening === true && !!window.__legacyHost);
  await settle(page);
  async function finish() {
    await Promise.all(logs);
    const activity = await page.evaluate(() => ({ calls: window.__legacyServiceCalls, writes: window.__legacyStorageWrites }));
    result.serviceMutations = activity.calls.filter(call => call.kind === 'mutation');
    result.privateStorageWrites = activity.writes;
    check(result, result.externalAttempts.length === 0, 'EXTERNAL_ATTEMPT');
    check(result, result.retiredRequests.length === 0, 'RETIRED_PRIVATE_REQUEST');
    check(result, result.mutations.length === 0 && result.serviceMutations.length === 0, 'MUTATION_ATTEMPT');
    check(result, result.unexpectedApis.length === 0, 'UNEXPECTED_API');
    check(result, result.pageErrors.length === 0 && result.consoleErrors === 0, 'BROWSER_ERROR');
    check(result, result.privateConsoleMarkers === 0, 'PRIVATE_CONSOLE_MARKER');
    check(result, result.privateStorageWrites.length === 0, 'RETIRED_CACHE_WRITE');
    check(result, result.completed, 'INCOMPLETE_CASE');
    await context.close(); contexts.delete(context);
    console.log(`${result.violations.length ? 'FAIL' : 'PASS'} ${mode}: ${role} ${width} ${cache}: ${result.violations.join(', ') || 'isolated and unavailable'}`);
  }
  return { page, result, finish };
}

async function inspect(s, stage, requireNotice = true) {
  await settle(s.page);
  const state = await s.page.evaluate(({ keys, marker, notice }) => {
    const root = document.getElementById('root'), text = root?.textContent ?? '';
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return { cacheGone: keys.every(key => localStorage.getItem(key) === null),
      privateStorageWrites: window.__legacyStorageWrites.length,
      serviceMutations: window.__legacyServiceCalls.filter(call => call.kind === 'mutation').length,
      privateText: text.includes(marker) || text.includes('700001'),
      privateRenderings: window.__legacyPrivateRenderings, renderError: window.__legacyRenderError ?? null,
      eligible: ['Receta vigente y dispensable', 'Receta validada para dispensar', 'Ver receta activa'].some(value => normalized.includes(value)),
      enabledValidation: [...root.querySelectorAll('button')].some(button => {
        const label = button.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return (/^(Validar receta|Validar (cupo|saldo) y registrar retiro|Validacion heredada no disponible)$/.test(label)) && !button.disabled;
      }), banner: [...root.querySelectorAll('[role="status"]')].some(element => element.textContent.trim() === notice),
      dispensingPermission: text.includes('TL-RECETA-'),
      invalidProgress: [...root.querySelectorAll('[style]')].some(element => /(?:NaN|Infinity)/.test(element.getAttribute('style'))),
    };
  }, { keys: retiredKeys, marker: privateMarker, notice: bannerText });
  s.result.stages.push({ name: stage, ...state, externalAttempts: s.result.externalAttempts.length,
    retiredRequests: s.result.retiredRequests.length, apiMutations: s.result.mutations.length,
    unexpectedApis: s.result.unexpectedApis.length });
  s.result.renderError = state.renderError?.name ?? null;
  check(s.result, !state.renderError, 'CACHE_RENDER_EXCEPTION');
  check(s.result, state.cacheGone, 'RETIRED_CACHE_SURVIVES');
  check(s.result, !state.privateText && state.privateRenderings === 0, 'FOREIGN_PRIVATE_RENDERING');
  check(s.result, !state.eligible && !state.enabledValidation, 'ELIGIBILITY_OR_DELIVERY_ENABLED');
  check(s.result, !state.dispensingPermission, 'DISPENSING_PERMISSION_RENDERED');
  check(s.result, !state.invalidProgress, 'INVALID_PROGRESS');
  check(s.result, state.privateStorageWrites === 0, 'RETIRED_CACHE_WRITE');
  check(s.result, state.serviceMutations === 0 && s.result.mutations.length === 0, 'MUTATION_ATTEMPT');
  if (requireNotice) check(s.result, state.banner, 'UNAVAILABLE_NOTICE_MISSING');
}

async function change(s, kind) {
  const entries = seed('foreign');
  const revision = await s.page.evaluate(({ kind, entries }) => {
    window.dispatchEvent(new CustomEvent('legacy-fixture-seed', { detail: entries }));
    const host = window.__legacyHost, next = { ...host.session };
    const detail = {};
    if (kind === 'session') { next.createdAt = '2026-10-04T12:00:01.000Z'; detail.session = next; }
    if (kind === 'email') { next.email = `${next.role}-b@example.test`; detail.session = next; }
    if (kind === 'role') { next.role = next.role === 'patient' ? 'dispensary' : 'patient'; detail.session = next; }
    if (kind === 'subject') detail.identity = { subject: 'did:privy:synthetic-replacement' };
    if (kind === 'logout') { detail.session = null; detail.identity = { subject: '', authenticated: false, ready: true }; }
    window.dispatchEvent(new CustomEvent('legacy-fixture-change', { detail }));
    return host.revision + 1;
  }, { kind, entries });
  await s.page.waitForFunction(revision => window.__legacyHost.revision === revision, revision);
  await inspect(s, kind);
}

async function geometry(s, locator, label) {
  if (!await locator.count()) return;
  await locator.scrollIntoViewIfNeeded();
  const measurement = await locator.evaluate(element => {
    const box = element.getBoundingClientRect(), point = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { x: box.x, right: box.right, width: box.width, height: box.height,
      fits: box.x >= -1 && box.right <= innerWidth + 1,
      reachable: box.y >= -1 && box.bottom <= innerHeight + 1 && !!point && (element.contains(point) || point.contains(element)) };
  });
  s.result.responsive.push({ label, ...measurement });
  check(s.result, measurement.fits && measurement.reachable && measurement.width > 0 && measurement.height > 0, 'CRITICAL_CONTROL_CLIPPED');
}

async function dispensaryPanels(s) {
  if (s.result.renderError) return;
  await s.page.getByRole('button', { name: 'Escanear QR / validar receta', exact: true }).click();
  const panel = s.page.locator('aside').filter({ has: s.page.getByRole('heading', { name: 'Validar QR de receta', exact: true }) });
  await panel.waitFor({ state: 'visible' });
  const validation = panel.getByRole('button').filter({ hasText: /Validar receta|Validaci[o\u00f3]n heredada no disponible/ });
  check(s.result, await validation.isDisabled(), 'VALIDATION_BUTTON_ENABLED');
  await geometry(s, validation, 'validation drawer');
  await inspect(s, 'validation drawer');
  await panel.getByRole('button', { name: 'Cerrar panel', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await s.page.getByRole('button', { name: 'Registrar retiro', exact: true }).click();
  const deliveryPanel = s.page.locator('aside').filter({ has: s.page.getByRole('heading', { name: 'Registrar retiro', exact: true }) });
  await deliveryPanel.waitFor({ state: 'visible' });
  const delivery = deliveryPanel.getByRole('button', { name: 'Validar cupo y registrar retiro', exact: true });
  check(s.result, await delivery.isDisabled(), 'DELIVERY_BUTTON_ENABLED');
  const balance = deliveryPanel.getByText('Disponible antes de retirar', { exact: true }).locator('..');
  const balanceText = (await balance.locator(':scope > span').last().textContent()).trim();
  s.result.retiredBalance = balanceText;
  check(s.result, balanceText === '0g', 'NONZERO_RETIRED_BALANCE');
  await geometry(s, delivery, 'delivery drawer');
  await inspect(s, 'delivery drawer');
  await deliveryPanel.getByRole('button', { name: 'Cerrar panel', exact: true }).click();
  await deliveryPanel.waitFor({ state: 'hidden' });
}

try {
  await mkdir(artifacts, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  owned = await fixture(beforeFix, artifacts); server = owned.server; report.sourceHash = owned.sourceHash;
  await server.listen(); owned.base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  for (const role of ['patient', 'dispensary']) for (const width of [360, 390, 768, 1024, 1440]) for (const cache of ['foreign', 'malformed']) {
    const s = await session(role, width, cache);
    try {
      await inspect(s, 'mount');
      if (!s.result.renderError) {
        await geometry(s, s.page.getByRole('status').filter({ hasText: notice }).first(), 'unavailable banner');
        if (cache === 'foreign' && [390, 1440].includes(width)) await s.page.screenshot({ path: `${artifacts}/${role}-${width}.png`, fullPage: true });
        if (role === 'dispensary') await dispensaryPanels(s);
        if (cache === 'foreign') for (const kind of ['session', 'email', 'role', 'subject', 'logout']) await change(s, kind);
      }
      s.result.completed = true;
    } finally { await s.finish(); }
  }
  // The historical negative control uses only the common read/cache scenarios.
  if (!beforeFix) for (const width of [390, 1440]) {
    const s = await session('doctor', width, 'foreign', true, { technical: true });
    try {
      await inspect(s, 'doctor mount');
      const preview = s.page.getByRole('button', { name: 'Crear vista previa DEMO', exact: true });
      if (!s.result.renderError) {
        check(s.result, await preview.count() === 1 && await preview.isEnabled(), 'PREVIEW_UNREACHABLE');
        if (await preview.count() === 1 && await preview.isEnabled()) {
          await preview.click();
          await preview.waitFor({ state: 'visible' });
          await s.page.getByRole('paragraph').filter({ hasText: /^DEMO.*vista previa local;/ }).waitFor();
          check(s.result, await preview.isEnabled(), 'PREVIEW_NOT_SETTLED');
          await inspect(s, 'reachable preview');
        }
      }
      for (const kind of ['session', 'email', 'subject', 'logout']) await change(s, kind);
      s.result.completed = true;
    } finally { await s.finish(); }
  }
  // Address transitions use the real onboarding and reset actions, not internal hook setters.
  if (!beforeFix) for (const width of [390, 1440]) {
    const s = await session('patient', width, 'foreign', false);
    try {
      if (!s.result.renderError) {
        await s.page.getByRole('button', { name: /Conectar Freighter.*Vincular wallet externa/ }).click();
        await s.page.waitForFunction(() => JSON.parse(localStorage.getItem('trust_wallet_setup')).contractAccount === `G${'B'.repeat(55)}`);
        await inspect(s, 'address connection');
        const revision = await s.page.evaluate(() => {
          const previous = window.__legacyHost.revision;
          window.dispatchEvent(new CustomEvent('legacy-fixture-change', { detail: { technical: true } })); return previous + 1;
        });
        await s.page.waitForFunction(revision => window.__legacyHost.revision === revision, revision);
        const prepare = s.page.getByRole('button', { name: 'Preparar flujo', exact: true }).first();
        check(s.result, await prepare.isEnabled(), 'PREPARE_UNREACHABLE');
        await prepare.click();
        await s.page.getByText('Flujo de revision preparado', { exact: true }).waitFor();
        await inspect(s, 'reachable preparation');
        await s.page.getByRole('button', { name: 'Reiniciar flujo', exact: true }).click();
        await s.page.getByText('Flujo reiniciado para revision', { exact: true }).waitFor();
        await s.page.waitForFunction(address => JSON.parse(localStorage.getItem('trust_wallet_setup')).contractAccount !== address, `G${'B'.repeat(55)}`);
        await inspect(s, 'address reset');
        const address = await s.page.evaluate(() => JSON.parse(localStorage.getItem('trust_wallet_setup')).contractAccount);
        check(s.result, address !== walletA, 'ADDRESS_TRANSITION_NOT_EXERCISED');
      }
      s.result.completed = true;
    } finally { await s.finish(); }
  }
  if (!beforeFix) for (const width of [390, 1440]) {
    const s = await session('dispensary', width, 'foreign', true, { view: 'pickups' });
    try {
      await inspect(s, 'retired pickup cache');
      check(s.result, await s.page.getByRole('button', { name: 'Mostrar token', exact: true }).count() === 0,
        'RETIRED_TOKEN_ACTION_REACHABLE');
      s.result.completed = true;
    } finally { await s.finish(); }
    const agenda = await session('doctor', width, 'foreign', true, { privy: true });
    try {
      await agenda.page.getByRole('heading', { name: 'Mi agenda', exact: true }).waitFor();
      await agenda.page.getByText('No hay horarios ni citas en esta semana.', { exact: true }).waitFor();
      check(agenda.result, agenda.result.agendaReads > 0, 'REAL_AGENDA_NOT_LOADED');
      await inspect(agenda, 'real PrivyAgenda');
      agenda.result.completed = true;
    } finally { await agenda.finish(); }
  }
  report.unhandledApis = owned.unhandledApis;
  assert.equal(report.cases.length, beforeFix ? 20 : 28, 'the entire scenario matrix must run');
  assert.deepEqual(owned.unhandledApis, [], 'no API may fall through to a server');
  if (!beforeFix) {
    report.workingSourceHash = await currentSourceHash();
    report.sourceMatchesWorkingFile = report.workingSourceHash === report.sourceHash;
    assert.ok(report.sourceMatchesWorkingFile, 'portal changed during the run; repeat against the final source');
  }
} catch (error) {
  report.infrastructureFailure = { name: error.name, message: error.message };
  console.error(`${mode} fixture failure: ${error.message}`);
} finally {
  const cleanupFailures = [];
  for (const context of contexts) {
    try { await context.close(); contexts.delete(context); }
    catch (error) { cleanupFailures.push({ resource: 'context', name: error.name }); }
  }
  try { await browser?.close(); } catch (error) { cleanupFailures.push({ resource: 'browser', name: error.name }); }
  try { await server?.close(); } catch (error) { cleanupFailures.push({ resource: 'server', name: error.name }); }
  for (const [object, method, original] of originals.reverse()) object[method] = original;
  report.cleanup = { contextsClosed: contexts.size === 0, browserClosed: !browser?.isConnected(),
    serverClosed: !server?.httpServer.listening, failures: cleanupFailures };
  const cleaned = report.cleanup.contextsClosed && report.cleanup.browserClosed && report.cleanup.serverClosed && !cleanupFailures.length;
  report.unhandledApis = owned?.unhandledApis ?? [];
  report.isolation = { externalAttempts: report.cases.reduce((sum, result) => sum + result.externalAttempts.length, 0),
    apiMutations: report.cases.reduce((sum, result) => sum + result.mutations.length, 0),
    serviceMutations: report.cases.reduce((sum, result) => sum + (result.serviceMutations?.length ?? 0), 0),
    unexpectedApis: report.cases.reduce((sum, result) => sum + result.unexpectedApis.length, 0),
    nodeAttempts: report.nodeAttempts.length, unhandledApis: report.unhandledApis.length };
  const isolated = Object.values(report.isolation).every(value => value === 0);
  const failedCases = report.cases.filter(result => result.violations.length).length;
  report.failedCases = failedCases;
  report.expectedFailure = beforeFix && cleaned && isolated && !report.infrastructureFailure && failedCases > 0
    && report.cases.some(result => result.violations.includes('FOREIGN_PRIVATE_RENDERING') || result.violations.includes('RETIRED_PRIVATE_REQUEST'));
  report.passed = !beforeFix && cleaned && isolated && !report.infrastructureFailure && failedCases === 0;
  await writeFile(`${artifacts}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.expectedFailure ? 'EXPECTED BASELINE FAILURE' : report.passed ? 'PASS' : 'FAIL'}: ${report.cases.length} cases; ${failedCases} failed; ${report.nodeAttempts.length} Node network attempts. Cleanup ${cleaned ? 'PASS' : 'FAIL'}.`);
  process.exitCode = report.passed ? 0 : report.expectedFailure ? 1 : 2;
}
