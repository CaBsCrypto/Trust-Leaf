import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Video, X } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from './privyIdentityContext';
import './privy-agenda.css';

type Slot = { slotRef: string; doctorRef: string; startsAt: string; endsAt: string; state: string; version: number; bookingRef: string | null; bookingState: string | null; conference?: {state: string | null; meetUrl?: string | null} | null };
type Command = { action: string; input: Record<string, unknown> };
type HistoricalBooking = Pick<Slot, 'slotRef' | 'bookingRef' | 'doctorRef' | 'startsAt' | 'endsAt' | 'bookingState'>;
export type AgendaTarget = { bookingRef: string; startsAt: string };
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const inputStyle = 'tl-agenda-input';
const iconStyle = 'tl-agenda-action tl-agenda-icon';
const commandStyle = 'tl-agenda-action';

export default function PrivyAgenda({ email, target }: { email?: string; target?: AgendaTarget }) {
  const identity = useTrustLeafPrivyIdentity();
  // Commands, notices and rows must never survive an identity transition.
  return <IdentityAgenda key={`${identity.subject ?? 'signed-out'}:${identity.authenticated}:${identity.ready}:${target?.bookingRef ?? ''}`} email={email} target={target}/>;
}

function IdentityAgenda({ email, target }: { email?: string; target?: AgendaTarget }) {
  const identity = useTrustLeafPrivyIdentity();
  const [date,setDate] = useState(() => localDate(target && Number.isFinite(Date.parse(target.startsAt)) ? new Date(target.startsAt) : new Date()));
  const [selectedBooking,setSelectedBooking] = useState(target?.bookingRef);
  const selectedRow = useRef<HTMLLIElement | null>(null);
  const historicalRow = useRef<HTMLDivElement | null>(null);
  const [historicalBooking,setHistoricalBooking] = useState<HistoricalBooking | null>(null);
  const scrolled = useRef(false);
  const [publishDate,setPublishDate] = useState(() => localDate(new Date(Date.now()+86400000)));
  const [time,setTime] = useState('09:00');
  const [duration,setDuration] = useState(30);
  const [role,setRole] = useState<string | null>(null);
  const [slots,setSlots] = useState<Slot[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [readError,setReadError] = useState('');
  const [notice,setNotice] = useState('');
  const [pending,setPending] = useState<Command | null>(null);
  const [revision,setRevision] = useState(0);
  const generation = useRef(0);
  const commandLock = useRef(false);
  const commandController = useRef<AbortController | null>(null);
  useEffect(() => () => commandController.current?.abort(), []);
  useEffect(() => {
    const row = selectedRow.current ?? historicalRow.current;
    if (!loading && !readError && row && !scrolled.current) {
      row.scrollIntoView({ block: 'center' });
      scrolled.current = true;
    }
  }, [loading, readError, slots, historicalBooking]);

  async function request(path: string, command?: Command, signal?: AbortSignal) {
    let token = await identity.getIdentityToken();
    signal?.throwIfAborted();
    if (!token && !command) token = await identity.refreshIdentityToken?.() ?? null;
    signal?.throwIfAborted();
    if (!token) throw Object.assign(new Error('Inicia sesion nuevamente para consultar tu agenda.'),{status:401});
    const send = () => fetch(path,{method:command ? 'POST':'GET',cache:'no-store',signal,headers:{'privy-id-token':token!,...(command ? {'content-type':'application/json'}:{})},...(command ? {body:JSON.stringify(command)}:{})});
    let response=await send();
    if (response.status===401 && !command && identity.refreshIdentityToken) { token=await identity.refreshIdentityToken(); signal?.throwIfAborted(); if(token) response=await send(); }
    if(!response.ok) throw Object.assign(new Error(response.status===403 ? 'Esta cuenta no tiene acceso a la agenda.' : response.status===409 ? 'El horario cambio o se superpone con otra cita. Actualiza la agenda.' : response.status===400 ? 'Revisa la fecha y el horario. No se guardo el cambio.' : 'No fue posible confirmar la operacion. Puedes consultar la agenda o reintentar.'),{status:response.status});
    return response.json();
  }

  useEffect(() => {
    const current=++generation.current;
    const controller=new AbortController();
    setSlots([]); setHistoricalBooking(null); setRole(null); setReadError(''); setLoading(true);
    if(!identity.ready || !identity.authenticated) {
      const timeout=setTimeout(()=>{setLoading(false);setReadError('La sesion no esta disponible. Reintenta la consulta.');},10000);
      return ()=>{clearTimeout(timeout);controller.abort();};
    }
    const start=new Date(`${date}T00:00:00`); const end=new Date(start); end.setDate(end.getDate()+7);
    if(!Number.isFinite(start.getTime())) {setLoading(false);setReadError('Selecciona una fecha valida.');return;}
    let reading = false;
    async function refresh() {
      if (reading || controller.signal.aborted) return;
      reading = true;
      try {
        const data = await request(`/api/agenda?${new URLSearchParams({from:start.toISOString(),to:end.toISOString(),...(selectedBooking ? {selectedBookingRef:selectedBooking} : {})})}`, undefined, controller.signal);
        if (controller.signal.aborted || current !== generation.current) return;
        if (!Array.isArray(data.slots) || !['doctor','patient'].includes(data.role)) throw new Error('Respuesta de agenda no disponible.');
        setSlots(data.slots); setHistoricalBooking(data.selectedBooking ?? null); setRole(data.role); setReadError('');
      } catch (e) {
        if (controller.signal.aborted || current !== generation.current) return;
        const failure = e as Error & { status?: number };
        if ([401,403].includes(failure.status ?? 0)) { setSlots([]); setHistoricalBooking(null); setRole(null); }
        setReadError(failure.message);
      } finally {
        reading = false;
        if (!controller.signal.aborted && current === generation.current) setLoading(false);
      }
    }
    void refresh();
    const resume = () => { if (document.visibilityState === 'visible' && !commandLock.current) void refresh(); };
    const timer = setInterval(resume, 15000);
    window.addEventListener('focus', resume); window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(timer); controller.abort(); window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  },[date,revision,selectedBooking,identity.subject,identity.ready,identity.authenticated,identity.tokenReady]);

  async function execute(command: Command) {
    if(commandLock.current)return;
    commandLock.current=true;setBusy(true);setPending(command);setError('');setReadError('');setNotice('');generation.current++;
    const controller=new AbortController();commandController.current=controller;
    try {
      await request('/api/agenda',command,controller.signal);
      if(controller.signal.aborted)return;
      setPending(null);setNotice('Cambio guardado.');
      if(command.action==='publish')setDate(localDate(new Date(String(command.input.startsAt))));
    }
    catch(e) {if(controller.signal.aborted)return;const failure=e as Error & {status?:number};setError(failure.message);
      if([401,403].includes(failure.status ?? 0)){setSlots([]);setRole(null);}
      if([400,401,403,409].includes(failure.status ?? 0))setPending(null);}
    finally {if(!controller.signal.aborted){commandLock.current=false;setBusy(false);setRevision(v=>v+1);}}
  }
  const mutate=(action:string,input:Record<string,unknown>)=>void execute({action,input:{...input,operationId:crypto.randomUUID()}});
  function publish(event: FormEvent) {
    event.preventDefault();const start=new Date(`${publishDate}T${time}`);
    if(!Number.isFinite(start.getTime()) || start.getTime()<=Date.now()){setError('Selecciona un horario futuro.');return;}
    mutate('publish',{slotRef:crypto.randomUUID(),startsAt:start.toISOString(),endsAt:new Date(start.getTime()+duration*60000).toISOString()});
  }
  const move=(days:number)=>{const next=new Date(`${date}T12:00:00`);next.setDate(next.getDate()+days);setSelectedBooking(undefined);setDate(localDate(next));};
  const disabled=busy || loading || pending!==null;
  const visibleError = readError || error;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <section className="tl-agenda" aria-label="Agenda">
    <div className="tl-agenda-header">
      <div>
        <h2><CalendarDays size={22} aria-hidden="true"/>{role==='doctor'?'Mi agenda':'Horarios y citas'}</h2>
        <p className="tl-agenda-meta">{email ? `${email} · ` : ''}{zone}</p>
      </div>
      <button title="Actualizar agenda" aria-label="Actualizar agenda" className={iconStyle} disabled={busy||loading} onClick={()=>{setError('');setRevision(v=>v+1);}}><RefreshCw size={18} aria-hidden="true"/></button>
    </div>
    <div className="tl-agenda-week" role="group" aria-label="Semana de la agenda">
      <button title="Semana anterior" aria-label="Semana anterior" className={iconStyle} disabled={busy} onClick={()=>move(-7)}><ChevronLeft size={18} aria-hidden="true"/></button>
      <label>Desde<input aria-label="Inicio de semana" type="date" required value={date} className={inputStyle} disabled={busy} onChange={e=>{if(e.target.value){setSelectedBooking(undefined);setDate(e.target.value);}}}/></label>
      <button title="Semana siguiente" aria-label="Semana siguiente" className={iconStyle} disabled={busy} onClick={()=>move(7)}><ChevronRight size={18} aria-hidden="true"/></button>
    </div>
    {role==='doctor' && <form onSubmit={publish} className="tl-agenda-publish">
      <h3>Publicar disponibilidad</h3>
      <div className="tl-agenda-fields">
        <label>Fecha<input type="date" required min={localDate(new Date())} value={publishDate} onChange={e=>setPublishDate(e.target.value)} className={inputStyle}/></label>
        <label>Hora<input type="time" required value={time} onChange={e=>setTime(e.target.value)} className={inputStyle}/></label>
        <label>Duracion<select value={duration} onChange={e=>setDuration(Number(e.target.value))} className={inputStyle}>{[15,30,45,60,90,120].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
        <button type="submit" disabled={disabled} className={`${commandStyle} tl-agenda-primary`}><Plus size={16} aria-hidden="true"/>Publicar horario</button>
      </div>
    </form>}
    {notice && <p role="status" className="tl-agenda-feedback">{notice}</p>}
    {visibleError && <p role="alert" className="tl-agenda-feedback tl-agenda-error">{notice && readError ? 'El cambio esta guardado, pero no se pudo actualizar la agenda. ' : ''}{visibleError}</p>}
    {!loading && !visibleError && selectedBooking && !slots.some(slot => slot.bookingRef === selectedBooking) && (historicalBooking?.bookingRef === selectedBooking
      ? <div ref={historicalRow} aria-current="true" className={`border-l-4 p-3 ${historicalBooking.bookingState === 'cancelled' ? 'border-red-700 bg-red-50' : 'border-green-700 bg-green-50'}`}><p className={`font-semibold ${historicalBooking.bookingState === 'cancelled' ? 'text-red-800' : 'text-green-800'}`}>Reserva seleccionada · {historicalBooking.bookingState === 'cancelled' ? 'Cancelada' : 'Confirmada'}</p><p>{new Date(historicalBooking.startsAt).toLocaleString('es-CL')}</p><p className="break-all text-xs">Reserva {historicalBooking.bookingRef}</p></div>
      : <div role="status" className="tl-agenda-feedback tl-agenda-retry"><p>No se encontro la reserva seleccionada. Actualiza la agenda para comprobar su estado.</p><button className={commandStyle} disabled={busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16} aria-hidden="true"/>Actualizar reserva</button></div>)}
    {pending && !busy && <button className={commandStyle} onClick={()=>void execute(pending)}><RefreshCw size={16} aria-hidden="true"/>Reintentar cambio</button>}
    {loading ? <p role="status" className="tl-agenda-feedback">Cargando agenda...</p> : !visibleError && slots.length===0 ? <p className="tl-agenda-feedback">No hay horarios ni citas en esta semana.</p> : <ul className="tl-agenda-slots">
      {slots.map(slot=>{const future=Date.parse(slot.startsAt)>Date.now();const confirmed=slot.bookingState==='confirmed';
        const label=confirmed?'Cita confirmada':slot.state==='published'?'Disponible':slot.bookingState==='cancelled'||slot.state==='cancelled'?'Cancelada':'Reservada';
        const selected = slot.bookingRef === selectedBooking && !!selectedBooking;
        const cancelled = slot.bookingState === 'cancelled';
        return <li key={slot.slotRef} ref={selected ? selectedRow : undefined} aria-current={selected ? 'true' : undefined} className={`tl-agenda-slot${selected ? cancelled ? ' tl-agenda-selected-cancelled' : ' tl-agenda-selected' : ''}`}>
          {selected && <p className={`w-full text-sm font-semibold ${cancelled ? 'text-red-800' : 'text-green-800'}`}>Reserva seleccionada{cancelled ? ' · Cancelada' : ''}</p>}
          <div className="tl-agenda-slot-details"><p className="text-sm font-semibold">{new Date(slot.startsAt).toLocaleString('es-CL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} – {new Date(slot.endsAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</p>
          {role==='patient' && <p title={slot.doctorRef} className="text-xs text-gray-600">Medico · {slot.doctorRef.slice(0,8)}</p>}
          <p className={`tl-agenda-state${confirmed ? ' tl-agenda-state-confirmed' : label === 'Cancelada' ? ' tl-agenda-state-cancelled' : ''}`}>{label}</p>
          {confirmed && <p className="break-all text-xs text-gray-500">Reserva {slot.bookingRef}</p>}</div>
          {confirmed && slot.conference && (slot.conference.state==='ready' && /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(slot.conference.meetUrl??'')
            ? <a className={commandStyle} href={slot.conference.meetUrl!} target="_blank" rel="noopener noreferrer"><Video size={16} aria-hidden="true"/>Unirse a consulta</a>
            : <p role="status" className="text-sm text-gray-600">{['error','unavailable'].includes(slot.conference.state??'')?'Videollamada no disponible temporalmente':'Preparando videollamada'}</p>)}
          {future && !(selected && slot.bookingState==='cancelled') && role==='patient' && slot.state==='published' && <button disabled={disabled} className={`${commandStyle} tl-agenda-primary`} onClick={()=>mutate('reserve',{slotRef:slot.slotRef,bookingRef:crypto.randomUUID(),version:slot.version})}>Reservar</button>}
          {future && !(selected && slot.bookingState==='cancelled') && (confirmed || role==='doctor' && slot.state==='published') && <button disabled={disabled} className={`${commandStyle} tl-agenda-cancel`} onClick={()=>{if(window.confirm(confirmed?'¿Cancelar esta cita?':'¿Retirar este horario?'))mutate(confirmed?'cancel-booking':'cancel-slot',{slotRef:slot.slotRef,bookingRef:slot.bookingRef,version:slot.version});}}><X size={16} aria-hidden="true"/>{confirmed?'Cancelar cita':'Retirar horario'}</button>}
        </li>;})}
    </ul>}
  </section>;
}
