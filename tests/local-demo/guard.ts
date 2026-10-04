export type DemoIdentity = { key: string; label: string; subject: string; email: string; token: string };
export type DemoMetadata = { generation: number; access: string; identities: DemoIdentity[] };
let current: DemoMetadata | null = null;
let bootstrap: string | null = null;
type Scope = { metadata: DemoMetadata; writes: number; uncertain: Set<string>; expired: boolean };
let scope: Scope | null = null;
const origin = location.origin;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('LOCAL_ORIGIN_REQUIRED');
export function configureDemo(metadata: DemoMetadata) {
  if (current?.generation !== metadata.generation || current?.access !== metadata.access) scope = { metadata, writes: 0, uncertain: new Set(), expired: false };
  current = metadata;
}
export function configureBootstrap(value: string) { bootstrap = value; }
export function invalidateDemoScope() { if (scope) scope.expired = true; }
export function hasPendingDemoWrite() { return !!scope && !scope.expired && (scope.writes > 0 || scope.uncertain.size > 0); }
function localURL(input: string | URL) {
  const url = new URL(String(input), origin);
  if (url.origin !== origin || !['http:'].includes(url.protocol) || url.username || url.password) throw new Error('LOCAL_EXTERNAL_REQUEST_BLOCKED');
  return url;
}
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = localURL(input instanceof Request ? input.url : input);
  const generation = current?.generation;
  const admitted = scope;
  if (admitted?.expired && url.pathname !== '/__local_demo/meta') throw new Error('LOCAL_CONTEXT_EXPIRED');
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (bootstrap && url.pathname === '/__local_demo/meta') headers.set('x-demo-bootstrap', bootstrap);
  if (current) { headers.set('x-demo-access', current.access); headers.set('x-demo-generation', String(current.generation)); }
  let action = '';
  try { action = JSON.parse(String(init?.body)).action; } catch { /* Reads have no command body. */ }
  const mutation = init?.method === 'POST' && url.pathname.startsWith('/api/') && action && !['list', 'inspect', 'read-draft'].includes(action);
  const operation = url.pathname + ':' + String(init?.body);
  if (mutation && admitted) admitted.writes++;
  let response: Response;
  try {
    response = await nativeFetch(input instanceof Request ? new Request(input, { ...init, headers }) : url, { ...init, headers });
    if (mutation && admitted) {
      const result = await response.clone().json();
      if (!result || typeof result !== 'object') throw new Error('LOCAL_RESPONSE_UNCERTAIN');
      // Consume and validate the body before releasing the command; the caller receives buffered JSON.
      response = new Response(JSON.stringify(result), { status: response.status, statusText: response.statusText, headers: response.headers });
      if (response.ok || [400,401,403,409,429].includes(response.status)) admitted.uncertain.delete(operation); else admitted.uncertain.add(operation);
    }
  } catch (error) { if (mutation && admitted) admitted.uncertain.add(operation); throw error; }
  finally { if (mutation && admitted) admitted.writes--; }
  if (response.status === 409) {
    const result = await response.clone().json().catch(() => null);
    if (result?.code === 'LOCAL_CONTEXT_EXPIRED' && admitted === scope) { invalidateDemoScope(); window.dispatchEvent(new Event('local-demo-expired')); }
  }
  if ((admitted !== scope || admitted?.expired || generation !== current?.generation) && url.pathname !== '/__local_demo/meta') throw new Error('LOCAL_STALE_RESPONSE');
  if (response.ok && init?.method === 'POST' && url.pathname.startsWith('/api/')) {
    if (['save-draft', 'save-profile', 'save-note', 'save-product', 'save-supplier', 'receive', 'receive-batch', 'adjust-stock', 'review', 'invite', 'create', 'submit', 'complete-encounter'].includes(action)) window.dispatchEvent(new CustomEvent('local-demo-saved', { detail: { action } }));
  }
  return response;
};
const nativeOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: [boolean?, string?, string?]) {
  return nativeOpen.call(this, method, localURL(url).href, ...args);
};
const nativeSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(body) {
  if (current) { this.setRequestHeader('x-demo-access', current.access); this.setRequestHeader('x-demo-generation', String(current.generation)); }
  return nativeSend.call(this, body);
};
const unavailable = () => { throw new Error('LOCAL_TRANSPORT_DISABLED'); };
window.WebSocket = window.EventSource = unavailable as never;
navigator.sendBeacon = unavailable;
if ('serviceWorker' in navigator) navigator.serviceWorker.register = unavailable;
const nativeWindowOpen = window.open.bind(window);
window.open = (url, ...args) => nativeWindowOpen(localURL(String(url)).href, ...args);
document.addEventListener('click', event => {
  const anchor = (event.target as Element)?.closest?.('a');
  if (anchor) { try { localURL(anchor.href); } catch { event.preventDefault(); event.stopImmediatePropagation(); } }
}, true);
document.addEventListener('submit', event => {
  try { localURL((event.target as HTMLFormElement).action); } catch { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
