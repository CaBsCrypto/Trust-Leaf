import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from './privyIdentityContext';

type Job = { booking_ref: string; state: string; attempts: number; starts_at: string; error_code: string | null };
const states: Record<string, string> = { pending: 'Pendiente', working: 'Sincronizando', ready: 'Lista', cancelled: 'Cancelada', error: 'Error de sincronizacion' };
const commandStyle = 'inline-flex items-center gap-2 rounded border px-3 py-2 text-sm disabled:opacity-40';
function isJob(value: unknown): value is Job {
  if (!value || typeof value !== 'object') return false;
  const job = value as Record<string, unknown>;
  return typeof job.booking_ref === 'string' && /^[0-9a-f-]{36}$/i.test(job.booking_ref)
    && typeof job.state === 'string' && Object.hasOwn(states, job.state)
    && typeof job.attempts === 'number' && Number.isInteger(job.attempts) && job.attempts >= 0
    && typeof job.starts_at === 'string' && Number.isFinite(Date.parse(job.starts_at))
    && (job.error_code === null || typeof job.error_code === 'string');
}

export default function CalendarOperations() {
  const identity = useTrustLeafPrivyIdentity();
  return <IdentityCalendarOperations key={`${identity.subject ?? 'signed-out'}:${identity.enabled}:${identity.authenticated}:${identity.ready}:${identity.tokenReady}`}/>;
}

function IdentityCalendarOperations() {
  const identity = useTrustLeafPrivyIdentity();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [readError, setReadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [revision, setRevision] = useState(0);
  const commandLock = useRef(false);
  const commandController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const sessionAvailable = identity.enabled && identity.ready && identity.authenticated && Boolean(identity.subject) && identity.tokenReady !== false;
  useEffect(() => () => commandController.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setAuthorized(false); setLoading(true);
    if (!sessionAvailable) {
      setJobs([]); setLoading(false); setReadError('Inicia sesion como administrador para consultar las videollamadas.');
      return () => controller.abort();
    }
    let reading = false;
    async function refresh() {
      if (reading || controller.signal.aborted || commandLock.current) return;
      reading = true;
      try {
        const token = await identity.getIdentityToken();
        controller.signal.throwIfAborted();
        if (!token) throw Object.assign(new Error(), { status: 401 });
        const response = await fetch('/api/google-calendar/jobs', { headers: { 'privy-id-token': token }, cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Object.assign(new Error(), { status: response.status });
        const data: { jobs?: unknown } = await response.json();
        if (!Array.isArray(data.jobs) || !data.jobs.every(isJob)) throw new Error();
        if (controller.signal.aborted || current !== generation.current) return;
        setJobs(data.jobs); setAuthorized(true); setReadError('');
      } catch (failure) {
        if (controller.signal.aborted || current !== generation.current) return;
        if ([401, 403].includes((failure as { status?: number }).status ?? 0)) { setJobs([]); setNotice(''); }
        setAuthorized(false); setReadError('No se pudieron cargar las videollamadas.');
      } finally {
        reading = false;
        if (!controller.signal.aborted && current === generation.current) setLoading(false);
      }
    }
    void refresh();
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = setInterval(resume, 15000);
    window.addEventListener('focus', resume); window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener('focus', resume); window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [revision, sessionAvailable]);

  async function command(action: 'setup' | 'process') {
    if (commandLock.current || !sessionAvailable || !authorized || loading) return;
    commandLock.current = true; setBusy(true); setError(''); setNotice('');
    // An older job snapshot must not overwrite the result of this command.
    generation.current++;
    const controller = new AbortController(); commandController.current = controller;
    try {
      const token = await identity.getIdentityToken();
      controller.signal.throwIfAborted();
      if (!token) { setJobs([]); setAuthorized(false); throw new Error(); }
      const response = await fetch(`/api/google-calendar/${action}`, { method: 'POST', headers: { 'privy-id-token': token }, signal: controller.signal });
      controller.signal.throwIfAborted();
      if ([401, 403].includes(response.status)) { setJobs([]); setAuthorized(false); }
      const data: { code?: unknown; processed?: boolean } = await response.json();
      controller.signal.throwIfAborted();
      if (!response.ok) {
        const code = typeof data.code === 'string' && /^CALENDAR_[A-Z_]{1,60}$/.test(data.code) ? data.code : 'CALENDAR_OPERATION_FAILED';
        setError(`No fue posible completar la operacion (${code}).`);
        return;
      }
      setNotice(action === 'setup' ? 'Calendario preparado.' : data.processed ? 'Intento procesado.' : 'No hay tareas listas para procesar.');
    } catch {
      if (!controller.signal.aborted) setError('No fue posible completar la operacion. Actualiza las videollamadas antes de reintentar.');
    } finally {
      if (!controller.signal.aborted) {
        commandLock.current = false; setBusy(false); setRevision(value => value + 1);
      }
      if (commandController.current === controller) commandController.current = null;
    }
  }
  const disabled = busy || loading || !authorized || !sessionAvailable;
  return <section className="w-full min-w-0 space-y-3 border-b border-gray-200 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Videollamadas</h2>
      <div className="flex flex-wrap gap-2">
        <button disabled={disabled} onClick={() => void command('setup')} className={commandStyle}><Settings size={16}/>Preparar calendario</button>
        <button disabled={disabled} onClick={() => void command('process')} className={commandStyle}><RefreshCw size={16}/>Procesar siguiente</button>
        <button disabled={busy || loading || !sessionAvailable} title="Actualizar videollamadas" aria-label="Actualizar videollamadas" onClick={() => { setError(''); setRevision(value => value + 1); }} className="rounded border p-2 disabled:opacity-40"><RefreshCw size={18}/></button>
      </div></div>
    {(readError || error) && <p role="alert" className="text-sm text-red-700">{readError || error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    {loading && <p role="status" className="text-sm text-gray-600">Actualizando videollamadas...</p>}
    {!loading && !readError && jobs.length === 0 && <p className="text-sm text-gray-600">Sin videollamadas registradas.</p>}
    <ul className="divide-y">{jobs.map(job => <li key={job.booking_ref} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
      <div className="min-w-0"><p>{new Date(job.starts_at).toLocaleString('es-CL')}</p><p className="break-all text-xs text-gray-600">Reserva {job.booking_ref}</p></div>
      <span>{states[job.state]}</span><span>Intentos: {job.attempts}</span>
      {job.error_code && <p className="w-full text-xs text-red-700">{job.error_code === 'CALENDAR_SYNC_FAILED' ? job.error_code : 'CALENDAR_OPERATION_FAILED'}</p>}
    </li>)}</ul>
  </section>;
}
