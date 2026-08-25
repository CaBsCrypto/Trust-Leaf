import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Ban, CheckCircle2, Clock3, FileKey2, Link2, ShieldCheck, Stethoscope, Store, UserRound } from 'lucide-react';
import {
  TRUST_CHAIN_SCENARIOS,
  parseTrustChainScenario,
  trustChainSearch,
  type TrustChainScenario,
  type TrustCredentialFixture,
} from '../lib/trustRegistryReview';

const SCENARIO_LABELS: Record<TrustChainScenario, string> = {
  active: 'Cadena activa (compatibilidad)',
  'doctor-validated': 'Médico · validado',
  'doctor-suspended': 'Médico · suspendido',
  'dispensary-validated': 'Dispensario · validado',
  'dispensary-expired': 'Dispensario · expirado',
  'patient-eligible': 'Paciente · elegibilidad activa',
  'eligibility-revoked': 'Paciente · elegibilidad revocada',
  'receipt-issued': 'Receipt · emitido',
  'receipt-active': 'Receipt · activo',
  'receipt-partial': 'Receipt · parcial',
  'receipt-dispensed': 'Receipt · dispensado',
  'receipt-revoked': 'Receipt · revocado',
  'admin-audit': 'Admin · auditoría técnica',
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
      <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg font-bold"><ArrowLeft size={18}/> Volver</button>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-900">Fixture local · sin deploy</span>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <section className="rounded-3xl bg-brand-green-deep p-7 text-brand-ivory">
        <ShieldCheck className="text-brand-gold"/>
        <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">TrustRegistry + ReceiptLedgerV2</p>
        <h1 className="mt-2 font-serif text-4xl">Gate visual por rol y estado</h1>
        <p className="mt-3 max-w-3xl text-sm text-brand-ivory/75">Escenarios sintéticos, read-only y sin conexión a Stellar. Muestran referencias opacas, estado mínimo y auditoría técnica; no contienen identidad, ficha, diagnóstico, receta, dosis, cantidad, dirección ni declaración de validez.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-green-mid">Escenario allowlisted</p><p className="mt-1 text-sm">Cambiar el selector sólo cambia fixtures locales; no firma ni ejecuta operaciones.</p></div>
        <label className="flex min-w-72 flex-col gap-2 text-xs font-bold">Escenario visible
          <select aria-label="Escenario visible" value={scenario} onChange={event => setScenario(event.target.value as TrustChainScenario)} className="rounded-xl border border-brand-green-deep/20 bg-white px-3 py-2 text-sm">
            {(Object.keys(SCENARIO_LABELS) as TrustChainScenario[]).map(item => <option key={item} value={item}>{SCENARIO_LABELS[item]}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen del paso">
        <div className="rounded-2xl bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid">Rol</p><p className="mt-2 font-bold capitalize">{fixture.actorRole} técnico</p></div>
        <div className="rounded-2xl bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid">Paso visible</p><p className="mt-2 font-bold">{fixture.stepLabel}</p></div>
        <div className="rounded-2xl bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-brand-green-mid">Resultado mínimo</p><p className="mt-2 font-bold">{fixture.outcomeLabel}</p></div>
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
          <div className="flex gap-3">{fixture.chainAllowed ? <CheckCircle2 className="text-emerald-700"/> : <Ban className="text-rose-700"/>}<div><p className="text-xs font-bold uppercase tracking-[.18em]">ReceiptLedgerV2 · evaluación local</p><h2 className="mt-1 text-2xl font-bold">{fixture.outcomeLabel}</h2></div></div>
          <dl className="grid grid-cols-2 gap-3 text-xs"><div><dt>Receipt opaco</dt><dd className="font-mono font-bold">{fixture.receiptRef}</dd></div><div><dt>Estado / versión</dt><dd className="font-bold">{fixture.receiptState} · v{fixture.receiptVersion}</dd></div></dl>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl bg-white p-6" aria-labelledby="audit-title">
          <Activity/><h2 id="audit-title" className="mt-3 text-xl font-bold">Auditoría técnica mínima</h2>
          <ol className="mt-4 space-y-2">{fixture.audit.map(event => <li key={event.eventRef} className="grid gap-2 rounded-xl bg-brand-neutral p-3 text-xs sm:grid-cols-4"><span className="font-mono font-bold">{event.eventRef}</span><span>{event.actorRole}</span><span>{event.action}</span><span className="font-bold">{event.result} · v{event.version}</span></li>)}</ol>
        </section>
        <aside id="testnet-evidence-gate" className="rounded-3xl border border-amber-300 bg-amber-50 p-6" aria-labelledby="evidence-title">
          <Link2/><p className="mt-3 text-xs font-bold uppercase tracking-[.18em] text-amber-900">Evidencia Testnet V2 · pendiente</p><h2 id="evidence-title" className="mt-2 text-xl font-bold">Cotejo post-deploy bloqueado</h2>
          <dl className="mt-4 space-y-3 text-xs"><div><dt>Red esperada</dt><dd className="font-bold">Stellar Testnet</dd></div><div><dt>Evento esperado</dt><dd className="font-mono font-bold">{fixture.expectedEvent}</dd></div><div><dt>Contract / transacción</dt><dd className="font-bold">No configurados; validar contra manifest aprobado.</dd></div></dl>
          <p className="mt-4 text-xs text-amber-950">No se muestra un enlace hasta que contract ID, hash WASM y evidencia read-only estén allowlisted. Esta ausencia es un gate, no una prueba on-chain.</p>
        </aside>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5"><FileKey2/><h2 className="mt-3 font-bold">Fixtures, no identidad</h2><p className="mt-2 text-xs text-brand-green-mid">Referencias truncadas y roles técnicos; la correlación permanece fuera de esta vista.</p></div>
        <div className="rounded-2xl bg-white p-5"><Clock3/><h2 className="mt-3 font-bold">Expiry + versión</h2><p className="mt-2 text-xs text-brand-green-mid">Cada escenario expone el estado y la versión esperada para cotejo posterior.</p></div>
        <div className="rounded-2xl bg-white p-5"><ShieldCheck/><h2 className="mt-3 font-bold">Sin mutaciones</h2><p className="mt-2 text-xs text-brand-green-mid">No hay RPC, firma, envío, autenticación real ni lectura de secretos en esta superficie.</p></div>
      </section>
    </main>
  </div>;
}
