import { useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, ArrowRight, Save, ClipboardCheck } from 'lucide-react';
import { currentPeriod, formatGrams, gramsToMg, type PatientProfile, type PilotSnapshot, type Treatment } from './contracts';

export function Preparation({ data, navigate }: { data: PilotSnapshot; navigate: (tab: string) => void }) {
  const org = data.membership?.organization_ref;
  const steps = [
    { label: 'Organizacion creada', done: !!org, tab: 'team' },
    { label: 'Operador incorporado', done: !!data.members?.some(m => m.organization_ref === org && m.role === 'operator'), tab: 'team' },
    { label: 'Lote disponible', done: !!data.batches?.some(b => b.organization_ref === org && b.state === 'active' && Date.parse(b.expires_at) > Date.now() && b.stock_mg > 0), tab: 'inventory' },
    { label: 'Primera entrega realizada', done: !!data.deliveries?.some(d => d.organization_ref === org), tab: 'history' },
  ];
  return <section aria-label="Preparacion del dispensario"><h2>Preparacion del dispensario</h2>
    {steps.map(s => <div className="op-line" key={s.label}><span>{s.done ? <CheckCircle2 size={16} aria-label="Completado"/> : <Circle size={16} aria-label="Pendiente"/>} {s.label}</span>
      <button className="op-command" onClick={() => navigate(s.done || s.tab !== 'history' ? s.tab : 'today')}><ArrowRight size={16}/>{s.done ? 'Ver' : 'Continuar'}<span className="sr-only"> {s.label}</span></button></div>)}
  </section>;
}

export function ProfileForm({ profile, disabled, save }: { profile?: PatientProfile | null; disabled: boolean; save: (input: Record<string, unknown>) => void }) {
  return <section><h2>Perfil de prueba</h2><form className="op-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    save({ name: fields.get('name'), email: fields.get('email'), phone: fields.get('phone'), version: profile?.version ?? 0, syntheticOnly: true });
  }}><fieldset disabled={disabled}>
    <label>Nombre ficticio<input name="name" defaultValue={profile?.name} required minLength={2} maxLength={100}/></label>
    <label>Correo ficticio<input name="email" type="email" defaultValue={profile?.email} required maxLength={160}/></label>
    <label>Telefono ficticio<input name="phone" defaultValue={profile?.phone} required minLength={3} maxLength={40}/></label>
    <label className="op-check"><input type="checkbox" required/>Confirmo que estos datos son ficticios.</label>
    <button className="op-command" type="submit"><Save size={16}/>Guardar perfil de prueba</button>
  </fieldset></form></section>;
}

export function DispensingForm({ data, treatment, disabled, submit }: { data: PilotSnapshot; treatment: Treatment; disabled: boolean; submit: (input: Record<string, unknown>) => void }) {
  const [review, setReview] = useState<{ batch: string; quantity: number } | null>(null);
  const [error, setError] = useState('');
  const period = currentPeriod(treatment, Date.now());
  const remaining = period ? period.allowance_mg - period.used_mg : 0;
  const batches = (data.batches ?? []).filter(b => b.state === 'active' && b.stock_mg > 0 && Date.parse(b.expires_at) > Date.now());
  const batch = batches.find(b => b.batch_ref === review?.batch);
  const profile = data.patientProfiles?.find(p => p.patient_ref === treatment.patient_ref);
  const valid = !!review && !!batch && review.quantity > 0 && review.quantity <= remaining && review.quantity <= batch.stock_mg;
  return <>
    {!batches.length && <p className="op-empty">No hay lotes disponibles con stock y vigencia para esta entrega.</p>}
    <form className="op-form" onSubmit={event => { event.preventDefault(); setError(''); try {
      const values = new FormData(event.currentTarget); const quantity = gramsToMg(String(values.get('grams')));
      if (quantity <= 0 || quantity > remaining || quantity > (batches.find(b => b.batch_ref === values.get('batch'))?.stock_mg ?? 0)) throw new Error('La cantidad supera el saldo o stock disponible.');
      setReview({ batch: String(values.get('batch')), quantity });
    } catch (e) { setError((e as Error).message); } }}>
      <fieldset disabled={disabled || !batches.length || remaining <= 0 || !!review}>
        <label>Lote<select aria-label="Lote" name="batch" required defaultValue=""><option value="">Seleccionar lote</option>{batches.map(b => <option key={b.batch_ref} value={b.batch_ref}>{b.product} · {b.lot_code} · {formatGrams(b.stock_mg)}</option>)}</select></label>
        <label>Cantidad en gramos<input name="grams" defaultValue="10" required inputMode="decimal"/></label>
        <button className="op-command" type="submit"><ClipboardCheck size={16}/>Registrar entrega simulada</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="op-error">{error}</p>}
    {review && <section className="op-invitation-review" aria-label="Confirmar entrega"><h3>Confirmar entrega simulada</h3>
      <p>{profile?.name ?? 'Perfil de prueba pendiente'} · Paciente {treatment.patient_ref}</p>
      <p>{batch?.product ?? 'Lote no disponible'} · {batch?.lot_code}</p>
      <p>Entrega: {formatGrams(review.quantity)} · Saldo resultante: {formatGrams(Math.max(0, remaining - review.quantity))}</p>
      {!valid && <p role="alert">Cambio el saldo o la disponibilidad del lote. Revisa la entrega.</p>}
      <button className="op-command" disabled={disabled || !valid} onClick={() => { submit({ resourceRef: treatment.treatment_ref, batchRef: review.batch, quantityMg: review.quantity }); setReview(null); }}>Confirmar entrega</button>
      <button className="op-command" disabled={disabled} onClick={() => setReview(null)}>Volver</button>
    </section>}
  </>;
}
