import { useEffect, useState, type FormEvent } from 'react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { requestFichaPilot as request } from './client';
import FichaAccountEnrollment from './FichaAccountEnrollment';

type Identity = ReturnType<typeof useTrustLeafPrivyIdentity>;
type Receipt = { resourceRef: string; clinicalStatus: 'pending' | 'active' | 'revoked'; deliveryStatus: 'accepted' | 'pending' };
type Workspace = { role: 'patient' | 'doctor'; receipt?: Receipt | null; receipts?: Receipt[]; consultations?: string[]; signingUrl?: string };
const sharedEnrollment = import.meta.env.VITE_TRUSTLEAF_FICHA_LINK_SHARED_ENROLLMENT_ENABLED === 'true';

const button = 'rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const textLink = 'font-semibold text-emerald-800 underline underline-offset-2';

function message(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTH_REQUIRED') return 'Vuelve a iniciar sesión para continuar.';
  if (code === 'PILOT_BINDING_INACTIVE') return 'El paciente de prueba debe confirmar primero el vínculo en FichaOnChain.';
  if (code === 'PILOT_ISSUANCE_PENDING') return 'Aún faltan las confirmaciones de la emisión en TrustLeaf.';
  if (code === 'PDF_INTEGRITY_MISMATCH') return 'El PDF no coincide con la prueba de integridad.';
  if (code === 'PILOT_NOT_FOUND' || code === 'PILOT_FORBIDDEN' || code === 'PILOT_ACTOR_NOT_ALLOWED') return 'Este recurso no está disponible en tu sesión.';
  if (code === 'PILOT_DISABLED') return 'El piloto está deshabilitado en este entorno.';
  if (code === 'PILOT_INPUT_INVALID' || code === 'FICHA_REQUEST_FAILED') return 'La acción no se completó. Revisa el código o inténtalo nuevamente.';
  return 'El servicio no está disponible. Inténtalo nuevamente.';
}

export default function FichaPilot({ path }: { path: string }) {
  const identity = useTrustLeafPrivyIdentity();
  const resourceRef = /^\/pilot\/recetas\/([a-f0-9-]{36})\/?$/.exec(path)?.[1];
  const [error, setError] = useState('');
  const available = import.meta.env.VITE_TRUSTLEAF_FICHA_LINK_PILOT_ENABLED === 'true' && identity.enabled
    && (path === '/pilot/ficha' || path === '/pilot/ficha/' || Boolean(resourceRef));
  return <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900 sm:py-16">
    <section className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a className={textLink} href="/">TrustLeaf Cannabis</a>
        {available && identity.authenticated && <button className={textLink} onClick={() => { void identity.logout().catch(e => setError(message(e))); }}>Cerrar sesión</button>}
      </div>
      <h1 className="text-2xl font-semibold">{resourceRef ? 'Receta sintética' : 'Conexión con FichaOnChain'}</h1>
      {!available ? <p>Este piloto no está disponible.</p> : !identity.ready ? <p role="status">Comprobando sesión…</p>
        : !identity.authenticated ? <button className={button} onClick={() => { void identity.beginLogin().catch(e => setError(message(e))); }}>Iniciar sesión</button>
          : resourceRef ? <Viewer key={`${identity.subject}:${resourceRef}`} identity={identity} resourceRef={resourceRef} />
            : <PilotWorkspace key={identity.subject} identity={identity} />}
      {error && <p className="text-red-800" role="alert">{error}</p>}
    </section>
  </main>;
}

