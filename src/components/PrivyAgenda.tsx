import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Video, X } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from './privyIdentityContext';

type Slot = { slotRef: string; doctorRef: string; startsAt: string; endsAt: string; state: string; version: number; bookingRef: string | null; bookingState: string | null; conference?: {state: string | null; meetUrl?: string | null} | null };
type Command = { action: string; input: Record<string, unknown> };
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const inputStyle = 'min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm';
const iconStyle = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-300 bg-white disabled:opacity-40';
const commandStyle = 'inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40';

export default function PrivyAgenda({ email }: { email?: string }) {
  const identity = useTrustLeafPrivyIdentity();
  // Commands, notices and rows must never survive an identity transition.
  return <IdentityAgenda key={`${identity.subject ?? 'signed-out'}:${identity.authenticated}:${identity.ready}`} email={email}/>;
}

function IdentityAgenda({ email }: { email?: string }) {
  const identity = useTrustLeafPrivyIdentity();
  const [date,setDate] = useState(() => localDate(new Date()));
  const [publishDate,setPublishDate] = useState(() => localDate(new Date(Date.now()+86400000)));
  const [time,setTime] = useState('09:00');
  const [duration,setDuration] = useState(30);
  const [role,setRole] = useState<string | null>(null);
  const [slots,setSlots] = useState<Slot[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [pending,setPending] = useState<Command | null>(null);
  const [revision,setRevision] = useState(0);
  const generation = useRef(0);
  const commandLock = useRef(false);
  const commandController = useRef<AbortController | null>(null);
  useEffect(() => () => commandController.current?.abort(), []);

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
    setSlots([]); setRole(null); setError(''); setLoading(true);
    if(!identity.ready || !identity.authenticated) {
      const timeout=setTimeout(()=>{setLoading(false);setError('La sesion no esta disponible. Reintenta la consulta.');},10000);
      return ()=>{clearTimeout(timeout);controller.abort();};
    }
    const start=new Date(`${date}T00:00:00`); const end=new Date(start); end.setDate(end.getDate()+7);
    if(!Number.isFinite(start.getTime())) {setLoading(false);setError('Selecciona una fecha valida.');return;}
    void request(`/api/agenda?${new URLSearchParams({from:start.toISOString(),to:end.toISOString()})}`,undefined,controller.signal).then(data=>{
      if(current!==generation.current || controller.signal.aborted)return;
      if(!Array.isArray(data.slots) || !['doctor','patient'].includes(data.role))throw new Error('Respuesta de agenda no disponible.');
      setSlots(data.slots);setRole(data.role);
    }).catch(e=>{if(!controller.signal.aborted && current===generation.current)setError(notice ? 'El cambio esta guardado, pero no se pudo actualizar la agenda. Pulsa Actualizar agenda.' : e.message);})
      .finally(()=>{if(!controller.signal.aborted && current===generation.current)setLoading(false);});
    return ()=>controller.abort();
  },[date,revision,identity.subject,identity.ready,identity.authenticated,identity.tokenReady]);

  async function execute(command: Command) {
    if(commandLock.current)return;
    commandLock.current=true;setBusy(true);setPending(command);setError('');setNotice('');
    const controller=new AbortController();commandController.current=controller;
    try {
      await request('/api/agenda',command,controller.signal);
      if(controller.signal.aborted)return;
      setPending(null);setNotice('Cambio guardado.');
      if(command.action==='publish')setDate(localDate(new Date(String(command.input.startsAt))));
      setRevision(v=>v+1);
    }
    catch(e) {if(controller.signal.aborted)return;const failure=e as Error & {status?:number};setError(failure.message);if([400,403,409].includes(failure.status ?? 0))setPending(null);}
    finally {if(!controller.signal.aborted){commandLock.current=false;setBusy(false);}}
  }
  const mutate=(action:string,input:Record<string,unknown>)=>void execute({action,input:{...input,operationId:crypto.randomUUID()}});
  function publish(event: FormEvent) {
    event.preventDefault();const start=new Date(`${publishDate}T${time}`);
    if(!Number.isFinite(start.getTime()) || start.getTime()<=Date.now()){setError('Selecciona un horario futuro.');return;}
    mutate('publish',{slotRef:crypto.randomUUID(),startsAt:start.toISOString(),endsAt:new Date(start.getTime()+duration*60000).toISOString()});
  }
  const move=(days:number)=>{const next=new Date(`${date}T12:00:00`);next.setDate(next.getDate()+days);setDate(localDate(next));};
  const disabled=busy || loading || pending!==null;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <section className="w-full min-w-0 space-y-5 text-gray-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays size={22}/>{role==='doctor'?'Mi agenda':'Horarios y citas'}</h2>
      <button title="Actualizar agenda" aria-label="Actualizar agenda" className={iconStyle} disabled={busy||loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/></button>
    </div>
    <p className="break-words text-sm text-gray-600">{email ? `${email} · ` : ''}{zone}</p>
    <div className="flex flex-wrap items-center gap-2">
      <button title="Semana anterior" aria-label="Semana anterior" className={iconStyle} disabled={busy} onClick={()=>move(-7)}><ChevronLeft size={18}/></button>
      <label className="flex min-w-0 items-center gap-2 text-sm">Desde<input aria-label="Inicio de semana" type="date" required value={date} className={inputStyle} disabled={busy} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label>
      <button title="Semana siguiente" aria-label="Semana siguiente" className={iconStyle} disabled={busy} onClick={()=>move(7)}><ChevronRight size={18}/></button>
    </div>
    {role==='doctor' && <form onSubmit={publish} className="flex flex-wrap items-end gap-3 border-y border-gray-200 py-4">
      <label className="flex min-w-0 flex-col gap-1 text-sm">Fecha<input type="date" required min={localDate(new Date())} value={publishDate} onChange={e=>setPublishDate(e.target.value)} className={inputStyle}/></label>
      <label className="flex flex-col gap-1 text-sm">Hora<input type="time" required value={time} onChange={e=>setTime(e.target.value)} className={inputStyle}/></label>
      <label className="flex flex-col gap-1 text-sm">Duracion<select value={duration} onChange={e=>setDuration(Number(e.target.value))} className={inputStyle}>{[15,30,45,60,90,120].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
      <button disabled={disabled} className={commandStyle}><Plus size={16}/>Publicar horario</button>
    </form>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {pending && !busy && <button className={commandStyle} onClick={()=>void execute(pending)}><RefreshCw size={16}/>Reintentar cambio</button>}
    {loading ? <p role="status">Cargando agenda...</p> : !error && slots.length===0 ? <p className="text-sm text-gray-600">No hay horarios ni citas en esta semana.</p> : <ul className="divide-y divide-gray-200">
      {slots.map(slot=>{const future=Date.parse(slot.startsAt)>Date.now();const confirmed=slot.bookingState==='confirmed';
        const label=confirmed?'Cita confirmada':slot.state==='published'?'Disponible':slot.bookingState==='cancelled'||slot.state==='cancelled'?'Cancelada':'Reservada';
        return <li key={slot.slotRef} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0"><p className="text-sm font-semibold">{new Date(slot.startsAt).toLocaleString('es-CL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} – {new Date(slot.endsAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</p>
          {role==='patient' && <p title={slot.doctorRef} className="text-xs text-gray-600">Medico · {slot.doctorRef.slice(0,8)}</p>}
          <p className={`text-sm ${confirmed?'text-blue-700':'text-gray-600'}`}>{label}</p>
          {confirmed && <p className="break-all text-xs text-gray-500">Reserva {slot.bookingRef}</p>}</div>
          {confirmed && slot.conference && (slot.conference.state==='ready' && /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(slot.conference.meetUrl??'')
            ? <a className={commandStyle} href={slot.conference.meetUrl!} target="_blank" rel="noopener noreferrer"><Video size={16}/>Unirse a consulta</a>
            : <p role="status" className="text-sm text-gray-600">{['error','unavailable'].includes(slot.conference.state??'')?'Videollamada no disponible temporalmente':'Preparando videollamada'}</p>)}
          {future && role==='patient' && slot.state==='published' && <button disabled={disabled} className={commandStyle} onClick={()=>mutate('reserve',{slotRef:slot.slotRef,bookingRef:crypto.randomUUID(),version:slot.version})}>Reservar</button>}
          {future && (confirmed || role==='doctor' && slot.state==='published') && <button disabled={disabled} className={commandStyle} onClick={()=>{if(window.confirm(confirmed?'¿Cancelar esta cita?':'¿Retirar este horario?'))mutate(confirmed?'cancel-booking':'cancel-slot',{slotRef:slot.slotRef,bookingRef:slot.bookingRef,version:slot.version});}}><X size={16}/>{confirmed?'Cancelar cita':'Retirar horario'}</button>}
        </li>;})}
    </ul>}
  </section>;
}
