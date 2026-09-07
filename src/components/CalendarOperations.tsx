import { useEffect, useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from './privyIdentityContext';

type Job={booking_ref:string;state:string;attempts:number;starts_at:string;error_code:string|null};
export default function CalendarOperations() {
  const identity=useTrustLeafPrivyIdentity();
  const [jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setJobs([]);
    void identity.getIdentityToken().then(async token=>{
      if(!token)throw new Error();
      const response=await fetch('/api/google-calendar/jobs',{headers:{'privy-id-token':token},cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error();
      const data=await response.json();
      if(!Array.isArray(data.jobs))throw new Error();
      if(!controller.signal.aborted){setJobs(data.jobs);setError('');}
    }).catch(()=>{if(!controller.signal.aborted)setError('No se pudieron cargar las videollamadas.');});
    return ()=>controller.abort();
  },[identity.subject,revision]);
  async function command(action:'setup'|'process') {
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try {
      const token=await identity.getIdentityToken();
      if(!token)throw new Error();
      const response=await fetch(`/api/google-calendar/${action}`,{method:'POST',headers:{'privy-id-token':token}});
      const data=await response.json();
      if(!response.ok) {
        const code=typeof data.code==='string' && /^CALENDAR_[A-Z_]{1,60}$/.test(data.code)?data.code:'CALENDAR_OPERATION_FAILED';
        setError(`No fue posible completar la operacion (${code}).`);
        return;
      }
      setNotice(action==='setup'?'Calendario preparado.':data.processed?'Intento procesado.':'No hay tareas listas para procesar.');
      setRevision(v=>v+1);
    }catch{setError('No fue posible completar la operacion.');}finally{setBusy(false);}
  }
  return <section className="w-full min-w-0 space-y-3 border-b border-gray-200 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Videollamadas</h2>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={()=>void command('setup')} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><Settings size={16}/>Preparar calendario</button>
        <button disabled={busy} onClick={()=>void command('process')} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><RefreshCw size={16}/>Procesar siguiente</button>
        <button title="Actualizar videollamadas" aria-label="Actualizar videollamadas" onClick={()=>setRevision(v=>v+1)} className="rounded border p-2"><RefreshCw size={18}/></button>
      </div></div>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
    {!error&&jobs.length===0&&<p className="text-sm text-gray-600">Sin videollamadas registradas.</p>}
    <ul className="divide-y">{jobs.map(job=><li key={job.booking_ref} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
      <span>{new Date(job.starts_at).toLocaleString('es-CL')}</span><span>{({pending:'Pendiente',working:'Sincronizando',ready:'Lista',cancelled:'Cancelada',error:'Error de sincronizacion'} as Record<string,string>)[job.state]??job.state}</span>
      <span>Intentos: {job.attempts}</span>
    </li>)}</ul>
  </section>;
}
