import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from './privyIdentityContext';
import CalendarOperations from './CalendarOperations';

export default function GoogleCalendarConnection() {
  const identity = useTrustLeafPrivyIdentity();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [revision, setRevision] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setConnected(false);
    setChecking(true);
    setError('');
    if (!identity.ready || !identity.authenticated || !identity.tokenReady) return;
    const check = new AbortController();
    void identity.getIdentityToken().then(async token => {
      if (check.signal.aborted) return;
      if (!token) throw new Error('session');
      const response = await fetch('/api/google-calendar/status', { headers: { 'privy-id-token': token }, cache: 'no-store', signal: check.signal });
      if (!response.ok) throw new Error('status');
      const data = await response.json();
      if (!check.signal.aborted) setConnected(data.connected === true);
    }).catch(() => {
      if (!check.signal.aborted) setError('No se pudo verificar el calendario central.');
    }).finally(() => { if (!check.signal.aborted) setChecking(false); });
    return () => { check.abort(); };
  }, [identity.subject, identity.ready, identity.authenticated, identity.tokenReady, revision]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  async function connect() {
    if (activeRequest.current && !activeRequest.current.signal.aborted) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true); setError('');
    try {
      const token = await identity.getIdentityToken();
      controller.signal.throwIfAborted();
      if (!token) throw new Error('session');
      const response = await fetch('/api/google-calendar/start', { method: 'POST', headers: { 'privy-id-token': token }, signal: controller.signal });
      if (!response.ok) throw new Error('connection');
      const data = await response.json();
      const url = new URL(data.url);
      if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') throw new Error('url');
      controller.signal.throwIfAborted();
      window.location.assign(url.toString());
    } catch { if (!controller.signal.aborted) setError('No se pudo conectar Google Calendar. Intenta nuevamente.'); }
    finally { if (!controller.signal.aborted) setBusy(false); if (activeRequest.current === controller) activeRequest.current = null; }
  }
  return <div className="flex flex-wrap items-center gap-3 border-y border-gray-200 py-3">
    <button type="button" disabled={busy || checking || Boolean(error)} onClick={() => void connect()} className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">
      <CalendarDays size={18}/>{checking ? 'Verificando calendario...' : busy ? 'Conectando...' : connected ? 'Reconectar calendario central' : 'Conectar calendario central'}
    </button>
    {connected && <span className="text-sm text-green-700">Organizador central conectado</span>}
    {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    {error && <button type="button" onClick={() => setRevision(v => v + 1)}>Reintentar verificacion</button>}
    {connected && <CalendarOperations key={identity.subject}/>}
  </div>;
}
