export const SESSION_CHANGE_KEY = 'trustleaf.session-change.v1';
const validRevision = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

/** Same-origin invalidation only. Messages never contain identity or permissions. */
export function createSessionChangeBus(onChange: () => void) {
  const readRevision = () => {
    try { return localStorage.getItem(SESSION_CHANGE_KEY); } catch { return null; }
  };
  let last = readRevision();
  let invalidated = false;
  let channel: BroadcastChannel | null = null;
  const receive = (revision: unknown) => {
    if (!validRevision(revision) || revision === last || invalidated) return;
    last = revision;
    invalidated = true;
    onChange();
  };
  try {
    channel = new BroadcastChannel(SESSION_CHANGE_KEY);
    channel.onmessage = event => receive(event.data);
  } catch { /* Storage events remain available without BroadcastChannel. */ }
  const storage = (event: StorageEvent) => {
    if (event.key === SESSION_CHANGE_KEY) receive(event.newValue);
  };
  const focus = () => receive(readRevision());
  const visibility = () => { if (document.visibilityState === 'visible') focus(); };
  window.addEventListener('storage', storage);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', visibility);
  return {
    publish() {
      if (invalidated) return;
      last = crypto.randomUUID();
      try { localStorage.setItem(SESSION_CHANGE_KEY, last); } catch { /* Channel fallback. */ }
      channel?.postMessage(last);
    },
    close() {
      channel?.close();
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
