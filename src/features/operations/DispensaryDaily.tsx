import { batchState, batchLabels } from './batchPresentation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, ArrowRight, Save, ClipboardCheck } from 'lucide-react';
import { currentPeriod, formatGrams, gramsToMg, type PatientProfile, type PilotSnapshot, type Treatment } from './contracts';

export function DailyOverview({ data, navigate }: { data: PilotSnapshot; navigate: (tab: string) => void }) {
  const now = Date.now();
  const org = data.membership?.organization_ref;
  const batches = (data.batches ?? []).filter(b => b.organization_ref === org);
  const usable = batches.filter(b => b.state === 'active' && Date.parse(b.expires_at) > now && b.stock_mg > 0);
  const day = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(value));
  const today = day(new Date(now).toISOString());
  const deliveries = (data.deliveries ?? []).filter(d => d.organization_ref === org && day(d.created_at) === today);
  const metrics = [
    { label: 'Pacientes autorizados', value: new Set(data.treatments?.filter(t => currentPeriod(t, now) && data.grants?.some(g => g.treatment_ref === t.treatment_ref && g.organization_ref === org && Date.parse(g.expires_at) > now)).map(t => t.patient_ref)).size, tab: 'today' },
    { label: 'Stock disponible', value: formatGrams(usable.reduce((sum,b) => sum + b.stock_mg, 0)), tab: 'inventory' },
    { label: 'Entregas de hoy', value: deliveries.length, tab: 'history' },
    { label: 'Equipo activo', value: data.members?.filter(m => m.organization_ref === org).length ?? 0, tab: 'team' },
  ];
  const expiring = usable.filter(b => Date.parse(b.expires_at) <= now + 30 * 86400000);
  return <section aria-label="Resumen del dispensario" className="op-daily">
    <h2>Jornada del dispensario</h2>
    <div className="op-daily-metrics">{metrics.map(m => <button key={m.label} onClick={() => navigate(m.tab)}><span>{m.label}</span><strong>{m.value}</strong><ArrowRight size={16} aria-hidden="true"/></button>)}</div>
    {!!expiring.length && <div className="op-daily-alert"><span>{expiring.length} lote(s) disponibles vencen en los proximos 30 dias.</span><button className="op-command" onClick={() => navigate('inventory')}>Revisar inventario</button></div>}
    {!usable.length && <p className="op-daily-alert">Sin lotes disponibles para entregar.</p>}
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
  return <details className="op-preparation" aria-label="Preparacion del dispensario"><summary>Preparacion del dispensario · {steps.filter(s => s.done).length}/{steps.length} completados</summary>
    {steps.map(s => <div className="op-line" key={s.label}><span>{s.done ? <CheckCircle2 size={16} aria-label="Completado"/> : <Circle size={16} aria-label="Pendiente"/>} {s.label}</span>
      <button className="op-command" onClick={() => navigate(s.done || s.tab !== 'history' ? s.tab : 'today')}><ArrowRight size={16}/>{s.done ? 'Ver' : 'Continuar'}<span className="sr-only"> {s.label}</span></button></div>)}
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
  return <>
    {!batches.length && <p className="op-empty">No hay lotes disponibles con stock y vigencia para esta entrega.</p>}
    <form className="op-form op-desk-preparation" hidden={!!review} onSubmit={event => {
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
    {review && <section className="op-invitation-review" aria-label="Confirmar entrega"><h3>Confirmar entrega simulada</h3>
      <p>{profile?.name ?? 'Perfil de prueba pendiente'} · Paciente {treatment.patient_ref.slice(0, 8)}</p>
      <p>{batch?.product ?? 'Lote no disponible'} · {batch?.lot_code}</p>
      <p>Entrega: {formatGrams(review.quantity)} · Saldo resultante: {formatGrams(Math.max(0, remaining - review.quantity))}</p>
      {!valid && <p role="alert">Cambio el saldo o la disponibilidad del lote. Revisa la entrega.</p>}
      <button className="op-command" disabled={disabled || !valid} onClick={() => { submit({ resourceRef: treatment.treatment_ref, batchRef: review.batch, quantityMg: review.quantity }); setReview(null); }}>Confirmar entrega</button>
      <button className="op-command" disabled={disabled} onClick={() => setReview(null)}>Volver</button>
    </section>}
  </>;
}
