import { useEffect, useRef, useState } from 'react';
import { Check, LogIn, LogOut, RefreshCw, Save, Send } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import OperationsWorkspace from '../operations/OperationsWorkspace';
import { applicationLabels, profileLabels } from './AdminOnboarding';
import { onboardingRequest, clearOnboardingInvitation } from './api';
import { useOnboarding } from './useOnboarding';
import { emptyApplicationProfile, type DispensaryApplication, type OnboardingCommand } from './contracts';
import './onboarding.css';

type Result = { accepted?: boolean; application?: DispensaryApplication | null; accessEmail?: string | null; expiresAt?: string };
export default function DispensaryOnboarding({ token }: { token: string | null }) {
  const identity = useTrustLeafPrivyIdentity();
  return <Applicant key={`${identity.subject}:${identity.authenticated}:${identity.ready}`} token={token}/>;
}
function Applicant({ token }: { token: string | null }) {
  const { identity, execute, busy, error, pending } = useOnboarding();
  const [invitation, setInvitation] = useState(token);
  const [data, setData] = useState<Result | null>(null);
  const [readError, setReadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [profile, setProfile] = useState(emptyApplicationProfile);
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const app = data?.application;
  const editable = app?.state === 'draft' || app?.state === 'changes_requested';
  useEffect(() => {
    if (!identity.ready || !identity.authenticated) return;
    const abort = new AbortController(); let sequence = 0;
    async function refresh() {
      if (dirtyRef.current) return;
      const current = ++sequence;
      try {
        const result = await onboardingRequest<Result>(identity, invitation ? { action: 'inspect', token: invitation } : { action: 'read-draft' }, abort.signal);
        if (abort.signal.aborted || current !== sequence || dirtyRef.current) return;
        setData(result); setReadError('');
        if (result.application) setProfile({ ...result.application.profile, contactEmail: result.application.profile.contactEmail || result.accessEmail || '' });
        if (result.accepted) { clearOnboardingInvitation(); setInvitation(null); }
      } catch (e) { if (!abort.signal.aborted && current === sequence) { setReadError((e as Error).message); if ([401,403].includes((e as { status?: number }).status ?? 0)) setData(null); } }
    }
    void refresh(); const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus); window.addEventListener('online', onFocus);
    return () => { abort.abort(); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus); };
  }, [identity.ready, identity.authenticated, identity.tokenReady, invitation, revision]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (dirty || pending) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before);
  }, [dirty, pending]);
  async function run(command: OnboardingCommand) {
    const result = await execute<Result>(command);
    if (result) {
      setData(result); setReadError(''); dirtyRef.current = false; setDirty(false); setReview(false);
      if (result.application) setProfile(result.application.profile);
      if (result.accepted) { clearOnboardingInvitation(); setInvitation(null); setConsent(false); }
      setRevision(n => n + 1);
    }
  }
  async function logout() {
    if (busy || pending || (dirty && !window.confirm('Descartar cambios sin guardar?'))) return;
    await identity.logout();
  }
  if (!invitation && data && !readError && (!data.application || data.application.state === 'approved')) {
    return <OperationsWorkspace email={identity.email} onSignOut={() => void logout()}/>;
  }
  const disabled = busy || !!pending || !!readError;
  return <section className="tl-operations tl-operations-page onboarding"><header className="op-header"><div><p className="op-brand">Trust Leaf</p><h1>Incorporar dispensario</h1><p className="op-email">{identity.email || 'Sin sesion'}</p></div><span className="op-simulation">Piloto de pruebas</span></header><div className="op-content">
    {(readError || error) && <p className="op-error" role="alert">{readError || error}</p>}
    {!identity.ready && <p role="status">Verificando identidad...</p>}
    {identity.ready && !identity.authenticated && <button className="op-command" onClick={() => void identity.beginLogin()}><LogIn size={16}/>Ingresar con Privy</button>}
    {identity.authenticated && <div className="op-toolbar"><button className="op-command" disabled={busy || !!pending} onClick={() => void logout()}><LogOut size={16}/>Usar otra cuenta</button><button className="op-command" disabled={busy || !!pending || dirty} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16}/>Actualizar solicitud</button></div>}
    {pending && !busy && <button className="op-command" onClick={() => void run(pending)}><RefreshCw size={16}/>Reintentar operacion pendiente</button>}
    {identity.authenticated && !data && !readError && <p role="status">Cargando incorporacion...</p>}
    {invitation && data && !data.accepted && <section className="onboarding-review"><h2>Invitacion para encargado</h2><p>La aceptacion abre una solicitud privada. No habilita acceso operativo.</p>
      <label className="op-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>Acepto participar en pruebas, sin atencion ni dispensacion reales.</label>
      <button className="op-command" disabled={disabled || !consent} onClick={() => void run({ action: 'accept', token: invitation, consent })}><Check size={16}/>Aceptar invitacion</button></section>}
    {app && <><h2>{applicationLabels[app.state]}</h2>{app.reason && <p className="onboarding-review">Motivo: {app.reason}</p>}
      <p>Usamos tus datos de identificacion y contacto para revisar esta incorporacion. Solo tu y los administradores autorizados pueden consultarlos. No incluyas datos de pacientes ni documentos sanitarios.</p>
      {editable && !review ? <form className="onboarding-form" onSubmit={e => { e.preventDefault(); void run({ action: 'save-draft', applicationRef: app.applicationRef, version: app.version, profile, operationId: crypto.randomUUID() }); }}>
        {(Object.keys(emptyApplicationProfile) as (keyof typeof profile)[]).map(key => <label key={key}>{profileLabels[key]}{key === 'contactEmail' ? ' (opcional)' : ''}
          {key === 'activity' ? <textarea disabled={disabled} maxLength={2000} value={profile[key]} onChange={e => { setProfile({ ...profile, [key]: e.target.value }); dirtyRef.current = true; setDirty(true); }}/>
            : <input disabled={disabled} type={key === 'contactEmail' ? 'email' : key === 'phone' ? 'tel' : 'text'} maxLength={key === 'address' ? 300 : key === 'contactEmail' ? 254 : 100} value={profile[key]} onChange={e => { setProfile({ ...profile, [key]: e.target.value }); dirtyRef.current = true; setDirty(true); }}/>}</label>)}
        <div className="op-toolbar"><button className="op-command" disabled={disabled}><Save size={16}/>Guardar borrador</button><button type="button" className="op-command" disabled={disabled || dirty} onClick={() => setReview(true)}>Revisar datos guardados</button></div>
      </form> : <dl className="onboarding-details">{Object.entries(app.profile).map(([key,value]) => <div key={key}><dt>{profileLabels[key]}</dt><dd>{value || 'No indicado'}</dd></div>)}</dl>}
      {editable && review && <><label className="op-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>Acepto la finalidad de estos datos y participar solo en pruebas. La aprobacion no es una acreditacion sanitaria.</label><div className="op-toolbar"><button className="op-command" disabled={disabled || !consent} onClick={() => void run({ action: 'submit', applicationRef: app.applicationRef, version: app.version, consent, operationId: crypto.randomUUID() })}><Send size={16}/>Enviar solicitud a revision</button><button className="op-command" disabled={disabled} onClick={() => setReview(false)}>Volver a editar</button></div></>}
      {app.state === 'submitted' && <p>Tu solicitud espera revision administrativa. Aun no tienes acceso operativo.</p>}
      {app.state === 'rejected' && <p>Esta solicitud es de solo lectura. Para iniciar otra incorporacion necesitas una nueva invitacion.</p>}
    </>}
  </div></section>;
}
