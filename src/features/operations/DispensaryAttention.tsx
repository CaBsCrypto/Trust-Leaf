import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, History } from 'lucide-react';
import { currentPeriod, formatGrams, type PilotSnapshot } from './contracts';
import { DispensingForm } from './DispensaryDaily';

const date = (value: string) => new Date(value).toLocaleString('es-CL', { timeZone: 'America/Santiago' });

export default function DispensaryAttention({ data, search, disabled, readError, receiptRef, submit, history }: {
  data: PilotSnapshot; search: string; disabled: boolean; readError: string; receiptRef: string | null;
  submit: (input: Record<string, unknown>) => void; history: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [treatmentRef, setTreatmentRef] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const scroll = useRef(0);
  const previousReceipt = useRef(receiptRef);
  const now = Date.now();
  const authorized = (data.treatments ?? []).filter(t => currentPeriod(t, now) && data.grants?.some(g =>
    g.treatment_ref === t.treatment_ref && g.organization_ref === data.membership?.organization_ref && Date.parse(g.expires_at) > now));
  const patients = [...new Set(authorized.map(t => t.patient_ref))];
  const treatments = authorized.filter(t => t.patient_ref === selected);
  const treatment = treatments.find(t => t.treatment_ref === treatmentRef);
  const profile = data.patientProfiles?.find(p => p.patient_ref === selected);
  const period = treatment && currentPeriod(treatment, now);
  const grant = data.grants?.find(g => g.treatment_ref === treatmentRef && g.organization_ref === data.membership?.organization_ref);
  const receipt = submitted && receiptRef !== previousReceipt.current ? data.deliveries?.find(d => d.delivery_ref === receiptRef) : undefined;
  const query = search.trim().toLocaleLowerCase();
  const visible = patients.filter(ref => `${ref} ${data.patientProfiles?.find(p => p.patient_ref === ref)?.name ?? ''}`.toLocaleLowerCase().includes(query));
  const mayLeave = () => !dirty || window.confirm('Descartar los datos de esta entrega sin confirmar?');
  function back() {
    if (disabled || !mayLeave()) return;
    setSelected(null); setTreatmentRef(null); setDirty(false); setSubmitted(false);
    requestAnimationFrame(() => { origin.current?.focus({ preventScroll: true }); window.scrollTo(0, scroll.current); });
  }
  useEffect(() => {
    // Missing authorization removes the detail immediately; transport errors retain the last snapshot.
    if (selected && !treatment && !readError) { setSelected(null); setTreatmentRef(null); setDirty(false); setSubmitted(false); }
  }, [selected, treatment, readError]);
  useEffect(() => { if (selected) heading.current?.focus(); }, [selected]);
  useEffect(() => { if (receipt) setDirty(false); }, [receipt]);
  return <div className={`op-attention ${selected && treatment ? 'op-attention-selected' : ''}`}>
    <div className="op-patient-list">
      <h2>Pacientes autorizados <span className="op-muted">({patients.length})</span></h2>
      {!readError && !visible.length && <p className="op-empty">{query ? 'No hay pacientes para esta busqueda.' : 'No hay pacientes con permiso vigente.'}</p>}
      {visible.map(ref => {
        const items = authorized.filter(t => t.patient_ref === ref);
        const p = data.patientProfiles?.find(p => p.patient_ref === ref);
        const current = currentPeriod(items[0], now)!;
        return <button className="op-patient" key={ref} aria-pressed={selected === ref} disabled={disabled} onClick={event => {
          if (ref === selected || !mayLeave()) return;
          scroll.current = window.scrollY; origin.current = event.currentTarget;
          previousReceipt.current = receiptRef; setSubmitted(false); setDirty(false);
          setTreatmentRef(items[0].treatment_ref); setSelected(ref);
        }}><span><strong>{p?.name ?? 'Perfil de prueba pendiente'}</strong><small>Paciente {ref.slice(0, 8)} · Permiso vigente</small>
          <small>{items.length > 1 ? `${items.length} tratamientos autorizados` : `${formatGrams(current.allowance_mg - current.used_mg)} disponibles`}</small></span><ArrowRight size={18} aria-hidden="true"/></button>;
      })}
    </div>
    <section className="op-patient-detail" aria-label="Detalle del paciente">
      {!treatment && <p className="op-empty">Selecciona un paciente para revisar su tratamiento.</p>}
      {treatment && period && <>
        <button className="op-command op-back" disabled={disabled} onClick={back}><ArrowLeft size={16}/>Volver a pacientes</button>
        <h2 ref={heading} tabIndex={-1}>{profile?.name ?? 'Perfil de prueba pendiente'}</h2>
        <p>Paciente {treatment.patient_ref.slice(0, 8)} · Permiso hasta {grant ? date(grant.expires_at) : 'no disponible'}</p>
        {treatments.length > 1 && <label>Tratamiento<select aria-label="Tratamiento" value={treatmentRef ?? ''} disabled={disabled} onChange={e => {
          if (!mayLeave()) return; setTreatmentRef(e.target.value); setDirty(false); setSubmitted(false); previousReceipt.current = receiptRef;
        }}>{treatments.map(t => <option key={t.treatment_ref} value={t.treatment_ref}>{t.treatment_ref.slice(0, 8)} · {date(t.issued_at)}</option>)}</select></label>}
        <div className="op-balance"><div><span>Disponible</span><strong>{formatGrams(period.allowance_mg - period.used_mg)}</strong></div><div><span>Asignada</span><strong>{formatGrams(period.allowance_mg)}</strong></div><div><span>Retirada</span><strong>{formatGrams(period.used_mg)}</strong></div></div>
        {receipt ? <section aria-label="Entrega registrada"><h3>Entrega registrada: {formatGrams(receipt.quantity_mg)}</h3><p>{receipt.product ?? 'Producto no disponible'} · {receipt.lot_code ?? 'Lote no disponible'}</p><p className="op-reference">Comprobante: {receipt.delivery_ref}</p><button className="op-command" onClick={history}><History size={16}/>Ver historial</button></section>
          : <DispensingForm key={treatment.treatment_ref} data={data} treatment={treatment} disabled={disabled || !!readError || (submitted && receiptRef !== previousReceipt.current)} onDirty={() => setDirty(true)} submit={input => { setSubmitted(true); submit(input); }}/>
        }
        <details><summary>Contactos de prueba</summary><p>{profile?.email || 'Correo no disponible'} · {profile?.phone || 'Telefono no disponible'}</p></details>
        <details><summary>Periodos del tratamiento</summary>{treatment.periods.map(p => <p key={p.period_index}>Periodo {p.period_index}: {date(p.starts_at)} a {date(p.ends_at)} · {formatGrams(p.allowance_mg - p.used_mg)} disponibles</p>)}</details>
        <details><summary>Historial autorizado</summary>{(data.deliveries ?? []).filter(d => d.treatment_ref === treatmentRef).map(d => <p key={d.delivery_ref}>{formatGrams(d.quantity_mg)} · {date(d.created_at)} · {d.product ?? 'Producto no disponible'} · {d.lot_code ?? 'Lote no disponible'}<br/>Comprobante: {d.delivery_ref}</p>)}</details>
        <details><summary>Trazabilidad</summary><p>Paciente: {treatment.patient_ref}</p><p>Tratamiento: {treatment.treatment_ref}</p></details>
      </>}
    </section>
  </div>;
}
