import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, Clock3, FileKey2, ShieldCheck, Stethoscope, Store, UserRound } from 'lucide-react';
import {
  TRUST_CHAIN_SCENARIOS,
  parseTrustChainScenario,
  trustChainSearch,
  type TrustChainScenario,
  type TrustCredentialFixture,
} from '../lib/trustRegistryReview';

const SCENARIO_LABELS: Record<TrustChainScenario, string> = {
  active: 'Cadena activa',
  'doctor-suspended': 'Médico suspendido',
  'eligibility-revoked': 'Elegibilidad revocada',
  'dispensary-expired': 'Dispensario vencido',
};

const CREDENTIAL_COPY: Record<TrustCredentialFixture['kind'], { label: string; icon: typeof Stethoscope }> = {
  doctor: { label: 'Credencial técnica de médico', icon: Stethoscope },
  'patient-eligibility': { label: 'Elegibilidad operativa opaca', icon: UserRound },
  dispensary: { label: 'Credencial técnica de dispensario', icon: Store },
};

export default function TrustAuthorizationReview({ onBack }: { onBack: () => void }) {
  const initial = useMemo(() => parseTrustChainScenario(window.location.search), []);
  const [scenario, setScenario] = useState<TrustChainScenario>(initial);
  const fixture = TRUST_CHAIN_SCENARIOS[scenario];

  useEffect(() => {
    window.history.replaceState({}, '', `/demo/trust-registry${trustChainSearch(scenario)}`);
  }, [scenario]);

  return <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
    <header className="border-b border-brand-green-deep/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
      <button type="button" onClick={onBack} className="flex items-center gap-2 font-bold"><ArrowLeft size={18}/> Volver</button>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-900">IDL local · sin deploy</span>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <section className="rounded-3xl bg-brand-green-deep p-7 text-brand-ivory">
        <ShieldCheck className="text-brand-gold"/>
        <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">TrustRegistry + ReceiptLedgerV2</p>
        <h1 className="mt-2 font-serif text-4xl">Cadena de autorización revocable</h1>
        <p className="mt-3 max-w-3xl text-sm text-brand-ivory/75">Vista estrictamente sintética y read-only. Presenta referencias opacas, estados técnicos y versiones; no contiene identidad de paciente, ficha, diagnóstico, receta, dosis, cantidad, dirección ni declaración de validez.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-green-mid">Escenario allowlisted</p><p className="mt-1 text-sm">Cada negativa bloquea el ledger sin ejecutar una operación.</p></div>
        <label className="flex min-w-64 flex-col gap-2 text-xs font-bold">Escenario visible
          <select aria-label="Escenario visible" value={scenario} onChange={event => setScenario(event.target.value as TrustChainScenario)} className="rounded-xl border border-brand-green-deep/20 bg-white px-3 py-2 text-sm">
            {(Object.keys(SCENARIO_LABELS) as TrustChainScenario[]).map(item => <option key={item} value={item}>{SCENARIO_LABELS[item]}</option>)}
          </select>
        </label>
      </section>

      <ol className="grid gap-4 lg:grid-cols-3" aria-label="Cadena de credenciales">
        {fixture.credentials.map((credential, index) => {
          const Icon = CREDENTIAL_COPY[credential.kind].icon;
          const active = credential.state === 'active';
          return <li key={credential.kind} className="relative rounded-3xl border border-brand-green-deep/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between"><Icon/><span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>{credential.state}</span></div>
            <h2 className="mt-4 text-lg font-bold">{CREDENTIAL_COPY[credential.kind].label}</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div><dt className="text-brand-green-mid">Referencia opaca</dt><dd className="mt-1 font-mono font-bold">{credential.credentialRef}</dd></div>
              <div><dt className="text-brand-green-mid">Autoridad técnica</dt><dd className="mt-1 font-mono">{credential.authorityRef}</dd></div>
              <div className="flex justify-between gap-4"><div><dt className="text-brand-green-mid">Versión</dt><dd className="font-bold">v{credential.version}</dd></div><div className="text-right"><dt className="text-brand-green-mid">Expiry</dt><dd className="font-bold">{credential.expiry}</dd></div></div>
            </dl>
            {index < fixture.credentials.length - 1 && <span aria-hidden="true" className="absolute -bottom-3 left-1/2 z-10 rounded-full bg-brand-gold px-2 py-1 text-[10px] font-bold lg:-right-3 lg:bottom-auto lg:left-auto lg:top-1/2">requiere</span>}
          </li>;
        })}
      </ol>

      <section className={`rounded-3xl border p-6 ${fixture.chainAllowed ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`} aria-live="polite">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">{fixture.chainAllowed ? <CheckCircle2 className="text-emerald-700"/> : <Ban className="text-rose-700"/>}<div><p className="text-xs font-bold uppercase tracking-[.18em]">ReceiptLedgerV2 · evaluación local</p><h2 className="mt-1 text-2xl font-bold">{fixture.chainAllowed ? 'Referencias activas y no vencidas' : 'Acción bloqueada fail-closed'}</h2></div></div>
          <dl className="grid grid-cols-2 gap-3 text-xs"><div><dt>Receipt opaco</dt><dd className="font-mono font-bold">{fixture.receiptRef}</dd></div><div><dt>Estado / versión</dt><dd className="font-bold">{fixture.receiptState} · v{fixture.receiptVersion}</dd></div></dl>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5"><FileKey2/><h2 className="mt-3 font-bold">Un registro, no uno por rol</h2><p className="mt-2 text-xs text-brand-green-mid">Admin gestiona médico/dispensario; el médico gestiona elegibilidad. Los permisos se distinguen por tipo y firma.</p></div>
        <div className="rounded-2xl bg-white p-5"><Clock3/><h2 className="mt-3 font-bold">Expiry + CAS</h2><p className="mt-2 text-xs text-brand-green-mid">Cada cambio usa versión esperada e idempotencia. Un expiry vencido bloquea aun si todavía no se materializó el evento.</p></div>
        <div className="rounded-2xl bg-white p-5"><ShieldCheck/><h2 className="mt-3 font-bold">Sin paciente en cadena</h2><p className="mt-2 text-xs text-brand-green-mid">La correlación persona↔credencial permanece off-chain cifrada. Stellar sólo recibe referencias aleatorias y eventos técnicos.</p></div>
      </section>
    </main>
  </div>;
}
