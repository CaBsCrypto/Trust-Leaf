import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import tailwind from '@tailwindcss/vite';
import { operationsDatabase } from '../sql/operations-db.mjs';
import { joinTeam } from '../sql/team-fixtures.mjs';
import { navigateSection } from './workspace-navigation.mjs';

// Actual ephemeral SQL and real React components. Every API is intercepted; no identity provider is mounted.
const beforeFix = process.argv.includes('--before-fix');
assert.ok(process.argv.slice(2).every(arg => arg === '--before-fix'));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = fileURLToPath(new URL('../../scratch/shared-patient-read-failure/', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const originalFetch = globalThis.fetch;
let nodeExternalAttempts = 0;
globalThis.fetch = async () => { nodeExternalAttempts++; throw new Error('EXTERNAL_NETWORK_DISABLED'); };
let base;
let db, browser, server;
try {
  await mkdir(artifacts, { recursive: true });
  const fixture = await operationsDatabase();
  db = fixture.db;
  const { actors, subjects, call, agenda } = fixture;
  const mutate = (key, action, input = {}) => call(key, action, { ...input, operationId: randomUUID() });
  async function owner(sql, args = []) {
    await db.exec('reset role');
    try { return await db.query(sql, args); }
    finally { await db.exec('set role service_role'); }
  }
  for (const key of ['doctor', 'patient', 'dispensary', 'dispensaryB', 'operator']) await mutate(key, 'join', { acceptSyntheticOnly: true });
  const profile = { name: 'SYNTHETIC PRIVATE PATIENT', email: 'private@example.test', phone: '000610000', version: 0, syntheticOnly: true };
  await mutate('patient', 'save-profile', profile);
  const org = (await mutate('dispensary', 'create-organization', { name: 'Synthetic own organization' })).resourceRef;
  const foreignOrg = (await mutate('dispensaryB', 'create-organization', { name: 'Synthetic foreign organization' })).resourceRef;
  await joinTeam(db, subjects.dispensary, subjects.operator);
  const slotRef = randomUUID(), bookingRef = randomUUID();
  await agenda('doctor', 'publish', { slotRef, startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 88200000).toISOString(), operationId: randomUUID() });
  await agenda('patient', 'reserve', { slotRef, bookingRef, version: 1, operationId: randomUUID() });
  await mutate('doctor', 'start-encounter', { resourceRef: bookingRef });
  await mutate('doctor', 'save-note', { resourceRef: bookingRef, version: 1, note: 'PRIVATE_CLINICAL_NOTE_NOT_SHARED' });
  await mutate('doctor', 'complete-encounter', { resourceRef: bookingRef, version: 2, issueTreatment: true, allowanceMg: 30000, periodCount: 3 });
  const treatment = (await call('patient', 'snapshot')).treatments[0];
  for (const organizationRef of [org, foreignOrg]) await mutate('patient', 'grant', { resourceRef: treatment.treatment_ref, organizationRef });
  const batches = {};
  for (const key of ['dispensary', 'dispensaryB']) batches[key] = (await mutate(key, 'receive-batch', {
    lotCode: `SYNTHETIC-${key}`, product: `Synthetic product ${key}`, sourceReference: 'SYNTHETIC ONLY',
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), quantityMg: 100000,
  })).resourceRef;
  const ownReceipt = (await mutate('operator', 'dispense', { resourceRef: treatment.treatment_ref, batchRef: batches.dispensary, quantityMg: 1000 })).resourceRef;
  const foreignReceipt = (await mutate('dispensaryB', 'dispense', { resourceRef: treatment.treatment_ref, batchRef: batches.dispensaryB, quantityMg: 1000 })).resourceRef;
  const tables = (await owner("select tablename from pg_catalog.pg_tables where schemaname='trustleaf_private' order by tablename")).rows.map(row => row.tablename);
  async function fingerprint() {
    const rows = [];
    for (const table of tables) {
      assert.match(table, /^[a-z0-9_]+$/);
      rows.push([table, (await owner(`select to_jsonb(t) as row from trustleaf_private.${table} t`)).rows.map(row => JSON.stringify(row.row)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }
  const historical = new Map();
  if (beforeFix) for (const name of ['operations/OperationsWorkspace.tsx', 'operations/DispensaryAttention.tsx', 'operations/TeamPanel.tsx', 'commerce/CommercePanel.tsx']) {
    const path = `src/features/${name}`;
    historical.set(path, execFileSync('git', ['show', `a2bf39d:${path}`], { cwd: repository, encoding: 'utf8' }));
  }
  server = await createServer({ configFile: false, envFile: false, root: fileURLToPath(new URL('./', import.meta.url)),
    cacheDir: `${artifacts}/vite-cache`, plugins: [tailwind(), { name: 'pre-fix-source', enforce: 'pre', transform(code, id) {
      const path = id.split('?')[0].replaceAll('\\', '/');
      for (const [name, source] of historical) if (path.endsWith(`/${name}`)) return source;
    } }], esbuild: { jsx: 'automatic' },
    define: { 'import.meta.env.VITE_COMMERCE_CATALOG_ENABLED': JSON.stringify('true') },
    resolve: { alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name => [name,
      fileURLToPath(new URL(`./node_modules/${name}${name === 'lucide-react' ? '/dist/esm/lucide-react.js' : ''}`, import.meta.url))])) },
    server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false,
      fs: { allow: [repository] }, watch: { ignored: ['**/.env*', '**/supabase/**', '**/.git/**'] } },
  });
  server.middlewares.use('/api', (_req, res) => { res.statusCode = 451; res.end('ISOLATED_API_ONLY'); });
  await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });

  async function session(key, width, state = { mode: 'ok' }) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'America/Santiago' });
    const page = await context.newPage(), external = [], errors = [], posts = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { external.push('EXTERNAL_REQUEST_BLOCKED'); return route.abort('blockedbyclient'); }
      if (url.pathname === '/api/operations-pilot') {
        assert.equal(request.headers()['privy-id-token'], `fixture-${state.identity ?? key}`, 'the SQL fixture key is paired with the actual synthetic subject');
        if (request.method() === 'POST') {
          const command = request.postDataJSON(); posts.push(command);
          assert.ok(state.allowIsolatedWrite, 'no business write is allowed by this scenario');
          const result = await call(key, command.action, command.input);
          if (state.loseWrite) { state.loseWrite = false; state.mode = '503'; return route.fulfill({ status: 503, json: {} }); }
          return route.fulfill({ json: result });
        }
        if (state.holdNextRead) {
          state.holdNextRead = false;
          state.readStarted();
          await new Promise(resolve => { state.releaseRead = resolve; });
        }
        if (state.mode === 'network') return route.abort('failed');
        if (state.mode === 'invalid-json') return route.fulfill({ contentType: 'application/json', body: 'PRIVATE_PARSE_SENTINEL invalid JSON' });
        if (state.mode === 'invalid-response') return route.fulfill({ json: { synthetic: false } });
        if (state.mode !== 'ok') return route.fulfill({ status: Number(state.mode), json: {} });
        return route.fulfill({ json: state.snapshot ?? await call(key, 'snapshot') });
      }
      if (url.pathname === '/api/team-invitations') {
        const command = request.postDataJSON(); assert.equal(command.action, 'list', 'team business writes stay blocked');
        return route.fulfill({ json: { organization: { name: 'Synthetic own organization' }, membership: { role: key === 'operator' ? 'operator' : 'manager' },
          invitationsEnabled: true, invitations: [], members: [{ actorRef: actors[key], email: 'team@example.test', role: key === 'operator' ? 'operator' : 'manager' }] } });
      }
      if (url.pathname === '/api/dispensary-commerce') {
        if (request.method() === 'POST') {
          assert.ok(state.commerceWrites, 'commerce business writes stay blocked');
          const command = request.postDataJSON(); state.commerceWrites.push(command);
          if (state.commerceWrites.length === 1) {
            state.commerceItems = [{ product_ref: 'synthetic-commercial-product', code: command.input.code,
              name: command.input.name, presentation: command.input.presentation, reorder_mg: 0,
              reference_price_clp: null, archived: false, version: 1 }];
            return route.fulfill({ status: 503, json: {} });
          }
          assert.deepEqual(command, state.commerceWrites[0]);
          return route.fulfill({ json: { synthetic: true, resourceRef: 'synthetic-commercial-product', replayed: true } });
        }
        return route.fulfill({ json: { synthetic: true, items: url.searchParams.get('collection') === 'products' ? state.commerceItems ?? [] : [], nextOffset: null } });
      }
      if (url.pathname.startsWith('/api/')) throw new Error(`Unexpected synthetic API ${url.pathname}`);
      return route.continue();
    });
    await page.goto(`${base}/?operations&role=${key}`);
    const firstTab = key === 'doctor' ? 'Consultas' : key === 'patient' ? 'Mi atencion' : key === 'admin' ? 'Actividad' : 'Inventario';
    await page.getByRole('tab', { name: firstTab, exact: true, includeHidden: true }).waitFor({ state: 'attached' });
    return { context, page, external, errors, posts, state };
  }
  async function refresh(page, state, mode) {
    state.mode = mode;
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    const parentError = page.locator('.op-content > .op-error');
    if (mode === 'ok') await parentError.waitFor({ state: 'hidden' });
    else await parentError.waitFor();
  }
  async function prepare(page) {
    await navigateSection(page, 'Pacientes'); await page.locator('.op-patient').click();
    await page.getByRole('radio', { name: /SYNTHETIC-dispensary/ }).check();
    await page.getByLabel('Cantidad en gramos', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Revisar entrega', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).waitFor();
  }
  async function verifyWithdrawal(page) {
    await page.locator('.op-patient').waitFor({ state: 'hidden' });
    const text = await page.locator('body').textContent();
    for (const marker of [profile.name, profile.email, profile.phone, foreignReceipt, 'Permiso vigente', 'PRIVATE_CLINICAL_NOTE_NOT_SHARED', 'PRIVATE_PARSE_SENTINEL']) assert.equal(text.includes(marker), false, `withdraw ${marker}`);
    assert.equal(await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).count(), 0);
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    assert.equal(await page.getByRole('searchbox').inputValue(), '');
    await navigateSection(page, 'Historial');
    await page.getByText('Entrega de este dispensario', { exact: true }).waitFor();
    await page.getByText('Ver comprobante y trazabilidad', { exact: true }).click();
    assert.ok((await page.locator('body').innerText()).includes(ownReceipt), 'own receipt remains');
    assert.equal((await page.locator('body').innerText()).includes(foreignReceipt), false);
    assert.equal((await page.getByLabel('Lote del historial').innerText()).includes('SYNTHETIC-dispensaryB'), false);
    await navigateSection(page, 'Inventario');
    await page.getByText('Lote SYNTHETIC-dispensary', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  const modes = ['503', 'network', 'invalid-json', 'invalid-response'];
  for (const revocation of ['grant', 'treatment', 'patient-actor']) for (const key of ['dispensary', 'operator']) for (const width of [360, 390, 768, 1024, 1440]) {
    const s = await session(key, width);
    try {
      await prepare(s.page);
      if (revocation === 'grant') await mutate('patient', 'revoke-grant', { resourceRef: treatment.treatment_ref, organizationRef: org });
      else if (revocation === 'treatment') await mutate('doctor', 'revoke-treatment', { resourceRef: treatment.treatment_ref, version: treatment.version });
      else await owner("update trustleaf_private.actor_bindings set state='revoked' where actor_ref=$1", [actors.patient]);
      const authoritative = await call(key, 'snapshot');
      assert.deepEqual(authoritative.patientProfiles, []);
      assert.deepEqual(authoritative.treatments, []);
      assert.deepEqual(authoritative.deliveries.map(d => d.delivery_ref), [ownReceipt]);
      const before = await fingerprint();
      await assert.rejects(mutate(key, 'dispense', { resourceRef: treatment.treatment_ref, batchRef: batches.dispensary, quantityMg: 1000 }), error => ['42501', 'PT409'].includes(error.code));
      assert.equal(await fingerprint(), before);
      await refresh(s.page, s.state, modes[[360, 390, 768, 1024, 1440].indexOf(width) % modes.length]);
      await verifyWithdrawal(s.page);
      if ([390, 1440].includes(width) && revocation === 'grant') await s.page.screenshot({ path: `${artifacts}/withdrawal-${key}-${width}.png`, fullPage: true });
      await refresh(s.page, s.state, 'ok');
      await navigateSection(s.page, 'Pacientes');
      await s.page.getByText('No hay pacientes con permiso vigente.', { exact: true }).waitFor();
      assert.equal(s.posts.length, 0); assert.deepEqual(s.external, []); assert.deepEqual(s.errors, []);
      console.log(`PASS ${key} ${width} ${revocation}: SQL denial, private withdrawal, own records, recovery`);
    } finally {
      await s.context.close();
      if (revocation === 'grant') await mutate('patient', 'grant', { resourceRef: treatment.treatment_ref, organizationRef: org });
      else if (revocation === 'treatment') await owner("update trustleaf_private.pilot_treatments set state='active',version=$2 where treatment_ref=$1", [treatment.treatment_ref, treatment.version]);
      else await owner("update trustleaf_private.actor_bindings set state='active' where actor_ref=$1", [actors.patient]);
    }
  }
  for (const width of [390, 1440]) {
    const s = await session('dispensary', width);
    try {
      await prepare(s.page); await refresh(s.page, s.state, '503'); await verifyWithdrawal(s.page);
      await refresh(s.page, s.state, 'ok'); await navigateSection(s.page, 'Pacientes');
      await s.page.locator('.op-patient').waitFor();
      assert.equal(await s.page.getByLabel('Cantidad en gramos', { exact: true }).count(), 0, 'recovery never auto-selects or restores preparation');
      await navigateSection(s.page, 'Inventario');
      await s.page.locator('.op-stock-receive > summary').click();
      const draft = s.page.getByLabel('Codigo de lote', { exact: true });
      await draft.fill('UNSAVED-OWN-RECEIPT');
      await refresh(s.page, s.state, '503');
      assert.equal(await draft.inputValue(), 'UNSAVED-OWN-RECEIPT');
      assert.equal(await draft.isDisabled(), true);
      await s.page.getByRole('button', { name: 'Recibir lote simulado', exact: true }).evaluate(button => button.click());
      assert.equal(s.posts.length, 0);
      await refresh(s.page, s.state, 'ok');
      assert.equal(await draft.inputValue(), 'UNSAVED-OWN-RECEIPT');
      await s.page.getByRole('tab', { name: 'Gestion', exact: true, includeHidden: true }).click();
      await s.page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      await s.page.getByRole('button', { name: 'Nuevo producto', exact: true }).waitFor();
      await refresh(s.page, s.state, '503');
      assert.equal(await s.page.getByRole('button', { name: 'Nuevo producto', exact: true }).isDisabled(), true);
      await s.page.getByRole('button', { name: 'Equipo', exact: true }).click();
      await s.page.getByLabel('Correo del trabajador', { exact: true }).waitFor();
      assert.equal(await s.page.getByLabel('Correo del trabajador', { exact: true }).isDisabled(), true);
      assert.equal(s.posts.length, 0); assert.deepEqual(s.external, []); assert.deepEqual(s.errors, []);
      console.log(`PASS manager ${width}: explicit recovery, preserved inventory draft, commerce/team write gates`);
    } finally { await s.context.close(); }
  }
  const pendingSession = await session('dispensary', 1440, { mode: 'ok', allowIsolatedWrite: true, loseWrite: true });
  try {
    const { page, state, posts } = pendingSession;
    await navigateSection(page, 'Inventario'); await page.locator('.op-stock-receive > summary').click();
    await page.getByLabel('Codigo de lote', { exact: true }).fill('SYNTHETIC-UNCERTAIN');
    await page.getByLabel('Referencia de origen', { exact: true }).fill('SYNTHETIC ONLY');
    await page.getByLabel('Vencimiento', { exact: true }).fill(`${new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)}T12:00`);
    await page.getByLabel('Cantidad en gramos', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Recibir lote simulado', exact: true }).click();
    await page.getByText('No se pudo verificar la autorizacion del paciente.', { exact: false }).waitFor();
    assert.equal(posts.length, 1);
    assert.equal(await page.getByRole('button', { name: 'Reintentar operacion', exact: true }).count(), 0);
    await refresh(page, state, 'ok');
    await page.getByRole('button', { name: 'Reintentar operacion', exact: true }).click();
    await page.getByText('Cambio guardado.', { exact: true }).waitFor();
    assert.deepEqual(posts[0], posts[1]);
    assert.equal((await call('dispensary', 'snapshot')).batches.filter(b => b.lot_code === 'SYNTHETIC-UNCERTAIN').length, 1);
    assert.deepEqual(pendingSession.external, []); assert.deepEqual(pendingSession.errors, []);
    console.log('PASS uncertain isolated receipt: exact operation retry, one durable batch');
  } finally { await pendingSession.context.close(); }
  for (const status of ['401', '403']) {
    const s = await session('operator', 390);
    try {
      await prepare(s.page); await refresh(s.page, s.state, status);
      await s.page.locator('.op-dispensary').waitFor({ state: 'hidden' });
      assert.equal((await s.page.locator('body').innerText()).includes(profile.name), false);
      assert.equal(s.posts.length, 0);
      assert.deepEqual(s.external, []); assert.deepEqual(s.errors, []);
      console.log(`PASS authorization ${status}: full withdrawal`);
    } finally { await s.context.close(); }
  }
  const identitySession = await session('operator', 1440);
  try {
    await prepare(identitySession.page);
    identitySession.state.mode = '503';
    identitySession.state.identity = 'other-account';
    await identitySession.page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-identity', { detail: 'other-account' })));
    await identitySession.page.locator('.op-dispensary').waitFor({ state: 'hidden' });
    assert.equal((await identitySession.page.locator('body').innerText()).includes(profile.name), false);
    assert.equal(identitySession.posts.length, 0);
    assert.deepEqual(identitySession.external, []); assert.deepEqual(identitySession.errors, []);
    console.log('PASS identity change: no previous projection survives');
  } finally { await identitySession.context.close(); }

  for (const panel of ['commerce', 'team']) {
    const s = await session('dispensary', 1440);
    try {
      await s.page.getByRole('tab', { name: 'Gestion', exact: true }).click();
      if (panel === 'commerce') {
        await s.page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
        await s.page.getByLabel('Nombre', { exact: true }).fill('Synthetic gated product');
        await s.page.getByLabel('Codigo interno', { exact: true }).fill('SYNTHETIC-GATED');
      } else {
        await s.page.getByRole('button', { name: 'Equipo', exact: true }).click();
        await s.page.getByLabel('Correo del trabajador', { exact: true }).fill('synthetic-team@example.test');
        await s.page.getByRole('button', { name: 'Preparar invitacion', exact: true }).click();
      }
      const started = new Promise(resolve => { s.state.readStarted = resolve; });
      s.state.holdNextRead = true;
      await s.page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
      await started;
      await s.page.evaluate(() => window.dispatchEvent(new Event('fixture-hold-token')));
      await s.page.getByRole('button', { name: panel === 'commerce' ? 'Guardar' : 'Enviar invitacion', exact: true }).click();
      s.state.mode = '503'; s.state.releaseRead();
      await s.page.getByText('No se pudo verificar la autorizacion del paciente.', { exact: false }).waitFor();
      await s.page.evaluate(() => window.dispatchEvent(new Event('fixture-release-token')));
      await s.page.getByText('Actualiza los permisos antes de reintentar la misma operacion.', { exact: true }).waitFor();
      assert.equal(s.posts.length, 0); assert.deepEqual(s.external, []); assert.deepEqual(s.errors, []);
      console.log(`PASS ${panel}: parent failed GET blocks a mutation waiting for its token`);
    } finally { await s.context.close(); }
  }
  const commercial = await session('dispensary', 1440, { mode: 'ok', commerceWrites: [] });
  try {
    const { page, state } = commercial;
    const own = await call('dispensary', 'snapshot');
    await page.getByRole('tab', { name: 'Gestion', exact: true }).click();
    await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Synthetic uncertain commercial product');
    await page.getByLabel('Codigo interno', { exact: true }).fill('SYNTHETIC-COMMERCIAL');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const retry = page.getByRole('button', { name: 'Reintentar la misma operacion', exact: true });
    await retry.waitFor();
    state.snapshot = { ...own, membership: { ...own.membership, role: 'operator' } };
    await refresh(page, state, 'ok');
    await page.locator('.op-header').getByText('Operador', { exact: true }).waitFor();
    await retry.waitFor({ state: 'hidden' });
    assert.equal(await page.getByLabel('Codigo interno', { exact: true }).count(), 0);
    state.snapshot = own;
    await refresh(page, state, 'ok');
    await page.locator('.op-header').getByText('Encargado', { exact: true }).waitFor();
    await retry.waitFor();
    await retry.click();
    await page.getByText('Guardado. Referencia: synthetic-commercial-product', { exact: true }).waitFor();
    assert.deepEqual(state.commerceWrites[0], state.commerceWrites[1]);
    assert.equal(state.commerceItems.length, 1, 'one effect in this intercepted commercial journal');
    assert.deepEqual(commercial.external, []); assert.deepEqual(commercial.errors, []);
    console.log('PASS commerce: demotion withdraws private UI, restoration recovers the same pending ID');
  } finally { await commercial.context.close(); }

  const activeSlot = randomUUID(), activeBooking = randomUUID();
  await agenda('doctor', 'publish', { slotRef: activeSlot, startsAt: new Date(Date.now() + 172800000).toISOString(),
    endsAt: new Date(Date.now() + 174600000).toISOString(), operationId: randomUUID() });
  await agenda('patient', 'reserve', { slotRef: activeSlot, bookingRef: activeBooking, version: 1, operationId: randomUUID() });
  await mutate('doctor', 'start-encounter', { resourceRef: activeBooking });
  for (const key of ['doctor', 'patient']) for (const width of [390, 1440]) {
    const s = await session(key, width);
    try {
      let draft;
      if (key === 'doctor') {
        await s.page.getByRole('button', { name: /^En atenci/ }).click();
        draft = s.page.locator('article').filter({ hasText: activeBooking }).getByLabel('Nota de prueba', { exact: true });
      } else {
        await s.page.getByRole('tab', { name: 'Tratamientos', exact: true }).click();
        draft = s.page.getByLabel('Nombre ficticio', { exact: true });
      }
      await draft.fill('SYNTHETIC OWN UNSAVED DRAFT');
      for (const mode of ['503', 'network', 'invalid-json']) {
        await refresh(s.page, s.state, mode);
        assert.equal(await draft.inputValue(), 'SYNTHETIC OWN UNSAVED DRAFT');
        assert.equal(await draft.isDisabled(), true);
        await refresh(s.page, s.state, 'ok');
        assert.equal(await draft.inputValue(), 'SYNTHETIC OWN UNSAVED DRAFT');
      }
      assert.equal(s.posts.length, 0); assert.deepEqual(s.external, []); assert.deepEqual(s.errors, []);
      console.log(`PASS ${key} ${width}: own drafts survive transient GET failures without writes`);
    } finally { await s.context.close(); }
  }
  assert.equal(nodeExternalAttempts, 0, 'Node made no external fetch attempts');
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  if (db) await db.close();
  globalThis.fetch = originalFetch;
}
