import { useEffect, useId, useRef, useState } from 'react';
import { Mail, RefreshCw, Send, X } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { onboardingRequest } from './api';
import { useOnboarding } from './useOnboarding';
import type { DispensaryApplication, OnboardingCommand } from './contracts';
import './onboarding.css';
import '../../components/administration-review.css';

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
  const viewId = useId();
  const { identity, execute, busy, error, pending } = useOnboarding();
  const [view, setView] = useState<'invitations' | 'applications'>('invitations');
  const [data, setData] = useState<Snapshot | null>(null);
  const [readError, setReadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState('');
  const [reviewEmail, setReviewEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const detail = useRef<HTMLElement>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selected) detail.current?.focus();
  }, [selected]);
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
  const views = [{ id: 'invitations', label: 'Invitaciones' }, { id: 'applications', label: 'Solicitudes' }] as const;
  return <section className="onboarding tl-admin-review">
    <header className="onboarding-heading">
      <h2>Incorporaciones</h2>
      <button type="button" className="op-command" aria-label="Actualizar incorporaciones" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={18} aria-hidden="true"/>Actualizar</button>
    </header>
    <div className="op-tabs" role="tablist" aria-label="Incorporaciones">
      {views.map(({ id, label }) => <button
        type="button"
        role="tab"
        key={id}
        id={`${viewId}-tab-${id}`}
        aria-controls={`${viewId}-panel-${id}`}
        aria-selected={view === id}
        tabIndex={view === id ? 0 : -1}
        onClick={() => setView(id)}
        onKeyDown={event => {
          const next = event.key === 'Home' ? 'invitations'
            : event.key === 'End' ? 'applications'
            : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (id === 'invitations' ? 'applications' : 'invitations')
            : null;
          if (!next) return;
          event.preventDefault();
          setView(next);
          document.getElementById(`${viewId}-tab-${next}`)?.focus();
        }}
      >{label}</button>)}
    </div>
    {(error || readError) && <p role="alert" className="op-error">{error || readError}</p>}
    {pending && !busy && <button type="button" className="op-command" onClick={() => void run(pending)}><RefreshCw size={16} aria-hidden="true"/>Reintentar operacion pendiente</button>}
    {!data && !readError && <p role="status" className="tl-admin-review-empty">Cargando incorporaciones...</p>}
    {busy && <p role="status" className="tl-admin-review-empty">Procesando operación…</p>}
    <div role="tabpanel" id={`${viewId}-panel-invitations`} aria-labelledby={`${viewId}-tab-invitations`} hidden={view !== 'invitations'}>
    {view === 'invitations' && <>
      <form className="onboarding-invite" onSubmit={e => { e.preventDefault(); setReviewEmail(email.trim().toLowerCase()); }}>
        <label>Correo del encargado<input type="email" required maxLength={254} value={email} disabled={disabled} onChange={e => setEmail(e.target.value)}/></label>
        <button type="submit" className="op-command tl-admin-review-primary" disabled={disabled || !email}><Mail size={16} aria-hidden="true"/>Revisar invitacion</button>
      </form>
      {reviewEmail && <div className="onboarding-review" role="region" aria-label="Confirmar destinatario"><h3>Invitar encargado</h3><p>{reviewEmail}</p><p>Dispensario de pruebas. El acceso requiere completar la solicitud y recibir aprobacion administrativa.</p>
        <div className="op-toolbar">
          <button type="button" className="op-command tl-admin-review-primary" disabled={disabled} onClick={() => void run({ action: 'invite', email: reviewEmail, operationId: crypto.randomUUID() })}><Send size={16} aria-hidden="true"/>Confirmar envio</button>
          <button type="button" className="op-command" disabled={busy || !!pending} onClick={() => setReviewEmail(null)}><X size={16} aria-hidden="true"/>Volver</button>
        </div>
      </div>}
      {data?.invitations.length === 0 && <p className="tl-admin-review-empty">No hay invitaciones.</p>}
      {data?.invitations.map(inv => <article className="onboarding-row" key={inv.invitationRef}>
        <h3>{inv.email}</h3>
        <dl className="tl-admin-invite-summary">
          <div><dt>Invitación</dt><dd className="tl-admin-record-status">{invitationLabels[inv.state] ?? inv.state}</dd></div>
          <div><dt>Envío</dt><dd>{deliveryLabels[inv.deliveryState] ?? 'Estado de envio no disponible'}</dd></div>
          <div><dt>Vence</dt><dd>{new Date(inv.expiresAt).toLocaleString('es-CL')}</dd></div>
        </dl>
        {['pending','expired'].includes(inv.state) && <div className="op-toolbar"><button className="op-command" disabled={disabled} onClick={() => { if (window.confirm(`Reenviar a ${inv.email}? El enlace anterior dejara de servir.`)) void run({ action: 'resend', invitationRef: inv.invitationRef, operationId: crypto.randomUUID() }); }}>Reenviar</button>
          <button className="op-command" disabled={disabled} onClick={() => { if (window.confirm('Cancelar esta invitacion pendiente?')) void run({ action: 'cancel', invitationRef: inv.invitationRef, operationId: crypto.randomUUID() }); }}>Cancelar</button>
          {['failed','uncertain','queued'].includes(inv.deliveryState) && inv.state === 'pending' && <button className="op-command" disabled={disabled} onClick={() => void run({ action: 'retry-send', invitationRef: inv.invitationRef })}>Reintentar envio</button>}</div>}
      </article>)}
    </>}
    </div>
    <div role="tabpanel" id={`${viewId}-panel-applications`} aria-labelledby={`${viewId}-tab-applications`} hidden={view !== 'applications'}>
    {view === 'applications' && <>
      {data?.applications.length === 0 && <p className="tl-admin-review-empty">No hay solicitudes.</p>}
      {data?.applications.map(item => <article className="onboarding-row" key={item.applicationRef}>
        <h3>{item.profile.businessName || 'Dispensario sin nombre'}</h3>
        <p>{item.profile.managerName || 'Datos pendientes'} · {applicationLabels[item.state]}</p>
        <div className="op-toolbar">
          <button type="button" className="op-command" aria-expanded={selected === item.applicationRef} aria-controls={selected === item.applicationRef ? `${viewId}-detail` : undefined} onClick={event => {
            detailTrigger.current = event.currentTarget;
            setSelected(item.applicationRef);
            setReason('');
            if (selected === item.applicationRef) detail.current?.focus();
          }}>Revisar solicitud</button>
        </div>
      </article>)}
      {app && <section className="onboarding-review" id={`${viewId}-detail`} ref={detail} tabIndex={-1} aria-labelledby={`${viewId}-detail-title`}>
        <div className="onboarding-heading">
          <h3 id={`${viewId}-detail-title`}>{app.profile.businessName || 'Solicitud'}</h3>
          <button type="button" className="op-command" onClick={() => {
            setSelected(null);
            detailTrigger.current?.focus();
          }}><X size={16} aria-hidden="true"/>Cerrar detalle</button>
        </div>
        <p className="tl-admin-record-status">{applicationLabels[app.state]}</p>
        <dl className="onboarding-details">
        {Object.entries(app.profile).map(([key,value]) => <div key={key}><dt>{profileLabels[key] ?? key}</dt><dd>{value || 'No indicado'}</dd></div>)}
      </dl>{app.reason && <p>Motivo: {app.reason}</p>}
        {app.state === 'submitted' && <><label>Motivo de la decision<textarea maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={disabled}/></label><div className="op-toolbar">
          {(['approve','changes','reject'] as const).map(decision => <button type="button" className={`op-command ${decision === 'approve' ? 'tl-admin-review-primary' : ''}`} key={decision} disabled={disabled || (decision !== 'approve' && reason.trim().length < 3)} onClick={() => {
            if (window.confirm(decision === 'approve' ? 'Habilitar este dispensario solamente para el piloto de pruebas?' : 'Confirmar esta decision y su motivo?')) void run({ action: 'review', applicationRef: app.applicationRef, version: app.version, decision, reason, operationId: crypto.randomUUID() });
          }}>{decision === 'approve' ? 'Aprobar piloto' : decision === 'changes' ? 'Solicitar correcciones' : 'Rechazar'}</button>)}
        </div></>}
      </section>}
    </>}
    </div>
  </section>;
}
export const profileLabels: Record<string,string> = { managerName: 'Nombre del encargado', phone: 'Telefono', businessName: 'Nombre comercial', commune: 'Comuna', address: 'Direccion de la sede', activity: 'Descripcion de actividad', contactEmail: 'Correo de contacto' };
