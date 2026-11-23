import { batchState, batchLabels } from './batchPresentation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Circle, ClipboardCheck, Clock3, Package, Save, Truck, Users, UserRound } from 'lucide-react';
import { currentPeriod, formatGrams, gramsToMg, type PatientProfile, type PilotSnapshot, type Treatment } from './contracts';
import './dispensary-care.css';

export function DailyOverview({ data, navigate }: { data: PilotSnapshot; navigate: (tab: string) => void }) {
  const now = Date.now();
  const org = data.membership?.organization_ref;
  const batches = (data.batches ?? []).filter(b => b.organization_ref === org);
  const usable = batches.filter(b => b.state === 'active' && Date.parse(b.expires_at) > now && b.stock_mg > 0);
  const day = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(value));
  const today = day(new Date(now).toISOString());
  const deliveries = (data.deliveries ?? []).filter(d => d.organization_ref === org && day(d.created_at) === today);
  const patients = { label: 'Pacientes autorizados', value: new Set(data.treatments?.filter(t => currentPeriod(t, now) && data.grants?.some(g => g.treatment_ref === t.treatment_ref && g.organization_ref === org && Date.parse(g.expires_at) > now)).map(t => t.patient_ref)).size, tab: 'today', icon: UserRound };
  const stock = { label: 'Stock disponible', value: formatGrams(usable.reduce((sum, b) => sum + b.stock_mg, 0)), tab: 'inventory', icon: Package };
  const history = { label: 'Entregas de hoy', value: deliveries.length, tab: 'history', icon: Truck };
  const team = { label: 'Equipo activo', value: data.members?.filter(m => m.organization_ref === org).length ?? 0, tab: 'team', icon: Users };
  const manager = data.membership?.role === 'manager';
  const metrics = manager ? [stock, team, patients, history] : [patients, history, stock, team];
  const expiring = usable.filter(b => Date.parse(b.expires_at) <= now + 30 * 86400000);
  return <section aria-label="Resumen del dispensario" className="op-daily dispensary-task-overview">
    <h2>Jornada del dispensario</h2>
    <div className="op-daily-metrics">{metrics.map(({ label, value, tab, icon: Icon }, index) =>
      <button key={tab} type="button" data-priority={index < 2} onClick={() => navigate(tab)}>
        <span className="dispensary-task-icon"><Icon size={19} aria-hidden="true"/></span>
        <span className="dispensary-task-metric"><span>{label}</span><strong>{value}</strong></span>
        <ArrowRight className="dispensary-task-arrow" size={17} aria-hidden="true"/>
      </button>
    )}</div>
    {!!expiring.length && <div className="op-daily-alert">
      <div className="dispensary-stock-notice"><Clock3 size={16} aria-hidden="true"/>
        <span>{expiring.length} lote(s) disponibles vencen en los proximos 30 dias.</span>
      </div>
      <button className="op-command" type="button" onClick={() => navigate('inventory')}>Revisar inventario</button>
    </div>}
    {!usable.length && <p className="op-daily-alert" role="status">Sin lotes disponibles para entregar.</p>}
  </section>;
}

export function Preparation({ data, navigate }: { data: PilotSnapshot; navigate: (tab: string) => void }) {
  const org = data.membership?.organization_ref;
  const steps = [
    { label: 'Organizacion creada', done: !!org, tab: 'team' },
    { label: 'Operador incorporado', done: !!data.members?.some(m => m.organization_ref === org && m.role === 'operator'), tab: 'team' },
    { label: 'Lote disponible', done: !!data.batches?.some(b => b.organization_ref === org && b.state === 'active' && Date.parse(b.expires_at) > Date.now() && b.stock_mg > 0), tab: 'inventory' },
    { label: 'Primera entrega realizada', done: !!data.deliveries?.some(d => d.organization_ref === org), tab: 'history' },
  ];
  return <details className="op-preparation dispensary-task-preparation" aria-label="Preparacion del dispensario"><summary>Preparacion del dispensario · {steps.filter(s => s.done).length}/{steps.length} completados</summary>
    {steps.map(s => <div className="op-line" key={s.label}>
      <span>
        {s.done ? <CheckCircle2 size={16} aria-hidden="true"/> : <Circle size={16} aria-hidden="true"/>}
        <span>{s.label}<small>{s.done ? 'Completado' : 'Pendiente'}</small></span>
      </span>
      <button className="op-command" type="button" onClick={() => navigate(s.done || s.tab !== 'history' ? s.tab : 'today')}>
        <ArrowRight size={16} aria-hidden="true"/>{s.done ? 'Ver' : 'Continuar'}<span className="sr-only"> {s.label}</span>
      </button>
    </div>)}
  </details>;
}