function PilotWorkspace({ identity }: { identity: Identity }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [bookingRef, setBookingRef] = useState('');
  const [code, setCode] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [binding, setBinding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (identity.tokenReady === false) return;
    const controller = new AbortController();
    void request(identity, 'snapshot', {}, { signal: controller.signal }).then(r => r.json() as Promise<Workspace>).then(snapshot => {
      if (controller.signal.aborted) return;
      setWorkspace(snapshot);
      setReceipt(snapshot.receipts?.[0] ?? snapshot.receipt ?? null);
      setBookingRef(snapshot.consultations?.[0] ?? '');
    }).catch(error => { if (!controller.signal.aborted) setError(message(error)); });
    return () => controller.abort();
  }, [identity, reload]);

  async function run(action: string, data: object = {}) {
    setBusy(true);
    setError('');
    try {
      const result = await request(identity, action, data).then(r => r.json());
      if (action === 'claim') { setConfirmationCode(result.confirmationCode); setCode(''); setBinding('claimed'); }
      else if (action === 'binding-status') {
        setBinding(result.status);
        if (result.status !== 'claimed') setConfirmationCode('');
      } else {
        setReceipt(result);
        if (sharedEnrollment) setWorkspace(current => current && ({ ...current,
          consultations: action === 'issue' ? current.consultations?.filter(ref => ref !== bookingRef) : current.consultations,
          receipts: [result, ...(current.receipts ?? []).filter(entry => entry.resourceRef !== result.resourceRef)],
        }));
        if (action === 'issue') setBookingRef('');
      }
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }

  function claim(event: FormEvent) {
    event.preventDefault();
    void run('claim', { code: code.trim() });
  }

  if (!workspace) return error ? <>
    <p className="text-red-800" role="alert">{error}</p>
    <button className={button} onClick={() => { setError(''); setReload(n => n + 1); }}>Reintentar</button>
  </> : <p role="status">Comprobando permisos…</p>;

  return <div className="space-y-4">
    {workspace.role === 'patient' ? sharedEnrollment ? <FichaAccountEnrollment identity={identity} /> : <>
      <p>Ingresa el código de vinculación que creaste al iniciar sesión en FichaOnChain.</p>
      <form onSubmit={claim} className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-1.5 font-medium">Código de vinculación
          <input className="w-full rounded-lg border border-stone-400 p-2 font-mono" value={code} onChange={e => setCode(e.target.value)}
            autoComplete="off" spellCheck={false} maxLength={64} required />
        </label>
        <button className={button} disabled={busy}>Canjear código</button>
      </form>
      {confirmationCode && <p role="status">Ingresa <strong className="font-mono tracking-widest">{confirmationCode}</strong> en FichaOnChain para confirmar.</p>}
      {binding && <p role="status">{({ unlinked: 'Sin vinculación', pending: 'Vínculo pendiente', claimed: 'Esperando tu confirmación en la ficha',
        active: 'Vinculación activa', revoked: 'Vinculación retirada', expired: 'Vinculación vencida' } as Record<string, string>)[binding]}</p>}
      <button className={button} onClick={() => void run('binding-status')} disabled={busy}>Consultar vinculación</button>
    </> : sharedEnrollment ? <>
      <p>Prepara la receta para una consulta activa. El paciente y el médico completan la autorización y la firma en TrustLeaf Testnet.</p>
      <label className="grid gap-1.5 font-medium">Consulta confirmada
        <select className="w-full rounded-lg border border-stone-400 p-2" value={bookingRef} onChange={event => setBookingRef(event.target.value)}>
          <option value="">Selecciona una consulta</option>
          {workspace.consultations?.map(ref => <option key={ref} value={ref}>{ref}</option>)}
        </select>
      </label>
      <button className={button} disabled={busy || !bookingRef} onClick={() => void run('issue', { bookingRef })}>Preparar receta para firma</button>
      {workspace.receipts && workspace.receipts.length > 1 && <label className="grid gap-1.5 font-medium">Receta preparada
        <select className="w-full rounded-lg border border-stone-400 p-2" value={receipt?.resourceRef ?? ''}
          onChange={event => setReceipt(workspace.receipts?.find(entry => entry.resourceRef === event.target.value) ?? null)}>
          {workspace.receipts.map(entry => <option key={entry.resourceRef} value={entry.resourceRef}>{entry.resourceRef}</option>)}
        </select>
      </label>}
      {receipt && <>
        <dl className="grid grid-cols-2 gap-2">
          <dt>Estado clínico</dt><dd>{receipt.clinicalStatus === 'pending' ? 'Pendiente de firma' : receipt.clinicalStatus === 'revoked' ? 'Revocada' : 'Emitida en Testnet'}</dd>
          <dt>Envío a FichaOnChain</dt><dd>{receipt.deliveryStatus === 'accepted' ? 'Recibido' : 'Pendiente'}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          {receipt.clinicalStatus === 'pending' && workspace.signingUrl && <a className={button} href={workspace.signingUrl} rel="noreferrer">Abrir confirmación en TrustLeaf</a>}
          <button className={button} disabled={busy} onClick={() => void run('resend', { resourceRef: receipt.resourceRef })}>
            {receipt.clinicalStatus === 'pending' ? 'Actualizar confirmación' : 'Reenviar eventos'}
          </button>
          {receipt.clinicalStatus === 'active' && <button className={button} disabled={busy}
            onClick={() => void run('revoke', { resourceRef: receipt.resourceRef })}>Revocar receta en Cannabis</button>}
        </div>
      </>}
    </> : <>
      <p>Emisión de prueba para el paciente sintético del piloto.</p>
      <button className={button} onClick={() => void run('issue')} disabled={busy}>{receipt ? 'Procesar emisión' : 'Emitir receta sintética'}</button>
      {receipt && <>
        <dl className="grid grid-cols-2 gap-2">
          <dt>Estado clínico</dt><dd>{receipt.clinicalStatus === 'revoked' ? 'Revocada' : 'Emitida'}</dd>
          <dt>Envío a FichaOnChain</dt><dd>{receipt.deliveryStatus === 'accepted' ? 'Recibido' : 'Pendiente'}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy} onClick={() => void run('resend', { resourceRef: receipt.resourceRef })}>Reenviar eventos</button>
          {receipt.clinicalStatus === 'active' && <button className={button} disabled={busy}
            onClick={() => void run('revoke', { resourceRef: receipt.resourceRef })}>Revocar receta sintética</button>}
        </div>
      </>}
    </>}
    {error && <p className="text-red-800" role="alert">{error}</p>}
  </div>;
}

