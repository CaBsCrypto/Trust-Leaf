import { useMemo, useReducer, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Store,
  UserRound,
} from 'lucide-react';
import {
  INITIAL_PILOT_FLOW,
  advancePilotFlow,
  phaseDefinition,
  phaseIndex,
  type PilotAction,
  type PilotRole,
} from './pilotFlowMachine';
import { PILOT_PHASES, PILOT_QR_HANDLE, pilotPublicProjection } from './pilotFlowFixtures';

const ROLE_META: Record<PilotRole, { label: string; icon: typeof ShieldCheck; tint: string }> = {
  admin: { label: 'Admin', icon: ShieldCheck, tint: 'bg-slate-100 text-slate-900' },
  doctor: { label: 'Médico', icon: Stethoscope, tint: 'bg-teal-100 text-teal-950' },
  patient: { label: 'Paciente', icon: UserRound, tint: 'bg-sky-100 text-sky-950' },
  dispensary: { label: 'Dispensario', icon: Store, tint: 'bg-amber-100 text-amber-950' },
};

const NEXT_ACTION: Record<string, { label: string; action: PilotAction }> = {
  'admin-empty': { label: 'Solicitar acceso médico', action: { type: 'doctor-request-access', actor: 'doctor' } },
  'doctor-requested': { label: 'Aprobar para la demo', action: { type: 'admin-approve-doctor', actor: 'admin' } },
  'doctor-operational': { label: 'Publicar disponibilidad', action: { type: 'doctor-publish-availability', actor: 'doctor' } },
  'availability-published': { label: 'Reservar bloque', action: { type: 'patient-book', actor: 'patient' } },
  'appointment-booked': { label: 'Registrar gates sintéticos', action: { type: 'doctor-complete-consultation', actor: 'doctor', consent: false, syntheticEligible: false } },
  'consultation-complete': { label: 'Preparar receipt simulado', action: { type: 'doctor-prepare-receipt', actor: 'doctor' } },
  'receipt-active': { label: 'Abrir directorio', action: { type: 'patient-open-directory', actor: 'patient' } },
  'directory-enabled': { label: 'Verificar y registrar parcial', action: { type: 'dispensary-record-partial', actor: 'dispensary', qrHandle: PILOT_QR_HANDLE } },
  'dispense-partial': { label: 'Registrar evento total', action: { type: 'dispensary-record-total', actor: 'dispensary', qrHandle: PILOT_QR_HANDLE } },
  'dispense-complete': { label: 'Abrir auditoría admin', action: { type: 'admin-open-audit', actor: 'admin' } },
};