export function ProfileForm({ profile, disabled, save }: { profile?: PatientProfile | null; disabled: boolean; save: (input: Record<string, unknown>) => void }) {
  type Draft = { name: string; email: string; phone: string; version: number };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const submitted = useRef<Draft | null>(null);
  const values = draft ?? { name: profile?.name ?? '', email: profile?.email ?? '', phone: profile?.phone ?? '', version: profile?.version ?? 0 };
  const edit = (field: 'name' | 'email' | 'phone', value: string) => setDraft({ ...values, [field]: value });
  useEffect(() => {
    const sent = submitted.current;
    // Only a matching persisted save clears the draft; background refreshes must not overwrite edits.
    if (sent && profile && profile.version > sent.version && profile.name === sent.name.trim()
      && profile.email === sent.email.trim().toLowerCase() && profile.phone === sent.phone.trim()) {
      setDraft(current => current === sent ? null : current);
      setConfirmed(false); submitted.current = null;
    }
  }, [profile]);
  return <section><h2>Perfil de prueba</h2><form className="op-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); submitted.current = values;
    save({ ...values, syntheticOnly: true });
  }}><fieldset disabled={disabled}>
    <label>Nombre ficticio<input name="name" value={values.name} onChange={e => edit('name',e.target.value)} required minLength={2} maxLength={100}/></label>
    <label>Correo ficticio<input name="email" type="email" value={values.email} onChange={e => edit('email',e.target.value)} required maxLength={160}/></label>
    <label>Telefono ficticio<input name="phone" value={values.phone} onChange={e => edit('phone',e.target.value)} required minLength={3} maxLength={40}/></label>
    <label className="op-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required/>Confirmo que estos datos son ficticios.</label>
    <button className="op-command" type="submit"><Save size={16}/>Guardar perfil de prueba</button>
  </fieldset></form></section>;
}

