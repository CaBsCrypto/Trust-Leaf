import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MailPlus, RefreshCw, Send, UserMinus, X } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { teamRequest } from './team-api';
import type { TeamCommand, TeamInvitation, TeamSnapshot } from './team-contracts';

const invitationLabels: Record<TeamInvitation['state'], string> = { pending: 'Pendiente', accepted: 'Aceptada', expired: 'Vencida', cancelled: 'Cancelada' };
const deliveryLabels: Record<TeamInvitation['deliveryState'], string> = { queued: 'En cola', sending: 'Enviando', sent: 'Enviado', delivered: 'Entregado al servidor receptor', delayed: 'Entrega demorada', failed: 'Envio rechazado', uncertain: 'Envio sin confirmar', bounced: 'Rechazado por destinatario', cancelled: 'Envio cancelado' };

export default function TeamPanel({ search, revision, disabled, remove }: { search: string; revision: number; disabled: boolean; remove: (actorRef: string) => void }) {
  const identity = useTrustLeafPrivyIdentity();
  const [data, setData] = useState<TeamSnapshot | null>(null);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [pending, setPending] = useState<TeamCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const lock = useRef(false);
  const generation = useRef(0);
  const controller = useRef(new AbortController());
  useEffect(() => { controller.current = new AbortController(); return () => { controller.current.abort(); generation.current++; }; }, []);
  useEffect(() => {
    const read = new AbortController();
    async function refresh() {
      if (lock.current) return;
      const current = ++generation.current;
      try {
        const snapshot = await teamRequest<TeamSnapshot>(identity, { action: 'list' }, read.signal);
        if (!read.signal.aborted && current === generation.current) { setData(snapshot); setReadError(''); }
      } catch (e) {
        if (!read.signal.aborted && current === generation.current) { setData(null); setReadError((e as Error).message); }
      }
    }
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = setInterval(visible, 15000);
    window.addEventListener('focus', visible); window.addEventListener('online', visible);
    return () => { read.abort(); clearInterval(timer); window.removeEventListener('focus', visible); window.removeEventListener('online', visible); };
  }, [revision, version, identity.tokenReady]);
  async function execute(command: TeamCommand) {
    if (lock.current) return;
    lock.current = true; generation.current++; setBusy(true); setPending(command); setError(''); setNotice('');
    try {
      await teamRequest(identity, command, controller.current.signal);
      if (!controller.current.signal.aborted) { setPending(null); setConfirmation(null); setEmail(''); setNotice('Cambio guardado. Consulta el estado de envio.'); }
    } catch (e) {
      if (!controller.current.signal.aborted) {
        setError((e as Error).message);
        const status = (e as { status?: number }).status;
        if (status && status < 500) setPending(null);
        if (status === 401 || status === 403) setData(null);
      }
    } finally { if (!controller.current.signal.aborted) { lock.current = false; setBusy(false); setVersion(v => v + 1); } }
  }
  function review(event: FormEvent) { event.preventDefault(); setConfirmation(email.trim().toLowerCase()); setNotice(''); }
  const blocked = disabled || busy || pending !== null;
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  return <section>
    {(error || readError) && <p role="alert" className="op-error">{error || readError}</p>}{notice && <p role="status" className="op-success">{notice}</p>}
    {pending && !busy && <button className="op-command" onClick={() => void execute(pending)}><RefreshCw size={16}/>Reintentar operacion</button>}
    {!data && !error && !readError && <p role="status">Cargando equipo...</p>}
    {data && <><h3>{data.organization.name}</h3><p>{data.membership.role === 'manager' ? 'Encargado' : 'Operador'}</p>
      {!data.invitationsEnabled && <p role="status">Invitaciones deshabilitadas temporalmente.</p>}
      {data.membership.role === 'manager' && data.invitationsEnabled && <form className="op-form" onSubmit={review}><fieldset disabled={blocked}>
        <label>Correo del trabajador<input aria-label="Correo del trabajador" type="email" required maxLength={254} value={email} onChange={e => { setEmail(e.target.value); setConfirmation(null); }}/></label>
        <button className="op-command" type="submit"><MailPlus size={16}/>Preparar invitacion</button></fieldset></form>}
      {confirmation && data.membership.role === 'manager' && data.invitationsEnabled && <div className="op-invitation-review" role="group" aria-label="Confirmar invitacion">
        <p><strong>{confirmation}</strong></p><p>{data.organization.name} · Operador</p><p>Vigencia: 7 dias</p>
        <button className="op-command" disabled={blocked} onClick={() => void execute({ action: 'create', email: confirmation, operationId: crypto.randomUUID() })}><Send size={16}/>Enviar invitacion</button>
        <button className="op-command" disabled={blocked} onClick={() => setConfirmation(null)}><X size={16}/>Volver</button></div>}
      <h3>Miembros</h3>{data.members.filter(m => matches(`${m.email ?? ''} ${m.role === 'manager' ? 'Encargado' : 'Operador'}`)).map(m => <div className="op-line" key={m.actorRef}>
        <span>{m.email ?? 'Correo no disponible'}<small>{m.role === 'manager' ? 'Encargado' : 'Operador'}</small></span>
        {data.membership.role === 'manager' && m.role === 'operator' && <button aria-label={`Retirar ${m.email ?? 'operador'}`} title="Retirar trabajador" disabled={blocked} onClick={() => { if (confirm(`Retirar el acceso de ${m.email ?? 'este trabajador'}?`)) remove(m.actorRef); }}><UserMinus size={18}/></button>}
      </div>)}
      {data.membership.role === 'manager' && <><h3>Invitaciones</h3>{!data.invitations.length && <p className="op-empty">No hay invitaciones.</p>}
        {data.invitations.filter(i => matches(i.email)).map(i => <article className="op-row" key={i.invitationRef}><h4>{i.email}</h4>
          <p>{invitationLabels[i.state]} · {deliveryLabels[i.deliveryState]}</p><p>Vence: {new Date(i.expiresAt).toLocaleString('es-CL')}</p>
          {(i.state === 'pending' || i.state === 'expired') && <div className="op-toolbar">
            {i.state === 'pending' && ['queued', 'failed', 'uncertain', 'sending'].includes(i.deliveryState) && <button className="op-command" disabled={blocked || !data.invitationsEnabled} onClick={() => void execute({ action: 'retry-send', invitationRef: i.invitationRef })}><RefreshCw size={16}/>Reintentar envio</button>}
            <button className="op-command" disabled={blocked || !data.invitationsEnabled} onClick={() => { if (confirm(`Reenviar a ${i.email}? El enlace anterior dejara de funcionar.`)) void execute({ action: 'resend', invitationRef: i.invitationRef, operationId: crypto.randomUUID() }); }}><Send size={16}/>Reenviar</button>
            <button className="op-command" disabled={blocked} onClick={() => { if (confirm(`Cancelar la invitacion de ${i.email}?`)) void execute({ action: 'cancel', invitationRef: i.invitationRef, operationId: crypto.randomUUID() }); }}><X size={16}/>Cancelar</button>
          </div>}</article>)}</>}
    </>}
  </section>;
}
