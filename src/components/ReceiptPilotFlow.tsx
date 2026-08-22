import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, QrCode, ShieldCheck, Stethoscope, UserRound, Store } from 'lucide-react';
import { applyReceiptPilotOperation, createReceiptPilotFixture, publicReceiptProjection, type PilotRole } from '../lib/receiptPilotDemo';
import { DEMO_PUBLIC_VERIFICATION_TOKENS } from '../lib/publicVerification';

const ROLE_COPY: Record<PilotRole, { label: string; description: string }> = {
  doctor: { label: 'Médico', description: 'Emite una constancia demo tras gates sintéticos.' },
  patient: { label: 'Paciente', description: 'Consulta estado y QR mínimo, sin detalle clínico.' },
  dispensary: { label: 'Dispensario', description: 'Opera un saldo sintético en una vista autorizada.' },
};

export default function ReceiptPilotFlow({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<PilotRole>('doctor');
  const [receipt, setReceipt] = useState(createReceiptPilotFixture);
  const publicProjection = useMemo(() => publicReceiptProjection(receipt), [receipt]);
  const run = (kind: 'issue' | 'dispense-partial') => setReceipt(current => applyReceiptPilotOperation(current, kind === 'issue'
    ? { kind, operationKey: 'issue-demo-1' }
    : { kind, units: 1, operationKey: `dispense-demo-${current.version}` }));

  return <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
    <header className="border-b border-brand-green-deep/10 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
      <button type="button" onClick={onBack} className="flex items-center gap-2 font-bold"><ArrowLeft size={18}/> Volver</button>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-900">Demo sintética · no uso clínico</span>
    </div></header>
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <section className="rounded-3xl bg-brand-green-deep p-7 text-brand-ivory"><ShieldCheck className="text-brand-gold"/><p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">Receipt no transferible · simulación local</p><h1 className="mt-2 font-serif text-4xl">Flujo médico → paciente → dispensario</h1><p className="mt-3 max-w-2xl text-sm text-brand-ivory/70">La tarjeta es una representación visual. No es un NFT desplegado, una receta válida ni evidencia de cumplimiento legal.</p></section>
      <nav aria-label="Rol demo" className="grid gap-3 sm:grid-cols-3">{(['doctor','patient','dispensary'] as PilotRole[]).map(item => <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)} className={`rounded-2xl border p-4 text-left ${role === item ? 'border-brand-green-deep bg-white shadow' : 'border-transparent bg-white/60'}`}><strong>{ROLE_COPY[item].label}</strong><span className="mt-1 block text-xs text-brand-green-mid">{ROLE_COPY[item].description}</span></button>)}</nav>
      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          {role === 'doctor' && <><Stethoscope/><h2 className="mt-3 text-2xl font-bold">Emisión demo</h2><p className="mt-2 text-sm">Profesional e identidad+consentimiento figuran verificados solo como fixtures.</p><button type="button" disabled={receipt.state !== 'draft'} onClick={() => run('issue')} className="mt-5 rounded-xl bg-brand-green-deep px-5 py-3 font-bold text-white disabled:opacity-40">Emitir constancia sintética</button></>}
          {role === 'patient' && <><UserRound/><h2 className="mt-3 text-2xl font-bold">Estado mínimo</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-brand-neutral p-4"><dt>Constancia</dt><dd className="font-bold">{publicProjection.evidenceExists ? 'Existe' : 'Aún no emitida'}</dd></div><div className="rounded-xl bg-brand-neutral p-4"><dt>Estado público</dt><dd className="font-bold capitalize">{publicProjection.status}</dd></div></dl>{receipt.state !== 'draft' && <a href={`/verify/${encodeURIComponent(DEMO_PUBLIC_VERIFICATION_TOKENS[0])}`} className="mt-5 inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-bold"><QrCode size={18}/> Abrir verificación pública demo</a>}</>}
          {role === 'dispensary' && <><Store/><h2 className="mt-3 text-2xl font-bold">Operación autorizada demo</h2><p className="mt-2 text-sm">El saldo sintético se muestra solo en esta superficie de rol y nunca en la vista pública.</p><div className="mt-4 rounded-xl bg-brand-neutral p-4"><span className="text-xs uppercase">Saldo operativo sintético</span><strong className="block text-3xl">{receipt.remainingUnits}</strong></div><button type="button" disabled={!['active','partial'].includes(receipt.state)} onClick={() => run('dispense-partial')} className="mt-5 rounded-xl bg-brand-green-deep px-5 py-3 font-bold text-white disabled:opacity-40">Registrar parcial demo</button></>}
        </section>
        <aside className="rounded-3xl border border-brand-green-deep/10 bg-white p-6"><CheckCircle/><h2 className="mt-3 text-xl font-bold">Timeline versionado</h2><p className="mt-2 text-xs text-brand-green-mid">Handle opaco: {receipt.receiptHandle.slice(0, 16)}…</p><ol className="mt-5 space-y-3">{receipt.timeline.length === 0 ? <li className="text-sm text-brand-green-mid">Sin eventos emitidos.</li> : receipt.timeline.map(event => <li key={event.version} className="rounded-xl bg-brand-neutral p-3 text-sm"><strong>v{event.version}</strong> · {event.state}</li>)}</ol></aside>
      </div>
    </main>
  </div>;
}