function Viewer({ identity, resourceRef }: { identity: Identity; resourceRef: string }) {
  const [document, setDocument] = useState<{ url: string; integrity: string; state: string } | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (identity.tokenReady === false) return;
    const controller = new AbortController();
    let url: string | undefined;
    setDocument(null);
    void request(identity, 'document', { resourceRef }, { signal: controller.signal }).then(async response => {
      const bytes = await response.blob();
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(bytes);
      setDocument({ url, integrity: response.headers.get('X-TrustLeaf-Integrity') ?? 'unavailable',
        state: response.headers.get('X-TrustLeaf-Clinical-State') ?? 'unavailable' });
    }).catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [identity, resourceRef, reload]);
  return <div className="space-y-4">
    {error ? <p className="text-red-800" role="alert">{error}</p> : document ? <>
      <dl className="grid grid-cols-2 gap-2">
        <dt>Estado clínico</dt><dd>{document.state === 'revoked' ? 'Revocada' : document.state === 'active' ? 'Emitida' : 'No disponible'}</dd>
        <dt>Integridad del PDF</dt><dd>{document.integrity === 'verified' ? 'Verificada' : document.integrity === 'pending' ? 'Pendiente' : 'No disponible'}</dd>
      </dl>
      <p>Documento sintético de prueba, sin validez clínica.</p>
      <div className="flex flex-wrap gap-4">
        <a className={textLink} href={document.url} target="_blank" rel="noreferrer">Abrir PDF</a>
        <a className={textLink} href={document.url} download="receta-sintetica.pdf">Descargar PDF</a>
      </div>
    </> : <p role="status">Comprobando acceso e integridad…</p>}
    {(error || document) && <div><button className={button} onClick={() => { setError(''); setReload(n => n + 1); }}>Actualizar comprobación</button></div>}
  </div>;
}
