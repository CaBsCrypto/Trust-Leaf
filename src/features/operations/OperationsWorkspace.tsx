import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, CalendarDays, ClipboardList, History, LogOut, Package, Plus, RefreshCw, Save, ShieldCheck, Users, X } from 'lucide-react';
import TeamPanel from './TeamPanel';
import CommercePanel from '../commerce/CommercePanel';
import AdminOrganizationTeams from './AdminOrganizationTeams';
import DispensaryAttention from './DispensaryAttention';
import { Preparation, ProfileForm, DailyOverview } from './DispensaryDaily';
import PrivyAgenda, { type AgendaTarget } from '../../components/PrivyAgenda';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { currentPeriod, formatGrams, gramsToMg, type Booking, type PilotAction, type PilotCommand, type PilotRole, type PilotSnapshot, type Treatment } from './contracts';
import './operations.css';

const titles: Record<PilotRole, string> = { doctor: 'Mi consulta', patient: 'Mi atencion', dispensary: 'Mi dispensario', admin: 'Supervision del piloto' };
const date = (value: string) => new Date(value).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });
const short = (value: string) => value.slice(0, 8);
const consultationFilters = [['pending', 'Pendientes'], ['active', 'En atención'], ['completed', 'Finalizadas'], ['cancelled', 'Canceladas'], ['all', 'Todas']] as const;
type ConsultationFilter = typeof consultationFilters[number][0];
type Mutate = (action: PilotAction, input: Record<string, unknown>) => void;
type Field = { name: string; label: string; type?: 'text' | 'number' | 'textarea' | 'select' | 'datetime-local'; value?: string;
  choices?: { value: string; label: string }[]; min?: number; max?: number; maxLength?: number };

export default function OperationsWorkspace({ email, onSignOut, embedded = false }: { email?: string; onSignOut?: () => void; embedded?: boolean }) {
  const identity = useTrustLeafPrivyIdentity();
  return <WorkspaceSession key={`${identity.subject}:${identity.authenticated}:${identity.ready}`} email={email} onSignOut={onSignOut} embedded={embedded}/>;
}

