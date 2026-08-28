import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ExternalLink, QrCode, ShieldCheck, Stethoscope, UserRound, Store, Wrench } from 'lucide-react';
import { resetPublicVerificationDemoState } from '../lib/publicVerification';
import { projectReadonlyReceiptForRole, type ReadonlyRole } from '../lib/readonlyRoleReceipt';
import {
  DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID,
  REVIEW_SCENARIOS,
  STELLAR_EXPERT_CONTRACT_URL,
  TESTNET_EVIDENCE_LINKS,
  parseReviewSelection,
  reviewSearch,
  type ReviewScenario,
} from '../lib/testnetReviewEvidence';
import { TechnicalAdminOversightPanel } from './TechnicalAdminOversightPanel';

const ROLE_COPY: Record<ReadonlyRole, { label: string; description: string; icon: typeof Stethoscope }> = {
  doctor: { label: 'Médico técnico', description: 'Revisa emisión y activación ya registradas.', icon: Stethoscope },
  patient: { label: 'Paciente sintético', description: 'Consulta estado y QR público mínimo.', icon: UserRound },
  dispensary: { label: 'Dispensario técnico', description: 'Revisa parcial y cierre sin operar el ledger.', icon: Store },
  admin: { label: 'Admin técnico', description: 'Inspecciona trazabilidad y gates bloqueados.', icon: Wrench },
};
const SCENARIO_COPY: Record<ReviewScenario, string> = { active: 'Activa', partial: 'Parcial', dispensed: 'Dispensada', revoked: 'Revocada', expired: 'Expirada', unknown: 'Fuente no disponible' };
export default function ReceiptPilotFlow({ onBack, onVerify }: { onBack: () => void; onVerify: (token: string) => void }) {
  const initial = useMemo(() => parseReviewSelection(window.location.search), []);
  const [role, setRole] = useState<ReadonlyRole>(initial.role);
  const [scenario, setScenario] = useState<ReviewScenario>(initial.scenario);
  const fixture = REVIEW_SCENARIOS[scenario];
  const view = useMemo(() => projectReadonlyReceiptForRole(role, fixture), [fixture, role]);
  useEffect(() => { resetPublicVerificationDemoState(); }, []);
  useEffect(() => { window.history.replaceState({}, '', `/demo/receipt-pilot${reviewSearch(role, scenario)}`); }, [role, scenario]);
  const visibleStates = new Set(fixture.timeline.map(event => event.state));
  const evidence = TESTNET_EVIDENCE_LINKS.filter(item => visibleStates.has(item.state));
  const RoleIcon = ROLE_COPY[role].icon;

  return <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
    <header className="border-b border-brand-green-deep/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
      <button type="button" onClick={onBack} className="flex items-center gap-2 font-bold"><ArrowLeft size={18}/> Volver</button>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-900">Revisión local · sin submissions</span>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <section className="rounded-3xl bg-brand-green-deep p-7 text-brand-ivory">
        <ShieldCheck className="text-brand-gold"/><p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-brand-gold">Receipt Testnet desplegado · evidencia histórica read-only</p>
        <h1 className="mt-2 font-serif text-4xl">Revisión humana por rol</h1>
        <p className="mt-3 max-w-3xl text-sm text-brand-ivory/75">La interfaz usa fixtures sintéticos para representar el recorrido. Los enlaces externos apuntan al contrato y transacciones ya confirmadas en Stellar Testnet; esta sesión no firma, invoca ni envía operaciones.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3"><a href={STELLAR_EXPERT_CONTRACT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold text-brand-green-deep">Abrir contrato en Stellar Expert <ExternalLink size={16}/></a><code className="max-w-full overflow-hidden text-ellipsis rounded-xl bg-white/10 px-3 py-2 text-xs" title={DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID}>{DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID}</code></div>
      </section>

      <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto]">
        <nav aria-label="Rol de revisión" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(ROLE_COPY) as ReadonlyRole[]).map(item => { const Icon = ROLE_COPY[item].icon; return <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)} className={`rounded-2xl border p-4 text-left ${role === item ? 'border-brand-green-deep bg-brand-neutral shadow-sm' : 'border-brand-green-deep/10'}`}><Icon size={18}/><strong className="mt-2 block">{ROLE_COPY[item].label}</strong><span className="mt-1 block text-xs text-brand-green-mid">{ROLE_COPY[item].description}</span></button>; })}</nav>
        <label className="flex min-w-48 flex-col justify-center gap-2 text-xs font-bold">Escenario visible<select value={scenario} onChange={event => setScenario(event.target.value as ReviewScenario)} className="rounded-xl border border-brand-green-deep/20 bg-white px-3 py-2 text-sm">{(Object.keys(SCENARIO_COPY) as ReviewScenario[]).map(item => <option key={item} value={item}>{SCENARIO_COPY[item]}</option>)}</select></label>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm" aria-labelledby="role-review-title">
          <RoleIcon/><p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-brand-green-mid">{ROLE_COPY[role].label}</p><h2 id="role-review-title" className="mt-2 text-2xl font-bold">{ROLE_COPY[role].description}</h2>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-brand-neutral p-4"><dt className="text-xs">Estado fixture</dt><dd className="font-bold capitalize">{view.status}</dd></div><div className="rounded-xl bg-brand-neutral p-4"><dt className="text-xs">Finalidad</dt><dd className="font-bold capitalize">{view.finality}</dd></div><div className="rounded-xl bg-brand-neutral p-4"><dt className="text-xs">Operaciones</dt><dd className="font-bold">Bloqueadas</dd></div></dl>
          {role === 'patient' && view.publicToken && <button type="button" onClick={() => onVerify(view.publicToken!)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-brand-green-deep/20 px-4 py-3 font-bold"><QrCode size={18}/> Abrir QR público demo</button>}
          {role === 'admin' && <div className="mt-5"><TechnicalAdminOversightPanel access={{ authenticated: true, roles: ['admin'], scopes: ['admin:readiness:read'] }}/></div>}
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">Vista sintética y local. No contiene identidad, datos clínicos, cantidades ni secretos; tampoco acredita una receta válida.</p>
        </section>
        <aside className="rounded-3xl border border-brand-green-deep/10 bg-white p-6" aria-labelledby="evidence-title">
          <Activity/><p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-brand-green-mid">Stellar Expert · Testnet</p><h2 id="evidence-title" className="mt-2 text-2xl font-bold">Evidencia on-chain verificable</h2><p className="mt-2 text-xs text-brand-green-mid">Transacciones históricas del smoke sintético del 22 de agosto de 2026. No se generan transacciones nuevas.</p>
          <ol className="mt-5 space-y-3">{evidence.map(item => <li key={item.state}><a href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-brand-green-deep/10 p-3 text-sm font-bold hover:bg-brand-neutral"><span>{item.label}</span><ExternalLink size={15}/></a></li>)}</ol>
          {view.timeline && <ol className="mt-5 flex flex-wrap gap-2" aria-label="Timeline local versionado">{view.timeline.map(event => <li key={event.version} className="rounded-full bg-brand-neutral px-3 py-2 text-xs"><strong>v{event.version}</strong> · {event.state}</li>)}</ol>}
        </aside>
      </div>
    </main>
  </div>;
}
