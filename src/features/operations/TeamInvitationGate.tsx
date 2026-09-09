import { useEffect, useRef, useState } from 'react';
import { Check, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { clearTeamInvitation, teamRequest } from './team-api';
import type { InvitationPreview } from './team-contracts';
import OperationsWorkspace from './OperationsWorkspace';
import './operations.css';

export default function TeamInvitationGate({ token }: { token: string }) {
  const identity = useTrustLeafPrivyIdentity();
  return <InvitationSession key={`${identity.subject}:${identity.authenticated}:${identity.ready}`} token={token}/>;
}
function InvitationSession({ token }: { token: string }) {
  const identity = useTrustLeafPrivyIdentity();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [revision, setRevision] = useState(0);
  const controller = useRef(new AbortController());
  const lock = useRef(false);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current.abort(); }, []);
  useEffect(() => {
    if (!identity.ready || !identity.authenticated) return;
    const read = new AbortController();
    setPreview(null); setError('');
    void teamRequest<InvitationPreview>(identity, { action: 'inspect', token }, read.signal)
      .then(result => { if (!read.signal.aborted) { if (result.accepted) clearTeamInvitation(); setPreview(result); } })
      .catch(e => { if (!read.signal.aborted) setError((e as Error).message); });
    return () => read.abort();
  }, [identity.ready, identity.authenticated, identity.tokenReady, revision, token]);
  async function accept() {
    if (lock.current || !consent) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await teamRequest<InvitationPreview>(identity, { action: 'accept', token, acceptSyntheticOnly: true }, controller.current.signal);
      if (!controller.current.signal.aborted) { clearTeamInvitation(); setPreview(result); }
    } catch (e) { if (!controller.current.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.current.signal.aborted) { lock.current = false; setBusy(false); } }
  }
  async function changeAccount() {
    setPreview(null); setError('');
    try { await identity.logout(); } catch { setError('No fue posible cerrar la sesion. Reintenta.'); }
  }
  if (preview?.accepted) return <OperationsWorkspace email={identity.email} onSignOut={() => void changeAccount()}/>;
  return <section className="tl-operations tl-operations-page"><header className="op-header"><div><p className="op-brand">Trust Leaf</p><h1>Invitacion al equipo</h1>
    <p className="op-email">{identity.email ?? (identity.authenticated ? 'Cuenta conectada' : 'Sin sesion')}</p></div><span className="op-simulation">Piloto simulado</span></header>
    <div className="op-content">
      {error && <p className="op-error" role="alert">{error}</p>}
      {!identity.ready && <p role="status">Verificando identidad...</p>}
      {identity.ready && !identity.authenticated && <button className="op-command" disabled={!identity.enabled} onClick={() => void identity.beginLogin().catch(() => setError('No fue posible abrir el ingreso.'))}><LogIn size={16}/>Continuar con Privy</button>}
      {identity.authenticated && <button className="op-command" disabled={busy} onClick={() => void changeAccount()}><LogOut size={16}/>Usar otra cuenta</button>}
      {identity.authenticated && !preview && !error && <p role="status">Verificando invitacion...</p>}
      {preview && <div className="op-invitation-review"><h2>{preview.organizationName}</h2><p>Funcion: Operador</p>
        {preview.expiresAt && <p>Vence: {new Date(preview.expiresAt).toLocaleString('es-CL')}</p>}
        <label className="op-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>Acepto participar solo con datos ficticios. Sin atencion ni entregas reales.</label>
        <button className="op-command" disabled={!consent || busy} onClick={() => void accept()}><Check size={16}/>{busy ? 'Aceptando...' : 'Aceptar invitacion como operador'}</button></div>}
      {error && identity.authenticated && <button className="op-command" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16}/>Reintentar verificacion</button>}
      <button className="op-command" disabled={busy} onClick={() => { clearTeamInvitation(); window.location.assign('/dispensario'); }}>Salir de la invitacion</button>
    </div></section>;
}
