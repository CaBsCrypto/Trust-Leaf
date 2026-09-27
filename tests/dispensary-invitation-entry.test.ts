import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureDispensaryInvitation, clearDispensaryInvitation } from '../src/lib/dispensaryInvitation.ts';

const token = 'A'.repeat(43), oldToken = 'B'.repeat(43);
const key = 'trustleaf-invitation-entry';
function setup(hash = '', fail = '') {
  const store = new Map<string, string>();
  const location = { pathname: '/dispensario', search: '', hash };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history: { replaceState() { location.hash = ''; } } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem(k: string) { if (fail === 'get') throw Error('unavailable'); return store.get(k) ?? null; },
    setItem(k: string, v: string) { if (fail === 'set') throw Error('unavailable'); store.set(k, v); },
    removeItem(k: string) { if (fail === 'remove') throw Error('unavailable'); store.delete(k); },
  } });
  return { store, location };
}
for (const [parameter, kind] of [['team-invite', 'worker'], ['dispensary-invite', 'manager']] as const) {
  test(`${kind}: explicit link wins over both saved invitations, survives repeated capture`, () => {
    const { store, location } = setup(`#${parameter}=${token}`);
    for (const legacy of ['trustleaf-team-invitation', 'trustleaf-dispensary-invitation']) store.set(legacy, JSON.stringify({ token: oldToken, until: Date.now() + 10000 }));
    store.set(key, JSON.stringify({ kind: 'worker', token: oldToken, until: Date.now() + 10000 }));
    assert.deepEqual(captureDispensaryInvitation(), { kind, token });
    assert.equal(location.hash, '');
    assert.deepEqual(captureDispensaryInvitation(), { kind, token });
    clearDispensaryInvitation();
    assert.equal(captureDispensaryInvitation(), null);
  });
  for (const fail of ['get', 'set', 'remove']) test(`${kind}: ${fail} failure preserves explicit link on reload`, () => {
    const { location } = setup(`#${parameter}=${token}`, fail);
    assert.deepEqual(captureDispensaryInvitation(), { kind, token });
    assert.notEqual(location.hash, '');
    assert.deepEqual(captureDispensaryInvitation(), { kind, token });
  });
}
for (const fragment of ['team-invite=', 'dispensary-invite=wrong', `team-invite=${token}&dispensary-invite=${token}`, `team-invite=${token}&team-invite=${token}`]) {
  test(`invalid explicit link cannot restore previous invitation: ${fragment.slice(0, 25)}`, () => {
    const { store } = setup(`#${fragment}`);
    store.set('trustleaf-team-invitation', JSON.stringify({ token, until: Date.now() + 10000 }));
    assert.deepEqual(captureDispensaryInvitation(), { kind: 'invalid' });
    assert.deepEqual(captureDispensaryInvitation(), { kind: 'invalid' });
  });
}
test('new fragment replaces previously captured role', () => {
  const { location } = setup(`#team-invite=${oldToken}`);
  captureDispensaryInvitation();
  location.hash = `#dispensary-invite=${token}`;
  assert.deepEqual(captureDispensaryInvitation(), { kind: 'manager', token });
});
test('expired or corrupt canonical entry never falls back to legacy storage', () => {
  const { store } = setup();
  store.set('trustleaf-team-invitation', JSON.stringify({ token, until: Date.now() + 10000 }));
  for (const value of ['null', '{}', 'bad JSON', JSON.stringify({ kind: 'worker', token, until: 1 })]) {
    store.set(key, value);
    assert.equal(captureDispensaryInvitation(), null);
  }
});
test('unambiguous legacy entry stays usable; ambiguous legacy pair requires reopening link', () => {
  const { store, location } = setup();
  store.set('trustleaf-team-invitation', JSON.stringify({ token, until: Date.now() + 10000 }));
  assert.deepEqual(captureDispensaryInvitation(), { kind: 'worker', token });
  store.set('trustleaf-dispensary-invitation', JSON.stringify({ token: oldToken, until: Date.now() + 10000 }));
  assert.deepEqual(captureDispensaryInvitation(), { kind: 'invalid' });
  location.pathname = '/paciente';
  assert.equal(captureDispensaryInvitation(), null);
});