function WorkspaceSession({ email, onSignOut, embedded }: { email?: string; onSignOut?: () => void; embedded: boolean }) {
  const identity = useTrustLeafPrivyIdentity();
  const [data, setData] = useState<PilotSnapshot | null>(null);
  const [tab, setSelectedTab] = useState('today');
  const [search, setSearch] = useState('');
  const [managementView, setManagementView] = useState<'commerce' | 'team'>('commerce');
  const [consultationFilter, setConsultationFilter] = useState<ConsultationFilter>('pending');
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [historyDate, setHistoryDate] = useState('');
  const [historyBatch, setHistoryBatch] = useState('');
  const [historyView, setHistoryView] = useState<'deliveries' | 'movements'>('deliveries');
  const [agendaTarget, setAgendaTarget] = useState<AgendaTarget>();
  const setTab = (next: string, target?: AgendaTarget) => {
    setSearch(''); setAgendaTarget(target); setSelectedTab(next);
    if (next !== tab && data?.role === 'dispensary') {
      setInventoryFilter('all'); setHistoryDate(''); setHistoryBatch(''); setHistoryView('deliveries');
    }
  };
  const openBatchHistory = (batchRef: string) => { setTab('history'); setHistoryBatch(batchRef); };
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [notice, setNotice] = useState('');
  const [receiptRef, setReceiptRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PilotCommand | null>(null);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const controller = useRef(new AbortController());
  const requestNumber = useRef(0);
  useEffect(() => { controller.current = new AbortController(); return () => { controller.current.abort(); requestNumber.current++; }; }, []);

  async function request(command?: PilotCommand, signal = controller.current.signal) {
    let token = await identity.getIdentityToken(); signal.throwIfAborted();
    if (!token && !command) token = await identity.refreshIdentityToken?.() ?? null;
    signal.throwIfAborted();
    if (!token) throw Object.assign(new Error('Inicia sesion nuevamente.'), { status: 401 });
    const send = () => fetch('/api/operations-pilot', { method: command ? 'POST' : 'GET', signal, cache: 'no-store',
      headers: { 'privy-id-token': token!, ...(command ? { 'content-type': 'application/json' } : {}) },
      ...(command ? { body: JSON.stringify(command) } : {}) });
    let response = await send();
    if (response.status === 401 && !command && identity.refreshIdentityToken) {
      token = await identity.refreshIdentityToken(); signal.throwIfAborted(); if (token) response = await send();
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.code === 'PILOT_DISABLED' ? 'El piloto operativo aun no esta habilitado en este entorno.'
        : response.status === 403 ? 'Esta cuenta no tiene permiso o falta la autorizacion del paciente.'
        : response.status === 409 ? 'El registro cambio, no queda saldo o stock, o la operacion ya no esta disponible. Actualiza los datos.'
        : response.status === 400 ? 'Revisa los datos de la operacion.' : 'No fue posible confirmar la operacion. Puedes reintentar.';
      throw Object.assign(new Error(message), { status: response.status });
    }
    return response.json();
  }

  useEffect(() => {
    if (!identity.ready || !identity.authenticated) return;
    const read = new AbortController();
    const current = ++requestNumber.current;
    let readSequence = 0;
    async function refresh() {
      const sequence = ++readSequence;
      try {
        const result = await request(undefined, read.signal);
        if (read.signal.aborted || current !== requestNumber.current || sequence !== readSequence) return;
        if (result.synthetic !== true || !['doctor', 'patient', 'dispensary', 'admin'].includes(result.role)) throw new Error('Respuesta operativa no disponible.');
        setData(result); setReadError('');
      } catch (e) {
        if (read.signal.aborted || current !== requestNumber.current || sequence !== readSequence) return;
        if ([401, 403].includes((e as { status?: number }).status ?? 0)) setData(null);
        setReadError((e as Error).message);
      }
    }
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible' && !lock.current) void refresh(); };
    const timer = setInterval(visibleRefresh, 15000);
    window.addEventListener('focus', visibleRefresh); window.addEventListener('online', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { read.abort(); clearInterval(timer); window.removeEventListener('focus', visibleRefresh);
      window.removeEventListener('online', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [revision, identity.subject, identity.ready, identity.authenticated, identity.tokenReady]);

  async function execute(command: PilotCommand) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setPending(command); setError(''); setReadError(''); setNotice(''); requestNumber.current++;
    try {
      const result = await request(command);
      if (controller.current.signal.aborted) return;
      setPending(null); setNotice(command.action === 'dispense' ? `Entrega guardada. Comprobante: ${result.resourceRef}` : 'Cambio guardado.');
      if (command.action === 'dispense') setReceiptRef(result.resourceRef);
    } catch (e) {
      if (controller.current.signal.aborted) return;
      setError((e as Error).message);
      if ([401, 403].includes((e as { status?: number }).status ?? 0)) setData(null);
      if ([400, 401, 403, 409].includes((e as { status?: number }).status ?? 0)) setPending(null);
    } finally {
      if (!controller.current.signal.aborted) {
        lock.current = false; setBusy(false);
        // Every write invalidates prior reads, including rejected or uncertain writes.
        setRevision(n => n + 1);
      }
    }
  }
  const mutate: Mutate = (action, input) => void execute({ action, input: { ...input, operationId: crypto.randomUUID() } });
  const query = search.trim().toLocaleLowerCase();
  const matches = (value: string) => value.toLocaleLowerCase().includes(query);
  const disabled = busy || pending !== null;
  const visibleError = readError || error;
  const role = data?.role;
  const withoutTeam = role === 'dispensary' && data?.staffOnly && !data.membership?.organization_ref;
  const searchHint = tab === 'inventory' ? 'Codigo de lote o producto'
    : tab === 'history' && role === 'dispensary' ? historyView === 'deliveries' ? 'Comprobante, producto o codigo de lote' : 'Movimiento, producto, lote o motivo'
    : tab === 'team' ? role === 'admin' ? 'Nombre o referencia del dispensario' : 'Correo del equipo'
    : tab === 'today' && role === 'patient' ? 'Referencia de cita o texto de nota'
    : role === 'dispensary' && tab === 'today' ? 'Nombre o referencia del paciente'
    : role === 'doctor' || tab === 'treatment' ? 'Referencia de paciente o registro'
    : 'Referencia del registro';
  const consultationState = (b: Booking) => b.state === 'cancelled' ? 'cancelled'
    : data?.encounters?.find(e => e.booking_ref === b.booking_ref)?.state ?? (b.state === 'confirmed' ? 'pending' : 'other');
  const consultationCounts = Object.fromEntries(consultationFilters.map(([id]) => [id,
    (data?.bookings ?? []).filter(b => id === 'all' || consultationState(b) === id).length]));
  const filteredBookings = (data?.bookings ?? []).filter(b => role !== 'doctor' || consultationFilter === 'all' || consultationState(b) === consultationFilter);
  const visibleBookings = filteredBookings.filter(b => matches(role === 'doctor' ? `${b.booking_ref} ${b.patient_ref}` : b.booking_ref));
  if (role === 'doctor') visibleBookings.sort((a, b) => {
    const direction = consultationFilter === 'pending' || consultationFilter === 'active' ? 1 : -1;
    return direction * (Date.parse(a.starts_at) - Date.parse(b.starts_at)) || a.booking_ref.localeCompare(b.booking_ref);
  });
  const treatments = (data?.treatments ?? []).filter(t => matches(`${t.patient_ref} ${t.treatment_ref} ${data?.patientProfiles?.find(p => p.patient_ref === t.patient_ref)?.name ?? ''}`));
  const now = Date.now();
  const batchState = (b: NonNullable<PilotSnapshot['batches']>[number]) => b.state === 'quarantined' ? 'quarantined' : Date.parse(b.expires_at) <= now ? 'expired' : b.stock_mg <= 0 ? 'empty' : 'available';
  const batchLabels = { quarantined: 'Cuarentena', expired: 'Vencido', empty: 'Agotado', available: 'Disponible' };
  const visibleBatches = (data?.batches ?? []).filter(b => matches(`${b.lot_code} ${b.product}`) && (inventoryFilter === 'all' || batchState(b) === inventoryFilter));
  const historyMatches = (batchRef: string, createdAt: string) => role !== 'dispensary' || ((!historyBatch || batchRef === historyBatch) && (!historyDate || new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago'}).format(new Date(createdAt)) === historyDate));
  const visibleDeliveries = (data?.deliveries ?? []).filter(d => {
    const batch = data?.batches?.find(b => b.batch_ref === d.batch_ref);
    return matches(`${d.treatment_ref} ${d.delivery_ref} ${role === 'dispensary' ? `${d.product ?? batch?.product ?? ''} ${d.lot_code ?? batch?.lot_code ?? ''}` : ''}`) && historyMatches(d.batch_ref,d.created_at);
  }).sort((a,b) => b.created_at.localeCompare(a.created_at) || a.delivery_ref.localeCompare(b.delivery_ref));
  const visibleMovements = (data?.movements ?? []).filter(m => {
    const batch = data?.batches?.find(b => b.batch_ref === m.batch_ref);
    return matches(`${m.movement_ref} ${m.batch_ref} ${m.reason} ${batch?.product ?? ''} ${batch?.lot_code ?? ''}`) && historyMatches(m.batch_ref,m.created_at);
  }).sort((a,b) => b.created_at.localeCompare(a.created_at) || a.movement_ref.localeCompare(b.movement_ref));
  const historyLots = new Map((data?.deliveries ?? []).map(d => [d.batch_ref, `${d.product ?? 'Producto no disponible'} · ${d.lot_code ?? short(d.batch_ref)}`]));
  for (const b of data?.batches ?? []) historyLots.set(b.batch_ref, `${b.product} · ${b.lot_code}`);
  const tabs = role === 'admin' ? [['today', 'Actividad'], ['team', 'Organizaciones'], ['demo', 'POV de prueba']]
    : role === 'dispensary' ? [['today', 'Atenciones'], ['inventory', 'Inventario'], ['team', import.meta.env.VITE_COMMERCE_CATALOG_ENABLED === 'true' ? 'Gestion' : 'Equipo'], ['history', 'Historial']]
    : [['today', role === 'doctor' ? 'Consultas' : 'Mi atencion'], ['agenda', 'Agenda'], ['treatment', 'Tratamientos'], ['history', 'Historial']];

  return <section className={`tl-operations ${role === 'dispensary' ? 'op-dispensary' : ''} ${embedded ? '' : 'tl-operations-page'}`}>
    <header className="op-header"><div><p className="op-brand">Trust Leaf</p><h1>{role ? titles[role] : 'Panel operativo'}</h1>
      <p className="op-email">{email ?? identity.email ?? 'Cuenta conectada'}</p>
      {role === 'dispensary' && data?.membership?.organization_ref && <p className="op-email">{data.organizations?.find(o => o.organization_ref === data.membership?.organization_ref)?.name} · {data.membership.role === 'manager' ? 'Encargado' : 'Operador'}</p>}</div>
      <div className="op-toolbar"><span className="op-simulation">Piloto simulado</span>
        <button title="Actualizar datos" aria-label="Actualizar datos" disabled={busy} onClick={() => { setError(''); setRevision(n => n + 1); }}><RefreshCw size={18}/></button>
        {onSignOut && <button title="Cerrar sesion" aria-label="Cerrar sesion" onClick={onSignOut}><LogOut size={18}/></button>}</div></header>
    <div className="op-content">
      {notice && !withoutTeam && <p role="status" className="op-success">{notice}</p>}
      {visibleError && <p role="alert" className="op-error">{notice && readError ? `${notice} No se pudo actualizar la vista. ` : ''}{visibleError}</p>}
      {pending && !busy && !withoutTeam && <button className="op-command" onClick={() => void execute(pending)}><RefreshCw size={16}/>Reintentar operacion</button>}
      {!data && !visibleError && <p role="status">Verificando permisos...</p>}
      {data && !data.joined && !withoutTeam && <div className="op-empty"><ShieldCheck size={32}/><h2>Participar en el piloto</h2>
        <p>Solo datos ficticios. Sin atencion clinica ni entrega real de medicamentos.</p>
        <button className="op-command" disabled={disabled} onClick={() => mutate('join', { acceptSyntheticOnly: true })}>Aceptar y participar</button></div>}
      {withoutTeam && <div className="op-empty" role="status"><ShieldCheck size={32}/>
        <h2>Sin acceso a un dispensario</h2>
        <p>Tu cuenta sigue activa. Para incorporarte a un equipo, necesitas una nueva invitación del encargado. Las operaciones anteriores se conservan en el historial del dispensario.</p>
      </div>}
      {data?.joined && !withoutTeam && <>
        {role === 'dispensary' && data.membership?.organization_ref && <DailyOverview data={data} navigate={setTab}/>}
        {role === 'dispensary' && !data.staffOnly && (!data.membership?.organization_ref || data.membership.role === 'manager') && tab === 'today' && <Preparation data={data} navigate={setTab}/>}
        <nav className="op-tabs" aria-label="Secciones del panel">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
        {tab !== 'agenda' && tab !== 'demo' && !(role === 'dispensary' && tab === 'team' && managementView === 'commerce' && import.meta.env.VITE_COMMERCE_CATALOG_ENABLED === 'true') && <label className="op-search">{role === 'dispensary' && tab === 'today' ? 'Buscar paciente por nombre o referencia' : 'Buscar'}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={searchHint}/></label>}
        {tab === 'today' && role === 'dispensary' && <DispensaryAttention data={data} search={search} disabled={disabled} readError={readError} receiptRef={receiptRef} submit={input => mutate('dispense', input)} history={() => setTab('history')}/>}
        {tab === 'agenda' && (role === 'doctor' || role === 'patient') && <PrivyAgenda email={email} target={agendaTarget}/>}
        {tab === 'treatment' && role === 'patient' && <ProfileForm profile={data.profile} disabled={disabled} save={input => mutate('save-profile', input)}/>}
        {tab === 'today' && role === 'doctor' && <>
          <h2><ClipboardList size={20}/>Consultas</h2>
          <div className="op-tabs" role="group" aria-label="Estado de consultas">{consultationFilters.map(([id, label]) =>
            <button key={id} aria-pressed={consultationFilter === id} onClick={() => setConsultationFilter(id)}>{label} ({consultationCounts[id]})</button>)}</div>
          {visibleBookings.map(b => {
            const encounter = data.encounters?.find(e => e.booking_ref === b.booking_ref);
            const notes = data.notes?.filter(n => n.booking_ref === b.booking_ref).sort((a, b) => b.version - a.version) ?? [];
            return <article className="op-row" key={b.booking_ref}>
              <h3>{date(b.starts_at)} <span className="op-muted">Paciente {short(b.patient_ref)}</span></h3>
              <p className="op-reference">{b.booking_ref}</p><p>{b.state === 'cancelled' ? 'Cancelada' : encounter?.state === 'completed' ? 'Atencion finalizada' : encounter ? 'En atencion' : 'Confirmada'}</p>
              <button className="op-command" onClick={() => setTab('agenda', { bookingRef: b.booking_ref, startsAt: b.starts_at })}><CalendarDays size={16}/>Ver en agenda</button>
              {b.state === 'confirmed' && !encounter && <button className="op-command" disabled={disabled} onClick={() => mutate('start-encounter', { resourceRef: b.booking_ref })}><Plus size={16}/>Iniciar consulta simulada</button>}
              {encounter?.state === 'active' && b.state === 'confirmed' && <>
                <CommandForm key={`note-${encounter.version}`} label="Guardar borrador" disabled={disabled} fields={[{ name: 'note', label: 'Nota de prueba', type: 'textarea', value: notes[0]?.body, maxLength: 4000 }]}
                  submit={values => mutate('save-note', { resourceRef: b.booking_ref, version: encounter.version, note: values.note })}/>
                <CommandForm label="Finalizar con tratamiento simulado" disabled={disabled} fields={[{ name: 'grams', label: 'Gramos por periodo', value: '30' }, { name: 'periods', label: 'Periodos de 30 dias', type: 'number', value: '3', min: 1, max: 12 }]}
                  submit={values => mutate('complete-encounter', { resourceRef: b.booking_ref, version: encounter.version, issueTreatment: true, allowanceMg: gramsToMg(values.grams), periodCount: Number(values.periods) })}/>
                <button className="op-command" disabled={disabled} onClick={() => { if (confirm('Finalizar esta consulta sin tratamiento?')) mutate('complete-encounter', { resourceRef: b.booking_ref, version: encounter.version, issueTreatment: false }); }}>Finalizar sin tratamiento</button>
              </>}
              {notes.length > 0 && <details><summary>Historial de notas ({notes.length})</summary>{notes.map(n => <div className="op-note" key={n.version}><strong>Version {n.version} · {date(n.created_at)}</strong><p>{n.body}</p></div>)}</details>}
            </article>;
          })}
          {!visibleError && !data.bookings?.length && <Empty>No hay consultas. Publica un horario desde Agenda.</Empty>}
          {!visibleError && !!data.bookings?.length && !filteredBookings.length && <Empty>No hay consultas en este estado.</Empty>}
          {!visibleError && !!filteredBookings.length && !visibleBookings.length && <Empty>No hay consultas para esta busqueda.</Empty>}
        </>}
        {tab === 'today' && role === 'patient' && <>
          <h2><CalendarDays size={20}/>Mis citas</h2>
          {visibleBookings.map(b => <article className="op-row" key={b.booking_ref}><h3>{date(b.starts_at)}</h3><p>Medico {short(b.doctor_ref)} · {b.state === 'cancelled' ? 'Cancelada' : data.encounters?.some(e => e.booking_ref === b.booking_ref && e.state === 'completed') ? 'Atencion finalizada' : 'Confirmada'}</p><button className="op-command" onClick={() => setTab('agenda', { bookingRef: b.booking_ref, startsAt: b.starts_at })}><CalendarDays size={16}/>Ver en agenda</button></article>)}
          {!data.bookings?.length && <Empty>No tienes citas reservadas.</Empty>}
          {!!data.bookings?.length && !visibleBookings.length && <Empty>No hay citas para esta busqueda.</Empty>}
          <h2>Notas de mi atencion</h2>{data.notes?.filter(n => matches(`${n.booking_ref} ${n.body}`)).map(n => <article className="op-row" key={`${n.booking_ref}-${n.version}`}><strong>{date(n.created_at)} · Version {n.version}</strong><p className="op-note">{n.body}</p></article>)}
        </>}
        {tab === 'treatment' && <>
          <h2><Activity size={20}/>Tratamientos simulados</h2>
          {!treatments.length && <Empty>{query ? 'No hay resultados para esta busqueda.' : 'No hay tratamientos emitidos.'}</Empty>}
          {treatments.map(t => <article className="op-row" key={t.treatment_ref}>
            <TreatmentSummary treatment={t} time={now}/>
            {role === 'doctor' && t.state === 'active' && <button className="op-command" disabled={disabled} onClick={() => { if (confirm('Revocar este tratamiento simulado?')) mutate('revoke-treatment', { resourceRef: t.treatment_ref, version: t.version }); }}><X size={16}/>Revocar tratamiento</button>}
            {role === 'patient' && <div className="op-grants"><h3>Permisos de dispensacion</h3>
              <p>Al autorizar compartes tu nombre, correo y telefono ficticios, tratamiento y entregas durante 24 horas. No se comparte tu ficha clinica.</p>
              {(data.organizations ?? []).map(org => { const grant = data.grants?.find(g => g.treatment_ref === t.treatment_ref && g.organization_ref === org.organization_ref && Date.parse(g.expires_at) > now);
                return <div className="op-line" key={org.organization_ref}><span>{org.name}{grant && <small>Hasta {date(grant.expires_at)}</small>}</span><button className="op-command" disabled={disabled || !currentPeriod(t, now)} onClick={() => mutate(grant ? 'revoke-grant' : 'grant', { resourceRef: t.treatment_ref, organizationRef: org.organization_ref })}>{grant ? 'Revocar permiso' : 'Autorizar 24 horas'}</button></div>;
              })}
              {(data.grants ?? []).filter(g => g.treatment_ref === t.treatment_ref && Date.parse(g.expires_at) > now && !data.organizations?.some(o => o.organization_ref === g.organization_ref)).map(g => <div className="op-line" key={g.organization_ref}><span>Dispensario {short(g.organization_ref)}</span><button className="op-command" disabled={disabled} onClick={() => mutate('revoke-grant', { resourceRef: t.treatment_ref, organizationRef: g.organization_ref })}>Revocar permiso</button></div>)}
            </div>}
          </article>)}
        </>}
        {tab === 'inventory' && role === 'dispensary' && <>
          <h2><Package size={20}/>Inventario por lote</h2>
          <div className="op-tabs" role="group" aria-label="Estado de inventario">{[['available','Disponibles'],['quarantined','Cuarentena'],['expired','Vencidos'],['empty','Agotados'],['all','Todos']].map(([id,label]) => <button key={id} aria-pressed={inventoryFilter === id} onClick={() => setInventoryFilter(id)}>{label}</button>)}</div>
          {data.membership?.role === 'manager' && <details className="op-stock-receive"><summary>Recibir lote</summary><CommandForm label="Recibir lote simulado" disabled={disabled || !!readError} fields={[
            { name: 'lotCode', label: 'Codigo de lote', maxLength: 80 }, { name: 'product', label: 'Producto', value: 'Flor de prueba', maxLength: 100 },
            { name: 'sourceReference', label: 'Referencia de origen', maxLength: 160 }, { name: 'expiresAt', label: 'Vencimiento', type: 'datetime-local' }, { name: 'grams', label: 'Cantidad en gramos', value: '100' }]}
            submit={v => mutate('receive-batch', { lotCode: v.lotCode, product: v.product, sourceReference: v.sourceReference, expiresAt: new Date(v.expiresAt).toISOString(), quantityMg: gramsToMg(v.grams) })}/></details>}
          {visibleBatches.map(b => <article className="op-row op-stock-row" key={b.batch_ref}>
            <div><h3>{b.product}</h3><p>Lote {b.lot_code}</p></div>
            <div className="op-stock-amount"><strong>{formatGrams(b.stock_mg)}</strong><span className={`op-batch-state op-batch-${batchState(b)}`}>{batchLabels[batchState(b)]}</span></div>
            <p>Vence: {date(b.expires_at)}</p>
            <button className="op-command" onClick={() => openBatchHistory(b.batch_ref)}><History size={16}/>Ver historial del lote</button>
            <details><summary>Origen y trazabilidad</summary><p>Origen: {b.source_reference}</p><p className="op-reference">Lote: {b.batch_ref}</p></details>
            {data.membership?.role === 'manager' && <details><summary>Gestionar lote</summary><button className="op-command" disabled={disabled || !!readError} onClick={() => mutate('set-batch-state', { resourceRef: b.batch_ref, version: b.version, state: b.state === 'active' ? 'quarantined' : 'active' })}>{b.state === 'active' ? 'Poner en cuarentena' : 'Liberar cuarentena'}</button>
              <details><summary>Ajustar existencias</summary><CommandForm label="Registrar ajuste" disabled={disabled || !!readError} fields={[{ name: 'grams', label: 'Variacion en gramos (+/-)' }, { name: 'reason', label: 'Motivo del ajuste', maxLength: 160 }]}
                submit={v => mutate('adjust-stock', { resourceRef: b.batch_ref, version: b.version, quantityMg: gramsToMg(v.grams, true), reason: v.reason })}/></details></details>}
          </article>)}
          {!visibleError && !visibleBatches.length && <Empty>{query ? 'No hay resultados para esta busqueda.' : data.batches?.length ? 'No hay lotes en este estado.' : 'No hay lotes registrados.'}</Empty>}
        </>}
        {tab === 'team' && <>
          {role === 'dispensary' && data.membership?.organization_ref && import.meta.env.VITE_COMMERCE_CATALOG_ENABLED === 'true' && <>
            <div className="op-tabs" role="group" aria-label="Gestion del dispensario"><button aria-pressed={managementView === 'commerce'} onClick={() => { setManagementView('commerce'); setSearch(''); }}>Registros comerciales</button><button aria-pressed={managementView === 'team'} onClick={() => { setManagementView('team'); setSearch(''); }}>Equipo</button></div>
            {managementView === 'commerce' && <CommercePanel key={data.membership.organization_ref} data={data} changed={() => setRevision(n => n + 1)}/>}
          </>}
          {(role !== 'dispensary' || !data.membership?.organization_ref || import.meta.env.VITE_COMMERCE_CATALOG_ENABLED !== 'true' || managementView === 'team') && <>
          <h2><Users size={20}/>Organizacion y equipo</h2>
          {role === 'admin' && !data.organizations?.length && <Empty>No hay organizaciones registradas.</Empty>}
          {role === 'dispensary' && !data.staffOnly && !data.membership?.organization_ref && <CommandForm label="Crear dispensario de prueba" disabled={disabled} fields={[{ name: 'name', label: 'Nombre del dispensario', maxLength: 100 }]} submit={v => mutate('create-organization', v)}/>}
          {role === 'dispensary' && data.membership?.organization_ref && <TeamPanel search={search} revision={revision} disabled={disabled} remove={actorRef => mutate('remove-operator', { resourceRef: actorRef })}/>}
          {role === 'admin' && <AdminOrganizationTeams organizations={data.organizations ?? []} members={data.members ?? []} search={search} revision={revision}/>}
          </>}
        </>}
        {tab === 'history' && <>
          <h2>{role === 'dispensary' && historyView === 'movements' ? 'Movimientos de stock' : 'Historial de entregas'}</h2>
          {role === 'dispensary' && <><div className="op-tabs" role="group" aria-label="Tipo de historial"><button aria-pressed={historyView === 'deliveries'} onClick={() => setHistoryView('deliveries')}>Entregas</button><button aria-pressed={historyView === 'movements'} onClick={() => setHistoryView('movements')}>Movimientos de stock</button></div>
          <div className="op-form op-history-filters"><fieldset><label>{historyView === 'deliveries' ? 'Fecha de entrega' : 'Fecha de movimiento'}<input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}/></label><label>Lote del historial<select value={historyBatch} onChange={e => setHistoryBatch(e.target.value)}><option value="">Todos</option>{[...historyLots].map(([ref,label]) => <option key={ref} value={ref}>{label}</option>)}</select></label><button type="button" title="Limpiar filtros" aria-label="Limpiar filtros" disabled={!search && !historyDate && !historyBatch} onClick={() => { setSearch(''); setHistoryDate(''); setHistoryBatch(''); }}><X size={18}/></button></fieldset></div></>}
          {(role !== 'dispensary' || historyView === 'deliveries') && <>{visibleDeliveries.map(d => {
            const batch = data.batches?.find(b => b.batch_ref === d.batch_ref);
            const own = d.organization_ref === data.membership?.organization_ref;
            return <article className="op-row" key={d.delivery_ref}>
              <h3>{formatGrams(d.quantity_mg)} · {date(d.created_at)}</h3>
              {role === 'dispensary' && <p>{own ? 'Entrega de este dispensario' : 'Entrega compartida de otro dispensario'}</p>}
              <p>{d.organization_name ?? data.organizations?.find(o => o.organization_ref === d.organization_ref)?.name ?? 'Nombre del dispensario no disponible'}</p>
              <p>{d.product ?? batch?.product ?? 'Producto no disponible'} · Lote {d.lot_code ?? batch?.lot_code ?? 'no disponible'} · Periodo {d.period_index}</p>
              <details><summary>Ver comprobante y trazabilidad</summary>
                <p className="op-reference">Dispensario: {d.organization_ref} · Operador: {d.operator_ref}</p>
                <p className="op-reference">Lote: {d.batch_ref}</p>
                <p className="op-reference">Comprobante: {d.delivery_ref}</p>
                <p className="op-reference">Tratamiento: {d.treatment_ref}</p>
              </details>
            </article>;
          })}
          {!visibleError && !!data.deliveries?.length && !visibleDeliveries.length && <Empty>No hay entregas para estos filtros.</Empty>}
          {!visibleError && !data.deliveries?.length && <Empty>No hay entregas registradas.</Empty>}</>}
          {role === 'dispensary' && historyView === 'movements' && <>{visibleMovements.map(m => {
            const batch = data.batches?.find(b => b.batch_ref === m.batch_ref);
            return <article className="op-row" key={m.movement_ref}><h3>{formatGrams(m.quantity_mg)} · {date(m.created_at)}</h3><p>{batch?.product ?? 'Producto no disponible'} · Lote {batch?.lot_code ?? short(m.batch_ref)}</p><p>{m.reason}</p><details><summary>Ver movimiento y trazabilidad</summary><p className="op-reference">Operador: {m.operator_ref} · Movimiento: {m.movement_ref}</p><p className="op-reference">Lote: {m.batch_ref}</p></details></article>;
          })}{!visibleError && !visibleMovements.length && <Empty>{data.movements?.length ? 'No hay movimientos para estos filtros.' : 'No hay movimientos registrados.'}</Empty>}</>}
        </>}
        {tab === 'today' && role === 'admin' && <>
          <div className="op-stats">{Object.entries(data.counts ?? {}).map(([key, value]) => <div key={key}><span>{{ participants: 'Participantes', encounters: 'Consultas', completed: 'Finalizadas', deliveries: 'Entregas' }[key] ?? key}</span><strong>{value}</strong></div>)}</div>
          <h2>Auditoria operativa</h2>{data.audit?.filter(a => matches(`${a.action} ${a.actor_ref}`)).map(a => <div className="op-line" key={a.audit_ref}><span>{a.action}<small>Actor {short(a.actor_ref)} · {short(a.resource_ref)}</small></span><time>{date(a.created_at)}</time></div>)}
          {!data.audit?.length && <Empty>No hay operaciones registradas.</Empty>}
        </>}
        {tab === 'demo' && role === 'admin' && <DemoPerspective/>}
        <p className="op-footer">{data.asOf ? `Actualizado: ${date(data.asOf)} · ` : ''}Datos ficticios · America/Santiago</p>
      </>}
    </div>
  </section>;
}

function Empty({ children }: { children: ReactNode }) { return <p className="op-empty">{children}</p>; }
function TreatmentSummary({ treatment: t, time }: { treatment: Treatment; time: number }) {
  const p = currentPeriod(t, time);
  // Revocation blocks availability, not the display of already recorded deliveries.
  const calendarPeriod = t.periods.find(period => Date.parse(period.starts_at) <= time && time < Date.parse(period.ends_at));
  const withdrawn = calendarPeriod?.used_mg ?? t.periods.reduce((total, period) => total + period.used_mg, 0);
  return <><h3>Tratamiento {short(t.treatment_ref)}</h3><p className="op-reference">Paciente {t.patient_ref}</p>
    <div className="op-stats"><div><span>Asignado por periodo</span><strong>{formatGrams(t.allowance_mg)}</strong></div><div><span>{calendarPeriod ? 'Retirado en periodo' : 'Retirado total'}</span><strong>{formatGrams(withdrawn)}</strong></div><div><span>Disponible ahora</span><strong>{formatGrams(p ? Math.max(0, p.allowance_mg - p.used_mg) : 0)}</strong></div></div>
    <p>{t.state === 'revoked' ? 'Revocado' : p ? `Periodo ${p.period_index} de ${t.period_count}: ${date(p.starts_at)} a ${date(p.ends_at)}` : 'Fuera de vigencia'}</p>
    <details><summary>Vigencia e historial por periodo</summary><p>Emision: {date(t.issued_at)} · Vigencia simulada: {date(t.prescription_valid_until)} · Fin de tratamiento: {date(t.treatment_ends_at)}</p>
      {t.periods.map(period => <p key={period.period_index}>Periodo {period.period_index} · {date(period.starts_at)} a {date(period.ends_at)} · {formatGrams(period.used_mg)} / {formatGrams(period.allowance_mg)}</p>)}</details>
  </>;
}
function CommandForm({ fields, label, disabled, submit }: { fields: Field[]; label: string; disabled: boolean; submit: (values: Record<string, string>) => void }) {
  const [error, setError] = useState('');
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try { submit(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>); }
    catch (e) { setError((e as Error).message); }
  }
  return <form className="op-form" onSubmit={onSubmit}><fieldset disabled={disabled}>{fields.map(f => <label key={f.name} className={f.type === 'textarea' ? 'op-wide' : ''}>{f.label}
    {f.type === 'textarea' ? <textarea aria-label={f.label} name={f.name} defaultValue={f.value ?? ''} required maxLength={f.maxLength} rows={4}/>
      : f.type === 'select' ? <select aria-label={f.label} name={f.name} defaultValue="" required><option value="" disabled>Seleccionar</option>{f.choices?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : <input aria-label={f.label} name={f.name} type={f.type ?? 'text'} defaultValue={f.value ?? ''} required min={f.min} max={f.max} maxLength={f.maxLength ?? 160}/>}
    </label>)}<button className="op-command" type="submit"><Save size={16}/>{label}</button></fieldset>{error && <p role="alert" className="op-error">{error}</p>}</form>;
}
function DemoPerspective() {
  const [role, setRole] = useState<PilotRole>('doctor');
  return <section><h2>POV de prueba · Solo lectura</h2><div className="op-tabs">{(['doctor', 'patient', 'dispensary'] as PilotRole[]).map(r => <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>{titles[r]}</button>)}</div>
    <div className="op-row"><h3>{titles[role]}</h3><p>{role === 'doctor' ? 'Consulta ficticia · Paciente de prueba · Borrador pendiente'
      : role === 'patient' ? 'Tratamiento ficticio · 30 g asignados · 10 g retirados · 20 g disponibles'
      : 'Lote ficticio TEST-001 · 90 g en stock · Entrega de prueba: 10 g'}</p><p className="op-muted">Vista sintetica, sin acceso a otra cuenta ni operaciones sobre datos reales.</p></div></section>;
}
