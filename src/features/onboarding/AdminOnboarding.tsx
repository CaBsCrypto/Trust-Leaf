import { useEffect, useState } from 'react';
import { Mail, RefreshCw, Send, X } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { onboardingRequest } from './api';
import { useOnboarding } from './useOnboarding';
import type { DispensaryApplication, OnboardingCommand } from './contracts';
import './onboarding.css';

type Invitation = { invitationRef: string; email: string; state: string; deliveryState: string; expiresAt: string };
type Snapshot = { invitations: Invitation[]; applications: DispensaryApplication[] };
export const applicationLabels = { draft: 'Borrador', submitted: 'En revision', changes_requested: 'Correcciones solicitadas', approved: 'Aprobada', rejected: 'Rechazada' };
const invitationLabels: Record<string,string> = { pending: 'Pendiente', accepted: 'Aceptada', expired: 'Vencida', cancelled: 'Cancelada' };
const deliveryLabels: Record<string,string> = { queued: 'En cola', sending: 'Enviando', sent: 'Enviado', delivered: 'Entregado al servidor receptor', delayed: 'Demorado', failed: 'Fallo de envio', uncertain: 'Resultado incierto', bounced: 'Rechazado por receptor', cancelled: 'Envio cancelado' };

export default function AdminOnboarding() {
  const identity = useTrustLeafPrivyIdentity();
  return <AdminSession key={`${identity.subject}:${identity.authenticated}`}/>;
}
function AdminSession() {
  const { identity, execute, busy, error, pending } = useOnboarding();
  const [view, setView] = useState<'invitations' | 'applications'>('invitations');
  const [data, setData] = useState<Snapshot | null>(null);
  const [readError, setReadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState('');
  const [reviewEmail, setReviewEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void onboardingRequest<Snapshot>(identity, { action: 'list' }, abort.signal)
      .then(value => { if (!abort.signal.aborted) { setData(value); setReadError(''); } })
      .catch(e => { if (!abort.signal.aborted) { setReadError((e as Error).message); setData(null); } });
    return () => abort.abort();
  }, [revision, identity.tokenReady]);
  async function run(command: OnboardingCommand) {
    const result = await execute(command);
    if (result) { setReviewEmail(null); setReason(''); setRevision(n => n + 1); }
  }
  const app = data?.applications.find(a => a.applicationRef === selected);
  const disabled = busy || !!pending || !!readError;
  return <section className="onboarding"><header className="onboarding-heading"><h2>Incorporaciones</h2>
    <button className="op-command" title="Actualizar incorporaciones" aria-label="Actualizar incorporaciones" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={18}/></button></header>
    <div className="op-tabs" role="tablist" aria-label="Incorporaciones"><button role="tab" aria-selected={view === 'invitations'} onClick={() => setView('invitations')}>Invitaciones</button><button role="tab" aria-selected={view === 'applications'} onClick={() => setView('applications')}>Solicitudes</button></div>
    {(error || readError) && <p role="alert" className="op-error">{error || readError}</p>}
    {pending && !busy && <button className="op-command" onClick={() => void run(pending)}><RefreshCw size={16}/>Reintentar operacion pendiente</button>}
    {!data && !readError && <p role="status">Cargando incorporaciones...</p>}
    {view === 'invitations' && <>
      <form className="onboarding-invite" onSubmit={e => { e.preventDefault(); setReviewEmail(email.trim().toLowerCase()); }}>
        <label>Correo del encargado<input type="email" required maxLength={254} value={email} disabled={disabled} onChange={e => setEmail(e.target.value)}/></label>
        <button className="op-command" disabled={disabled || !email}><Mail size={16}/>Revisar invitacion</button>
      </form>
      {reviewEmail && <div className="onboarding-review" role="region" aria-label="Confirmar destinatario"><h3>Invitar encargado</h3><p>{reviewEmail}</p><p>Dispensario de pruebas. El acceso requiere completar la solicitud y recibir aprobacion administrativa.</p>
        <button className="op-command" disabled={disabled} onClick={() => void run({ action: 'invite', email: reviewEmail, operationId: crypto.randomUUID() })}><Send size={16}/>Confirmar envio</button>
        <button className="op-command" disabled={busy || !!pending} onClick={() => setReviewEmail(null)}><X size={16}/>Volver</button></div>}
      {data?.invitations.length === 0 && <p>No hay invitaciones.</p>}
      {data?.invitations.map(inv => <article className="onboarding-row" key={inv.invitationRef}><h3>{inv.email}</h3><p>{invitationLabels[inv.state]} · {deliveryLabels[inv.deliveryState] ?? 'Estado de envio no disponible'}</p><p>Vence: {new Date(inv.expiresAt).toLocaleString('es-CL')}</p>
        {['pending','expired'].includes(inv.state) && <div className="op-toolbar"><button className="op-command" disabled={disabled} onClick={() => { if (window.confirm(`Reenviar a ${inv.email}? El enlace anterior dejara de servir.`)) void run({ action: 'resend', invitationRef: inv.invitationRef, operationId: crypto.randomUUID() }); }}>Reenviar</button>
          <button className="op-command" disabled={disabled} onClick={() => { if (window.confirm('Cancelar esta invitacion pendiente?')) void run({ action: 'cancel', invitationRef: inv.invitationRef, operationId: crypto.randomUUID() }); }}>Cancelar</button>
          {['failed','uncertain','queued'].includes(inv.deliveryState) && inv.state === 'pending' && <button className="op-command" disabled={disabled} onClick={() => void run({ action: 'retry-send', invitationRef: inv.invitationRef })}>Reintentar envio</button>}</div>}
      </article>)}
    </>}
    {view === 'applications' && <>
      {data?.applications.length === 0 && <p>No hay solicitudes.</p>}
      {data?.applications.map(item => <article className="onboarding-row" key={item.applicationRef}><h3>{item.profile.businessName || 'Dispensario sin nombre'}</h3><p>{item.profile.managerName || 'Datos pendientes'} · {applicationLabels[item.state]}</p><button className="op-command" onClick={() => { setSelected(item.applicationRef); setReason(''); }}>Revisar solicitud</button></article>)}
      {app && <section className="onboarding-review"><h3>{app.profile.businessName || 'Solicitud'}</h3><dl className="onboarding-details">
        {Object.entries(app.profile).map(([key,value]) => <div key={key}><dt>{profileLabels[key] ?? key}</dt><dd>{value || 'No indicado'}</dd></div>)}
      </dl><p>{applicationLabels[app.state]}</p>{app.reason && <p>Motivo: {app.reason}</p>}
        {app.state === 'submitted' && <><label>Motivo de la decision<textarea maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={disabled}/></label><div className="op-toolbar">
          {(['approve','changes','reject'] as const).map(decision => <button className="op-command" key={decision} disabled={disabled || (decision !== 'approve' && reason.trim().length < 3)} onClick={() => {
            if (window.confirm(decision === 'approve' ? 'Habilitar este dispensario solamente para el piloto de pruebas?' : 'Confirmar esta decision y su motivo?')) void run({ action: 'review', applicationRef: app.applicationRef, version: app.version, decision, reason, operationId: crypto.randomUUID() });
          }}>{decision === 'approve' ? 'Aprobar piloto' : decision === 'changes' ? 'Solicitar correcciones' : 'Rechazar'}</button>)}
        </div></>}
      </section>}
    </>}
  </section>;
}
export const profileLabels: Record<string,string> = { managerName: 'Nombre del encargado', phone: 'Telefono', businessName: 'Nombre comercial', commune: 'Comuna', address: 'Direccion de la sede', activity: 'Descripcion de actividad', contactEmail: 'Correo de contacto' };
