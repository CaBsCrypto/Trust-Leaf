import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/MockupPortal.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('MockupPortal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(name: string) {
  let result: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, `Actual component declaration ${name} must exist`);
  return result.getText(ast);
}
function evaluate(expression: string, context: Record<string, unknown>) {
  const code = ts.transpileModule(`const result = ${expression}; result;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return vm.runInNewContext(code, context);
}

for (const role of ['dispensary', 'patient']) {
  for (const failure of ['410', '503', 'network', 'invalid-json']) {
    test(`retired validation never grants eligibility: ${role}, ${failure}`, async () => {
      let validation: any = null, eligible = false, permission: unknown = null, message = '';
      let calls = 0;
      const setValidation = (value: any) => { validation = typeof value === 'function' ? value(validation) : value; };
      const handler = evaluate(initializer('validatePrescriptionOnTestnet'), {
        dispensePrescriptionId: '710001', isDispensaryPortal: role === 'dispensary', DEMO_PRESCRIPTION_ID: '710001',
        setPrescriptionValidation: setValidation, setHasPrescription: (value: boolean) => { eligible = value; },
        setPrescriptionValidationError: (value: string) => { message = value; },
        setPrescriptionValidationBusy: () => {}, setPrescriptionAllowance: () => {}, setDoctorPatientAddress: () => {},
        setDispensaryValidation: (value: unknown) => { permission = value; }, latestDispensaryPermission: null,
        buildDemoPrescriptionValidation: () => ({ prescription: { patient: 'SYNTHETIC_FOREIGN', totalQuantity: 30, dispensedQuantity: 0 }, validation: { canDispense: true } }),
        createPrivacyPermission: async () => ({ synthetic: true }),
        fetch: async () => {
          calls++;
          if (failure === 'network') throw new Error('SYNTHETIC_NETWORK_ERROR');
          return { ok: false, json: async () => {
            if (failure === 'invalid-json') throw new SyntaxError('SYNTHETIC_PRIVATE_BODY');
            return { message: 'SYNTHETIC_PRIVATE_SERVICE_MESSAGE', code: 'LEGACY_PRIVATE_ROUTE_DISABLED' };
          } };
        },
        LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible. Usa el piloto conectado.',
      });
      await handler();
      assert.equal(validation, null, 'failed/retired read must not synthesize a valid prescription');
      assert.equal(eligible, false);
      assert.equal(permission, null);
      assert.match(message, /no disponible/i);
      assert.equal(message.includes('SYNTHETIC_PRIVATE'), false);
      assert.equal(calls, 0, 'UI must not invoke a permanently retired private read');
    });
  }
}

test('legacy dashboard does not hydrate an unsegmented cache, even malformed', () => {
  for (const saved of ['{malformed', JSON.stringify({ patientAddress: 'SYNTHETIC_FOREIGN', prescriptions: [{ id: 710001 }] })]) {
    const state = evaluate(initializer('[patientDashboard, setPatientDashboard]'), {
      useState: (value: any) => [typeof value === 'function' ? value() : value, () => {}],
      localStorage: { getItem: () => saved },
    });
    assert.equal(state[0], null);
  }
});

test('no private dashboard request or cache write remains in the component', () => {
  assert.equal(source.includes('fetch(`/api/stellar/patient/'), false);
  assert.equal(/localStorage\.setItem\('trust_patient_dashboard'/.test(source), false);
  assert.ok(source.includes("['trust_patient_dashboard', 'trust_has_rx'"));
  for (const key of ['trust_has_rx', 'trust_prescription_allowance', 'trust_pickups', 'trust_privacy_permissions'])
    assert.equal(source.includes("localStorage.setItem('" + key + "'"), false, key);
});

test('changing the private context clears projections before paint', () => {
  let effect: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useLayoutEffect'
      && node.getText(ast).includes("['trust_patient_dashboard', 'trust_has_rx'")) effect = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(effect);
  const dependencies = effect.arguments[1].getText(ast);
  for (const dependency of ['session?.email', 'session?.role', 'session?.createdAt', 'patientIdentityAddress',
    'privyIdentity.subject', 'privyIdentity.authenticated', 'privyIdentity.ready']) assert.ok(dependencies.includes(dependency));
  const removed: string[] = [];
  const values: Record<string, any> = {};
  const setters = Object.fromEntries(['PatientDashboard', 'PatientDashboardLoading', 'PatientDashboardError',
    'PrescriptionValidation', 'PrescriptionValidationError', 'HasPrescription', 'PrescriptionAllowance',
    'DispensaryValidation', 'SelectedQrPermission', 'PrivacyPermissions', 'ActivePickups',
    'SelectedPrescription', 'SelectedTraceRecord', 'ProcessingPickup', 'DispenseSuccess', 'Cart'].map(name => [
      'set' + name, (value: any) => { values[name] = value; },
    ]));
  const generation = { current: 0 };
  const cleanup = evaluate(effect.arguments[0].getText(ast), { ...setters, localStorage: { removeItem: (key: string) => removed.push(key) },
    privateContextGeneration: generation,
    LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible.' })();
  assert.equal(generation.current, 1);
  cleanup();
  assert.equal(generation.current, 2, 'unmount or context cleanup invalidates pending responses');
  assert.deepEqual(removed.sort(), ['trust_has_rx', 'trust_patient_dashboard', 'trust_prescription_allowance', 'trust_privacy_permissions', 'trust_pickups'].sort());
  for (const name of ['PatientDashboard', 'PrescriptionValidation', 'DispensaryValidation', 'SelectedQrPermission',
    'SelectedPrescription', 'SelectedTraceRecord', 'ProcessingPickup', 'DispenseSuccess'])
    assert.equal(values[name], null);
  assert.equal(values.HasPrescription, false);
  assert.equal(values.Cart.length, 0);
  assert.equal(values.PrivacyPermissions.length, 0);
  assert.equal(values.ActivePickups.length, 0);
  assert.equal(values.PrescriptionAllowance.monthlyLimitGrams, 0);
  const blockedValues: Record<string, any> = {};
  const blockedSetters = Object.fromEntries(Object.keys(setters).map(name => [
    name, (value: any) => { blockedValues[name] = value; },
  ]));
  evaluate(effect.arguments[0].getText(ast), { ...blockedSetters,
    privateContextGeneration: { current: 0 },
    localStorage: { removeItem: () => { throw new Error('SYNTHETIC_STORAGE_UNAVAILABLE'); } },
    LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible.' })();
  assert.equal(blockedValues.setPatientDashboard, null);
  assert.equal(blockedValues.setPrescriptionValidation, null);
  assert.equal(blockedValues.setActivePickups.length, 0);
});

test('missing validation blocks dispense before any mutation or synthetic success', async () => {
  let error = '', mutations = 0;
  const handler = evaluate(initializer('handleCompleteOnchainDispense'), {
    resolvedPrescriptionId: 710001, cart: [{ quantity: 1 }], prescriptionValidation: null,
    setDispenseError: (value: string) => { error = value; },
    LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible.',
    setDispenseBusy: () => { mutations++; }, registerLocalDispense: () => { mutations++; },
    fetch: async () => { mutations++; throw new Error('NETWORK_BLOCKED'); },
  });
  await handler();
  assert.equal(mutations, 0);
  assert.match(error, /no disponible/);
});

test('no synthetic positive validation can repopulate the retired projection', () => {
  assert.equal(/setPrescriptionValidation\((?!null)/.test(source), false);
});

test('showing a legacy pickup token must not simulate a successful withdrawal', () => {
  let writes = 0, timers = 0;
  const handler = evaluate(initializer('handleStartPickup'), {
    setProcessingPickup: () => {}, setPickupStep: () => { writes++; },
    setActivePickups: () => { writes++; }, setRecentActivity: () => { writes++; },
    setTimeout: () => { timers++; }, setDispenseError: () => {}, showToast: () => {},
    LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible.',
  });
  handler({ id: 'SYNTHETIC_PENDING_PICKUP', strain: { name: 'Synthetic' } });
  assert.equal(timers, 0);
  assert.equal(writes, 0);
});

test('legacy preview preparation cannot populate a private dashboard or eligibility', () => {
  for (const name of ['issueDemoPrescription', 'prepareRecordingDemo']) {
    const text = initializer(name);
    assert.equal(/setPatientDashboard\((?!null)/.test(text), false, name);
    assert.equal(text.includes('setHasPrescription(true)'), false, name);
    const node = ts.createSourceFile('callback.ts', text, ts.ScriptTarget.Latest, true);
    let dispensaryCalls = 0;
    function visit(n: ts.Node) {
      if (ts.isCallExpression(n) && n.expression.getText(node) === 'createPrivacyPermission'
        && n.arguments[0]?.getText(node) === "'dispensary-prescription'") dispensaryCalls++;
      ts.forEachChild(n, visit);
    }
    visit(node);
    assert.equal(dispensaryCalls, 0, name);
  }
});

test('unavailable allowance has a finite neutral progress value', () => {
  assert.equal(evaluate(initializer('prescriptionUsagePercent'), {
    prescriptionProjectedGrams: 0, prescriptionMonthlyLimitGrams: 0,
  }), 0);
});

test('no late legacy mutation response can restore the retired dashboard', () => {
  let positiveWriters = 0;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'setPatientDashboard'
      && node.arguments[0]?.kind !== ts.SyntaxKind.NullKeyword) positiveWriters++;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(positiveWriters, 0);
});

test('a pending permission cannot restore the previous context QR', async () => {
  const generation = { current: 1 };
  let release = () => {}, selected: unknown = null, writes = 0, activity = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const handler = evaluate(initializer('createPrivacyPermission'), {
    privateContextGeneration: generation, session: { name: 'Synthetic patient A' },
    clinicalAccessDoctor: 'Synthetic doctor', selectedDispensary: null,
    patientTrustAccountAddress: 'SYNTHETIC_A', makeDemoHash: () => 'synthetic',
    auth: { currentUser: { uid: 'synthetic-a' } }, db: {}, doc: () => ({}),
    setDoc: async () => { writes++; await pending; },
    setPrivacyPermissions: () => {}, setRecentActivity: () => { activity++; },
    setSelectedQrPermission: (value: unknown) => { selected = value; },
    setPrescriptionValidationError: () => {}, showToast: () => {},
    LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible.',
  });
  const result = handler('medical-consultation');
  assert.equal(writes, 1);
  generation.current++;
  selected = null;
  release();
  assert.equal(await result, null);
  assert.equal(selected, null);
  assert.equal(activity, 0);
  for (const name of ['prepareRecordingDemo', 'validatePatientQrForDoctor']) {
    const text = initializer(name);
    assert.match(text, /if \(!(?:medicalPermission|permission)\) return;/, 'callers stop after an obsolete response');
  }
});

test('retired dispensary permission cannot be synthesized by manual actions', async () => {
  let writes = 0;
  const handler = evaluate(initializer('createPrivacyPermission'), {
    privateContextGeneration: { current: 1 }, clinicalAccessDoctor: 'Synthetic doctor',
    selectedDispensary: null, session: {}, patientTrustAccountAddress: 'SYNTHETIC',
    makeDemoHash: () => 'synthetic', auth: { currentUser: null },
    setPrivacyPermissions: () => { writes++; }, setRecentActivity: () => { writes++; },
    setSelectedQrPermission: () => { writes++; }, setPrescriptionValidationError: () => {},
    showToast: () => {}, LEGACY_PRIVATE_READ_UNAVAILABLE: 'Lectura heredada no disponible.',
  });
  await handler('dispensary-prescription');
  assert.equal(writes, 0);
});

test('retired confirmation does not present a manual identifier as validated', () => {
  const text = source.slice(source.indexOf('Agente 402: confirma'), source.indexOf('Agente 402: confirma') + 4000);
  assert.ok(text.includes('Identificador no validado'));
  assert.equal(text.includes('Receta validada'), false);
  assert.equal(text.includes('Vigente'), false);
});