export function DispensingForm({ data, treatment, disabled, submit, onDirty }: { data: PilotSnapshot; treatment: Treatment; disabled: boolean; submit: (input: Record<string, unknown>) => void; onDirty?: () => void }) {
  const [review, setReview] = useState<{ batch: string; quantity: number } | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const preparationForm = useRef<HTMLFormElement>(null);
  const returningToPreparation = useRef(false);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [error, setError] = useState('');
  const period = currentPeriod(treatment, Date.now());
  const remaining = period ? period.allowance_mg - period.used_mg : 0;
  const lots = (data.batches ?? []).filter(b => b.organization_ref === data.membership?.organization_ref);
  const batches = lots.filter(b => batchState(b) === 'available');
  const selectedBatch = batches.find(b => b.batch_ref === selected);
  const batch = batches.find(b => b.batch_ref === review?.batch);
  const profile = data.patientProfiles?.find(p => p.patient_ref === treatment.patient_ref);
  let amount = 0;
  try { amount = gramsToMg(quantity); } catch { /* Invalid input remains editable. */ }
  const validDraft = !!selectedBatch && amount > 0 && amount <= remaining && amount <= selectedBatch.stock_mg;
  const valid = !!review && !!batch && review.quantity > 0 && review.quantity <= remaining && review.quantity <= batch.stock_mg;
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
    else if (returningToPreparation.current) {
      returningToPreparation.current = false;
      preparationForm.current?.focus();
    }
  }, [review]);
  return <>
    {!batches.length && <p className="op-empty">No hay lotes disponibles con stock y vigencia para esta entrega.</p>}
    <form ref={preparationForm} tabIndex={-1} className="op-form op-desk-preparation" hidden={!!review} onSubmit={event => {
      event.preventDefault(); setError('');
      if (!validDraft) { setError('Selecciona un lote disponible y una cantidad dentro del saldo y stock.'); return; }
      setReview({ batch: selected, quantity: amount });
    }}>
      <fieldset disabled={disabled || !batches.length || remaining <= 0}>
        <fieldset className="op-lot-options"><legend>Seleccionar lote</legend>{lots.map(lot => {
          const state = batchState(lot);
          return <label key={lot.batch_ref} className="op-lot-option">
            <input type="radio" name="batch" value={lot.batch_ref} checked={selected === lot.batch_ref && state === 'available'} disabled={state !== 'available'} onChange={() => { setSelected(lot.batch_ref); onDirty?.(); }}/>
            <span><strong>{lot.product}</strong><small>{lot.lot_code}</small></span>
            <strong>{formatGrams(lot.stock_mg)}</strong>
            <span className={'op-batch-state op-batch-' + state}>{batchLabels[state]}</span>
          </label>;
        })}</fieldset>
        <div className="op-desk-quantity">
          <label>Cantidad en gramos<input name="grams" value={quantity} onChange={event => { setQuantity(event.target.value); onDirty?.(); }} required inputMode="decimal"/></label>
          <div><span>Saldo resultante</span><strong>{validDraft ? formatGrams(remaining - amount) : '—'}</strong></div>
          <button className="op-command" type="submit" disabled={!validDraft}><ClipboardCheck size={16}/>Revisar entrega</button>
        </div>
      </fieldset>
      {!!selectedBatch && !validDraft && <p className="op-error" role="status">Indica una cantidad mayor que cero, dentro del saldo y las existencias disponibles.</p>}
    </form>
    {error && <p role="alert" className="op-error">{error}</p>}
    {review && <section className="op-invitation-review dispensary-task-review" aria-label="Confirmar entrega">
      <h3 ref={reviewHeading} tabIndex={-1}><ClipboardCheck size={20} aria-hidden="true"/>Confirmar entrega simulada</h3>
      <dl className="dispensary-task-review-details">
        <div><dt>Paciente</dt><dd>{profile?.name ?? 'Perfil de prueba pendiente'} · {treatment.patient_ref.slice(0, 8)}</dd></div>
        <div><dt>Lote</dt><dd>{batch?.product ?? 'Lote no disponible'}{batch?.lot_code ? ` · ${batch.lot_code}` : ''}</dd></div>
        <div><dt>Entrega: </dt><dd>{formatGrams(review.quantity)}</dd></div>
        <div><dt>Saldo resultante: </dt><dd>{valid ? formatGrams(remaining - review.quantity) : '—'}</dd></div>
        <div><dt>Stock resultante del lote</dt><dd>{valid && batch ? formatGrams(batch.stock_mg - review.quantity) : '—'}</dd></div>
      </dl>
      {!valid && <p role="alert">Cambio el saldo o la disponibilidad del lote. Revisa la entrega.</p>}
      <div className="op-toolbar dispensary-task-review-actions">
        <button className="op-command" disabled={disabled || !valid} onClick={() => { submit({ resourceRef: treatment.treatment_ref, batchRef: review.batch, quantityMg: review.quantity }); setReview(null); }}>Confirmar entrega</button>
        <button className="op-command" disabled={disabled} onClick={() => { returningToPreparation.current = true; setReview(null); }}>Volver</button>
      </div>
    </section>}
  </>;
}
