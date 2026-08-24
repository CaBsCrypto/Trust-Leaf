import { useMemo, useState } from 'react';
import { Activity, QrCode, ShieldCheck } from 'lucide-react';
import { projectReadonlyReceiptForRole, SYNTHETIC_READONLY_RECEIPT, type ReadonlyRole } from '../lib/readonlyRoleReceipt';

const LABELS: Record<ReadonlyRole, string> = { doctor: 'Médico', patient: 'Paciente', dispensary: 'Dispensario', admin: 'Admin' };

/** Fixture-only role surface. It intentionally has no mutation callback. */
export function ReadonlyRoleReceiptPanel({ onVerify }: { onVerify: (token: string) => void }) {
  const [role, setRole] = useState<ReadonlyRole>('doctor');
  const view = useMemo(() => projectReadonlyReceiptForRole(role, SYNTHETIC_READONLY_RECEIPT), [role]);
  return <section className="rounded-3xl border border-brand-green-deep/10 bg-white p-6 shadow-sm" aria-labelledby="readonly-role-title">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-green-mid">Fixture indexado · read-only</p><h2 id="readonly-role-title" className="mt-2 text-2xl font-bold">Lectura técnica por rol</h2></div>
      <ShieldCheck aria-hidden="true" />
    </div>
    <nav aria-label="Rol de lectura" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(LABELS) as ReadonlyRole[]).map(item => <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)} className="rounded-xl border px-3 py-2 text-sm font-bold">{LABELS[item]}</button>)}</nav>
    <dl className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-brand-neutral p-3"><dt className="text-xs">Estado</dt><dd className="font-bold capitalize">{view.status}</dd></div>
      <div className="rounded-xl bg-brand-neutral p-3"><dt className="text-xs">Finalidad</dt><dd className="font-bold capitalize">{view.finality}</dd></div>
      <div className="rounded-xl bg-brand-neutral p-3"><dt className="text-xs">Operaciones</dt><dd className="font-bold">Bloqueadas</dd></div>
    </dl>
    <p className="mt-4 text-xs text-brand-green-mid">Referencia opaca: {view.receiptRef}</p>
    {view.timeline && <ol className="mt-4 flex flex-wrap gap-2" aria-label="Timeline técnico">{view.timeline.map(event => <li key={event.version} className="rounded-full border px-3 py-1 text-xs"><Activity className="mr-1 inline" size={12}/>v{event.version} · {event.state}</li>)}</ol>}
    {view.publicToken && <button type="button" onClick={() => onVerify(view.publicToken!)} className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><QrCode size={16}/> Ver constancia mínima</button>}
    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Lectura sintética sin identidad ni datos clínicos. No acredita validez clínica o legal.</p>
  </section>;
}
