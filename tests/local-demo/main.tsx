import { configureBootstrap, configureDemo, hasPendingDemoWrite, invalidateDemoScope, type DemoMetadata } from './guard';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mail, RotateCcw, X } from 'lucide-react';
import { TrustLeafPrivyContext } from '../../src/components/privyIdentityContext';
import OperationsWorkspace from '../../src/features/operations/OperationsWorkspace';
import AdminOnboarding from '../../src/features/onboarding/AdminOnboarding';
import DispensaryOnboarding from '../../src/features/onboarding/DispensaryOnboarding';
import TeamInvitationGate from '../../src/features/operations/TeamInvitationGate';
import { captureDispensaryInvitation, clearDispensaryInvitation } from '../../src/lib/dispensaryInvitation';
import { useDiscardDialog } from '../../src/features/operations/useDiscardDialog';
import './style.css';

type MailMessage = { id: string; to: string; subject: string; text: string; kind: 'team-invite' | 'dispensary-invite'; token: string };
function LocalDemo({ initial }: { initial: DemoMetadata }) {
  const [metadata, setMetadata] = useState(initial);
  const [actor, setActor] = useState(new URLSearchParams(location.search).get('actor') ?? 'admin');
  const [invitation, setInvitation] = useState(captureDispensaryInvitation);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const inbox = useRef<HTMLDialogElement>(null);
  const inboxRead = useRef<{ epoch: number; controller: AbortController | null }>({ epoch: 0, controller: null });
  const { confirmDiscard, discardDialog } = useDiscardDialog(metadata.generation);
  const fields = useRef(new Map<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, string>());
  const id = metadata.identities.find(row => row.key === actor) ?? metadata.identities[0];
  useEffect(() => { if (expired) document.getElementById('local-context-error')?.focus(); }, [expired]);
  useEffect(() => {
    const withdraw = () => { invalidateDemoScope(); inboxRead.current.epoch++; inboxRead.current.controller?.abort(); setBusy(false); setExpired(true); setInvitation(null); setMessages([]); inbox.current?.close(); fields.current.clear(); };
    const channel = new BroadcastChannel('local-demo-generation');
    channel.onmessage = event => { if (event.data !== metadata.generation) withdraw(); };
    window.addEventListener('local-demo-expired', withdraw);
    return () => { inboxRead.current.epoch++; inboxRead.current.controller?.abort(); channel.close(); window.removeEventListener('local-demo-expired', withdraw); };
  }, [metadata.generation]);
  useEffect(() => {
    fields.current.clear();
    const capture = (event: FocusEvent) => {
      const target = event.target;
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) && target.closest('.local-product') && !(target instanceof HTMLInputElement && ['search', 'date', 'datetime-local'].includes(target.type)) && !fields.current.has(target)) fields.current.set(target, target instanceof HTMLInputElement && target.type === 'checkbox' ? String(target.checked) : target.value);
    };
    const saved = (event: Event) => {
      const action = (event as CustomEvent<{ action: string }>).detail.action;
      for (const field of fields.current.keys()) {
        const area = action === 'invite' ? '.onboarding-invite' : action === 'review' ? '.onboarding-review'
          : ['save-draft', 'submit'].includes(action) ? '.onboarding-form'
            : ['save-product', 'save-supplier', 'receive'].includes(action) ? '[aria-label="Gestion comercial"]' : null;
        const label = field.closest('label')?.textContent ?? '';
        if (area && field.closest(area) || action === 'create' && label.includes('Correo del trabajador')
          || action === 'save-profile' && /Nombre ficticio|Correo ficticio|Telefono ficticio|Confirmo que estos datos/.test(label)
          || action === 'save-note' && label.includes('Nota de prueba')) fields.current.delete(field);
      }
    };
    document.addEventListener('focusin', capture); window.addEventListener('local-demo-saved', saved);
    return () => { document.removeEventListener('focusin', capture); window.removeEventListener('local-demo-saved', saved); };
  }, [actor, metadata.generation]);
  function dirty() {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
    return event.defaultPrevented || [...fields.current].some(([field, previous]) => field.isConnected && (field instanceof HTMLInputElement && field.type === 'checkbox' ? String(field.checked) : field.value) !== previous);
  }
  async function changeActor(next: string, entry: typeof invitation = null) {
    if (next === actor && !entry) return;
    if (hasPendingDemoWrite()) { setError('Recupera la operacion pendiente antes de cambiar de actor. Se conserva su identificador.'); return; }
    if (dirty() && !await confirmDiscard('Cambiar de actor elimina la preparacion sin guardar de esta sesion local.')) return;
    clearDispensaryInvitation(); setActor(next); setError(''); inbox.current?.close();
    history.replaceState(null, '', `/dispensario?actor=${encodeURIComponent(next)}${entry && 'token' in entry ? `#${entry.kind === 'worker' ? 'team-invite' : 'dispensary-invite'}=${entry.token}` : ''}`);
    setInvitation(entry ? captureDispensaryInvitation() : null);
    sessionStorage.setItem('local-demo-invited-actor', next);
  }
  async function openInbox() {
    setError(''); setBusy(true);
    const epoch = ++inboxRead.current.epoch;
    inboxRead.current.controller?.abort(); const controller = new AbortController(); inboxRead.current.controller = controller;
    try {
      const response = await fetch('/__local_demo/mail', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (controller.signal.aborted || epoch !== inboxRead.current.epoch) return;
      setMessages(result); inbox.current?.showModal();
    } catch { if (!controller.signal.aborted && epoch === inboxRead.current.epoch) setError('No se pudo leer el buzon local.'); }
    finally { if (epoch === inboxRead.current.epoch) setBusy(false); }
  }
  async function reset() {
    if (!await confirmDiscard('Reiniciar elimina todos los registros sinteticos del ensayo, incluidas invitaciones, stock y comprobantes.')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/__local_demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error();
      const next: DemoMetadata = await response.json(); configureDemo(next); setMetadata(next);
      const channel = new BroadcastChannel('local-demo-generation'); channel.postMessage(next.generation); channel.close();
      clearDispensaryInvitation(); setInvitation(null); setActor('admin'); setMessages([]); fields.current.clear();
      setExpired(false);
      sessionStorage.setItem('local-demo-generation', String(next.generation));
      history.replaceState(null, '', '/?actor=admin');
    } catch { setError('No se pudo reiniciar. Recarga para comprobar el estado antes de repetir.'); } finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/__local_demo/meta', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const next: DemoMetadata = await response.json(); configureDemo(next); setMetadata(next);
      clearDispensaryInvitation(); setInvitation(null); setActor('admin'); setExpired(false);
      sessionStorage.setItem('local-demo-generation', String(next.generation)); history.replaceState(null, '', '/?actor=admin');
    } catch { setError('No se puede recuperar este escenario. Comprueba que el servidor local siga abierto.'); } finally { setBusy(false); }
  }
  const identity = { enabled: true, ready: true, authenticated: true, tokenReady: true, subject: id.subject, email: id.email,
    getIdentityToken: async () => id.token, beginLogin: async () => {}, logout: async () => { await changeActor('admin'); } };
  const entryKey = `${metadata.generation}:${id.key}:${invitation?.kind}:${invitation && 'token' in invitation ? invitation.token : ''}`;
  return <div className="local-demo tl-operations"><header className="local-toolbar">
    <strong>{'Demostraci\u00f3n local \u00b7 Datos sint\u00e9ticos'}</strong>
    <label>Actor de demostracion<select aria-label="Actor de demostracion" value={actor} disabled={busy || expired} onChange={event => void changeActor(event.target.value)}>{metadata.identities.map(row => <option value={row.key} key={row.key}>{row.label}</option>)}</select></label>
    <span className="local-account">{id.email}<span>Identidad simulada</span></span>
    <button type="button" aria-label="Buzon local" title="Buzon local" disabled={busy || expired} onClick={() => void openInbox()}><Mail size={20}/></button>
    <button type="button" aria-label="Reiniciar escenario" title="Reiniciar escenario" disabled={busy || expired} onClick={() => void reset()}><RotateCcw size={20}/></button>
  </header>{error && <p className="local-error" role="alert">{error}</p>}
    <main className="local-product">{expired ? <section><p role="alert" tabIndex={-1} id="local-context-error">El escenario anterior ya no esta disponible. Sus datos se retiraron.</p><button disabled={busy} onClick={() => void recover()}>Recuperar escenario</button></section> : <TrustLeafPrivyContext.Provider key={entryKey} value={identity}>
      {invitation?.kind === 'invalid' ? <p role="alert">Invitacion no valida</p> : invitation?.kind === 'worker' ? <TeamInvitationGate token={invitation.token}/>
        : id.key === 'newManager' ? <DispensaryOnboarding token={invitation?.kind === 'manager' ? invitation.token : null}/>
          : id.key === 'admin' ? <div className="op-content"><AdminOnboarding/></div> : <OperationsWorkspace email={id.email}/>}
    </TrustLeafPrivyContext.Provider>}</main>
    <dialog ref={inbox} className="local-inbox" aria-labelledby="local-inbox-title"><header><h2 id="local-inbox-title">Buzon local</h2><button autoFocus aria-label="Cerrar buzon" onClick={() => inbox.current?.close()}><X size={20}/></button></header>
      {messages.length === 0 ? <p>No hay mensajes en este ensayo.</p> : messages.map(message => <article key={message.id}><h3>{message.subject}</h3><p>{message.to}</p><pre>{message.text}</pre><button onClick={() => {
        const recipient = metadata.identities.find(row => row.email === message.to);
        if (!recipient || !/^[A-Za-z0-9_-]{43}$/.test(message.token)) return;
        const entry = { kind: message.kind === 'team-invite' ? 'worker' : 'manager', token: message.token } as typeof invitation;
        void changeActor(recipient.key, entry);
      }}>Abrir invitacion</button></article>)}
    </dialog>{discardDialog}
  </div>;
}
async function boot() {
  const fragments = new URLSearchParams(location.hash.slice(1));
  const explicit = fragments.get('demo-access');
  const access = explicit ?? sessionStorage.getItem('local-demo-bootstrap');
  if (!access || !/^[A-Za-z0-9_-]{43}$/.test(access)) throw new Error('LOCAL_BOOTSTRAP_REQUIRED');
  configureBootstrap(access); sessionStorage.setItem('local-demo-bootstrap', access);
  fragments.delete('demo-access');
  history.replaceState(null, '', location.pathname + location.search + (fragments.size ? '#' + fragments : ''));
  const response = await fetch('/__local_demo/meta', { cache: 'no-store' });
  if (!response.ok) throw new Error('LOCAL_START_FAILED');
  const metadata: DemoMetadata = await response.json(); configureDemo(metadata);
  const actor = new URLSearchParams(location.search).get('actor') ?? 'admin';
  if (sessionStorage.getItem('local-demo-generation') !== String(metadata.generation) || sessionStorage.getItem('local-demo-invited-actor') !== actor) {
    const explicitInvitation = location.hash;
    clearDispensaryInvitation();
    history.replaceState(null, '', location.pathname + location.search + explicitInvitation);
  }
  sessionStorage.setItem('local-demo-generation', String(metadata.generation));
  sessionStorage.setItem('local-demo-invited-actor', actor);
  createRoot(document.getElementById('root')!).render(<LocalDemo initial={metadata}/>);
}
void boot().catch(() => { const status = document.getElementById('local-start-status'); if (status) { status.textContent = 'No se pudo iniciar la demostracion local. Usa el enlace de arranque del servidor.'; status.setAttribute('role', 'alert'); } });
