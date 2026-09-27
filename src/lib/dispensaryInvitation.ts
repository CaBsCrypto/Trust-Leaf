export type DispensaryInvitation = { kind: 'worker' | 'manager'; token: string } | { kind: 'invalid' } | null;
const key = 'trustleaf-invitation-entry';
const legacyKeys = ['trustleaf-team-invitation', 'trustleaf-dispensary-invitation'];
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function captureDispensaryInvitation(): DispensaryInvitation {
  if (window.location.pathname !== '/dispensario') return null;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const workers = fragment.getAll('team-invite');
  const managers = fragment.getAll('dispensary-invite');
  if (workers.length || managers.length) {
    const tokens = [...workers, ...managers];
    const entry: DispensaryInvitation = tokens.length === 1 && validToken(tokens[0])
      ? { kind: workers.length ? 'worker' : 'manager', token: tokens[0] } : { kind: 'invalid' };
    // Persist before removing the fragment, so reload also works if storage fails.
    try {
      const serialized = JSON.stringify({ ...entry, until: Date.now() + 7 * 86400000 });
      sessionStorage.setItem(key, serialized);
      for (const oldKey of legacyKeys) sessionStorage.removeItem(oldKey);
      if (sessionStorage.getItem(key) === serialized) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch { /* The explicit fragment remains the source of truth. */ }
    return entry;
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.until !== 'number' || saved.until <= Date.now()) return null;
      if (saved.kind === 'invalid') return { kind: 'invalid' };
      return (saved.kind === 'worker' || saved.kind === 'manager') && validToken(saved.token)
        ? { kind: saved.kind, token: saved.token } : null;
    }
    // Preserve one unambiguous invitation already in progress before this update.
    const saved = legacyKeys.map(oldKey => JSON.parse(sessionStorage.getItem(oldKey) ?? 'null'));
    const active = saved.map((value, index) => value && typeof value.until === 'number' && value.until > Date.now() && validToken(value.token)
      ? { kind: index === 0 ? 'worker' as const : 'manager' as const, token: value.token } : null).filter(value => value !== null);
    return active.length > 1 ? { kind: 'invalid' } : active[0] ?? null;
  } catch { return null; }
}

export function clearDispensaryInvitation() {
  try {
    // A tombstone prevents legacy invitations from resurfacing after acceptance.
    sessionStorage.setItem(key, 'null');
    for (const oldKey of legacyKeys) sessionStorage.removeItem(oldKey);
  } catch { /* Storage may be unavailable. */ }
  if (window.location.pathname === '/dispensario') window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