export default function PilotFlowPage({ onBack }: { onBack: () => void }) {
  const [state, dispatch] = useReducer(advancePilotFlow, INITIAL_PILOT_FLOW);
  const [activeRole, setActiveRole] = useState<PilotRole>('admin');
  const [consentReady, setConsentReady] = useState(false);
  const [eligibilityReady, setEligibilityReady] = useState(false);
  const [qrMode, setQrMode] = useState<'valid' | 'tampered'>('valid');
  const [qrAttempted, setQrAttempted] = useState(false);
  const current = phaseDefinition(state.phase);
  const currentIndex = phaseIndex(state.phase);
  const next = NEXT_ACTION[state.phase];
  const expectedRole = next?.action.actor;
  const canAdvance = Boolean(next && activeRole === expectedRole);
  const progress = Math.round(((current.journeyStep - 1) / 9) * 100);
  const role = ROLE_META[activeRole];
  const RoleIcon = role.icon;
  const safeQr = useMemo(() => `${PILOT_QR_HANDLE.slice(0, 12)}…${PILOT_QR_HANDLE.slice(-4)}`, []);
  const selectedQr = qrMode === 'valid' ? PILOT_QR_HANDLE : `${PILOT_QR_HANDLE}.altered`;
  const publicResult = pilotPublicProjection(state.phase, selectedQr);

  const runNext = () => {
    if (!next) return;
    if (state.phase === 'appointment-booked') {
      dispatch({ type: 'doctor-complete-consultation', actor: activeRole, consent: consentReady, syntheticEligible: eligibilityReady });
      return;
    }
    if (state.phase === 'directory-enabled' || state.phase === 'dispense-partial') {
      setQrAttempted(true);
      dispatch({ ...next.action, actor: activeRole, qrHandle: selectedQr } as PilotAction);
      return;
    }
    dispatch({ ...next.action, actor: activeRole } as PilotAction);
  };

  const resetFlow = () => {
    dispatch({ type: 'reset', actor: activeRole });
    if (activeRole !== 'admin') return;
    setConsentReady(false);
    setEligibilityReady(false);
    setQrMode('valid');
    setQrAttempted(false);
  };

  return (
    <div className="min-h-screen bg-[#f2f5f1] text-[#102a22]" data-pilot-phase={state.phase}>
      <a href="#pilot-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Saltar al contenido</a>
      <header className="sticky top-0 z-30 border-b border-[#102a22]/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold"><ArrowLeft size={18} aria-hidden="true" /> Volver</button>
          <div className="text-center"><p className="text-xs font-extrabold uppercase tracking-[.2em]">TrustLeaf</p><p className="hidden text-xs text-[#315c4e] sm:block">Revisión E2E sintética</p></div>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-950">Local · sin envío</span>
        </div>
      </header>

      <main id="pilot-main" className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-[2rem] bg-[#102a22] text-white shadow-xl shadow-[#102a22]/10">
          <div className="grid gap-7 px-6 py-7 md:grid-cols-[1.2fr_.8fr] md:px-10 md:py-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-[#d6b85f]">Candidata navegable · fixtures deterministas</p>
              <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">Un recorrido técnico completo, sin fingir infraestructura clínica.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">La demo enlaza roles y gates en una sola sesión local. No usa identidades, datos clínicos, blockchain, RPC, autenticación ni persistencia real.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between text-xs"><span>Paso {current.journeyStep} de 10</span><span>{progress}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progreso del recorrido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-[#d6b85f] transition-[width]" style={{ width: `${progress}%` }} /></div>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-white/55">Estado compartido</p>
              <p className="mt-1 font-mono text-sm">fixture-flow · v{state.version}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#102a22]/10 bg-white p-4 shadow-sm" aria-labelledby="roles-title">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><p id="roles-title" className="text-xs font-extrabold uppercase tracking-[.18em] text-[#315c4e]">Cambiar perspectiva</p><p className="mt-1 text-sm text-[#315c4e]">Los permisos visuales se niegan por defecto si el rol no corresponde al siguiente gate.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Rol activo">
              {(Object.keys(ROLE_META) as PilotRole[]).map(item => {
                const meta = ROLE_META[item];
                const Icon = meta.icon;
                const selected = activeRole === item;
                return <button key={item} type="button" aria-pressed={selected} onClick={() => setActiveRole(item)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold ${selected ? 'border-[#102a22] bg-[#102a22] text-white' : 'border-[#102a22]/10 bg-white text-[#102a22]'}`}><Icon size={17} aria-hidden="true" />{meta.label}</button>;
              })}
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.6fr)]">
          <section className="rounded-[2rem] border border-[#102a22]/10 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="current-title" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#397261]">{current.eyebrow}</p><h2 id="current-title" className="mt-2 font-serif text-3xl sm:text-4xl">{current.title}</h2></div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${ROLE_META[current.role].tint}`}>{ROLE_META[current.role].label}</span>
            </div>
            <p className="mt-4 max-w-3xl leading-7 text-[#315c4e]">{current.summary}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatusCard label="Estado mínimo" value={current.status} />
              <StatusCard label="Fuente" value={current.source === 'fixture-local' ? 'Fixture local' : 'Gate local'} />
              <StatusCard label="Evidencia on-chain" value="No conectada" blocked />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Separación de evidencia Stellar">
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">ReceiptLedger V1</p><p className="mt-2 text-sm font-bold">Evidencia histórica separada</p><p className="mt-1 text-xs leading-5 text-slate-600">No impulsa estados ni autoriza acciones en este recorrido.</p></div>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">ReceiptLedgerV2</p><p className="mt-2 text-sm font-bold text-amber-950">Evidencia Testnet pendiente</p><p className="mt-1 text-xs leading-5 text-amber-900">La UI permanece en fixture hasta disponer de manifest y lector allowlisted.</p></div>
            </div>

            {state.phase === 'receipt-active' && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status"><strong>Receipt simulado/read-only.</strong> Esta pantalla representa el contrato esperado, pero no prueba que exista un evento nuevo en Testnet.</div>}

            {(state.phase === 'availability-published' || state.phase === 'appointment-booked') && <article className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-5" aria-label="Tarjeta de descubrimiento médico"><div className="flex items-center gap-3"><Stethoscope aria-hidden="true"/><div><p className="text-xs font-bold uppercase tracking-widest text-teal-800">Perfil operativo sintético</p><p className="mt-1 font-mono text-sm font-bold">actor_doc_A7k…R2</p></div></div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-teal-800">Disponibilidad</dt><dd className="font-bold">Bloque A · ventana demo</dd></div><div><dt className="text-teal-800">Estado</dt><dd className="font-bold">Operativo · fixture</dd></div></dl></article>}

            {state.phase === 'appointment-booked' && <fieldset className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-5"><legend className="px-1 text-sm font-bold">Gates sintéticos de consulta</legend><p className="mt-1 text-xs leading-5 text-sky-900">Ambos controles son obligatorios y representan sólo una revisión de UI.</p><label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-bold"><input type="checkbox" checked={consentReady} onChange={event => setConsentReady(event.target.checked)} className="h-5 w-5"/> Consentimiento demo confirmado</label><label className="mt-2 flex min-h-11 items-center gap-3 text-sm font-bold"><input type="checkbox" checked={eligibilityReady} onChange={event => setEligibilityReady(event.target.checked)} className="h-5 w-5"/> Decisión sintética marcada</label></fieldset>}

            {(state.phase === 'directory-enabled' || state.phase.startsWith('dispense')) && <div className="mt-5 space-y-4 rounded-2xl bg-[#eef7f2] p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[#315c4e]">Constancia pública mínima</p><p className="mt-2 font-mono text-sm font-bold">{safeQr}</p><p className="mt-2 text-xs text-[#315c4e]">La proyección pública existente devuelve únicamente existencia, coincidencia y estado.</p></div><dl className="grid gap-2 text-xs sm:grid-cols-3" data-public-verification-status={publicResult.status}><div><dt>Existe</dt><dd className="font-bold">{publicResult.evidenceExists ? 'Sí' : 'No'}</dd></div><div><dt>Coincide</dt><dd className="font-bold">{publicResult.proofMatches ? 'Sí' : 'No'}</dd></div><div><dt>Estado</dt><dd className="font-bold">{publicResult.status}</dd></div></dl>{(state.phase === 'directory-enabled' || state.phase === 'dispense-partial') && <label className="block text-xs font-bold">Fixture QR<select aria-label="Fixture QR" value={qrMode} onChange={event => setQrMode(event.target.value as 'valid' | 'tampered')} className="mt-2 min-h-11 w-full rounded-xl border border-[#102a22]/20 bg-white px-3"><option value="valid">Coincidencia válida</option><option value="tampered">Manipulado · prueba negativa</option></select></label>}</div>}

            {(state.phase === 'directory-enabled' || state.phase.startsWith('dispense')) && <article className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-label="Tarjeta de dispensario gateada"><div className="flex items-center gap-3"><Store aria-hidden="true"/><div><p className="text-xs font-bold uppercase tracking-widest text-amber-800">Directorio condicionado</p><p className="mt-1 font-mono text-sm font-bold">actor_store_Q4m…T8</p></div></div><p className="mt-3 text-xs leading-5 text-amber-900">Visible sólo después de elegibilidad y receipt sintéticos activos.</p></article>}

            <div className="mt-7 flex flex-col gap-3 border-t border-[#102a22]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm"><RoleIcon className="text-[#397261]" size={20} aria-hidden="true" /><span>Perspectiva activa: <strong>{role.label}</strong></span></div>
              {next ? <button type="button" onClick={runNext} disabled={!canAdvance} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#102a22] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">{canAdvance ? (qrAttempted && state.lastError && (state.phase === 'directory-enabled' || state.phase === 'dispense-partial') ? 'Reintentar verificación' : next.label) : `Requiere rol ${ROLE_META[expectedRole!].label}`}<ArrowRight size={18} aria-hidden="true" /></button> : <span className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-100 px-5 text-sm font-bold text-emerald-950"><CheckCircle2 size={18} /> Recorrido completo</span>}
            </div>
            {state.lastError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert">{state.lastError}</p>}
            {state.phase === 'dispense-complete' && <button type="button" onClick={() => dispatch({ type: 'dispensary-record-total', actor: activeRole, qrHandle: selectedQr })} disabled={activeRole !== 'dispensary'} className="mt-3 min-h-11 rounded-xl border border-rose-300 px-4 text-sm font-bold text-rose-900 disabled:cursor-not-allowed disabled:opacity-50">Intentar reutilizar QR · negativo</button>}
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-[#102a22]/10 bg-white p-5" aria-labelledby="timeline-title">
              <div className="flex items-center gap-2"><CalendarDays size={19} aria-hidden="true" /><h2 id="timeline-title" className="font-bold">Recorrido</h2></div>
              <ol className="mt-4 space-y-1">
                {PILOT_PHASES.map((item, index) => {
                  const done = index < currentIndex;
                  const active = index === currentIndex;
                  return <li key={item.phase} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs ${active ? 'bg-[#102a22] font-bold text-white' : done ? 'text-[#315c4e]' : 'text-slate-400'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-[#d6b85f] text-[#102a22]' : done ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100'}`}>{done ? '✓' : item.journeyStep}</span><span>{item.title}</span></li>;
                })}
              </ol>
            </section>
            <section className="rounded-3xl border border-[#102a22]/10 bg-white p-5" aria-labelledby="audit-title">
              <div className="flex items-center gap-2"><Activity size={19} aria-hidden="true" /><h2 id="audit-title" className="font-bold">Auditoría local</h2></div>
              {state.audit.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Sin eventos todavía.</p> : <ol className="mt-4 max-h-64 space-y-2 overflow-auto">{state.audit.map(entry => <li key={entry.sequence} className="rounded-xl bg-slate-50 p-3 text-xs"><span className="font-mono font-bold">#{entry.sequence}</span> · {ROLE_META[entry.actor].label}<br/><span className="font-mono text-[11px] text-[#315c4e]">{entry.event}</span></li>)}</ol>}
            </section>
          </aside>
        </div>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Límites de la candidata">
          <LimitCard icon={LockKeyhole} title="Fail-closed" text="Rol incorrecto, orden inválido, falta de consentimiento o QR alterado no cambian el estado." />
          <LimitCard icon={ClipboardCheck} title="Datos mínimos" text="Sólo roles, referencias opacas, estado y versión de fixtures. No hay ficha, receta ni identidad." />
          <LimitCard icon={ShieldCheck} title="Infraestructura pendiente" text="Auth, persistencia cifrada, ReceiptLedgerV2 y evidencia Testnet siguen como gates externos." />
        </section>

        <div className="flex justify-center pb-8"><button type="button" onClick={resetFlow} disabled={activeRole !== 'admin'} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#102a22]/20 bg-white px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={17} aria-hidden="true" /> Reiniciar fixtures</button></div>
      </main>
    </div>
  );
}

function StatusCard({ label, value, blocked = false }: { label: string; value: string; blocked?: boolean }) {
  return <div className="rounded-2xl bg-[#f2f5f1] p-4"><p className="text-[10px] font-extrabold uppercase tracking-widest text-[#315c4e]">{label}</p><p className={`mt-2 text-sm font-bold ${blocked ? 'text-amber-800' : ''}`}>{value}</p></div>;
}

function LimitCard({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <article className="rounded-3xl border border-[#102a22]/10 bg-white p-5"><Icon className="text-[#397261]" aria-hidden="true" /><h2 className="mt-3 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#315c4e]">{text}</p></article>;
}
