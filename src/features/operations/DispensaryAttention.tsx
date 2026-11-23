import { useDiscardDialog } from './useDiscardDialog';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, History } from 'lucide-react';
import { currentPeriod, formatGrams, type PilotSnapshot, type Treatment } from './contracts';
import { DispensingForm } from './DispensaryDaily';
import './dispensary-operator.css';

const date = (value: string) => new Date(value).toLocaleString('es-CL', { timeZone: 'America/Santiago' });

export default function DispensaryAttention({ data, authorized, search, onSearch, disabled, readError, receiptRef, submit, history, onDirtyChange }: {
  data: PilotSnapshot; authorized: readonly Treatment[]; search: string; onSearch: (value: string) => void; disabled: boolean; readError: string; receiptRef: string | null;
  submit: (input: Record<string, unknown>) => void; history: (ref: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { confirmDiscard, discardDialog } = useDiscardDialog(!!readError);
  const [selected, setSelected] = useState<string | null>(null);
  const [treatmentRef, setTreatmentRef] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty && (!disabled || readError)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, disabled, readError]);
  const heading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const scroll = useRef(0);
  const previousReceipt = useRef(receiptRef);
  const now = Date.now();
  const patients = [...new Set(authorized.map(t => t.patient_ref))];
  const treatments = authorized.filter(t => t.patient_ref === selected);
  const treatment = treatments.find(t => t.treatment_ref === treatmentRef);
  const profile = data.patientProfiles?.find(p => p.patient_ref === selected);
  const period = treatment && currentPeriod(treatment, now);
  const grant = data.grants?.find(g => g.treatment_ref === treatmentRef && g.organization_ref === data.membership?.organization_ref);
  const lastReceipt = (data.deliveries ?? []).filter(d => d.treatment_ref === treatmentRef).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
  const receipt = submitted && !readError && treatment && receiptRef !== previousReceipt.current
    ? data.deliveries?.find(d => d.delivery_ref === receiptRef && d.treatment_ref === treatment.treatment_ref
      && d.organization_ref === data.membership?.organization_ref)
    : undefined;
  const query = search.trim().toLocaleLowerCase();
  const visible = patients.filter(ref => `${ref} ${data.patientProfiles?.find(p => p.patient_ref === ref)?.name ?? ''}`.toLocaleLowerCase().includes(query));
  const mayLeave = async () => !dirty || await confirmDiscard('La preparacion de entrega se perdera. No se registrara ninguna entrega.');
  async function back() {
    if (disabled || !await mayLeave()) return;
    setSelected(null); setTreatmentRef(null); setDirty(false); setSubmitted(false);
    requestAnimationFrame(() => { origin.current?.focus({ preventScroll: true }); window.scrollTo(0, scroll.current); });
  }
  useEffect(() => {
    if (readError || (selected && !treatment)) {
      if (selected) requestAnimationFrame(() => listHeading.current?.focus({ preventScroll: true }));
      setSelected(null); setTreatmentRef(null); setDirty(false); setSubmitted(false);
      previousReceipt.current = receiptRef; origin.current = null;
    }
  }, [selected, treatment, readError]);
  useEffect(() => { if (selected) heading.current?.focus(); }, [selected]);
  const currentReceipt = receipt?.delivery_ref;
  useEffect(() => {
    if (currentReceipt) {
      setDirty(false);
      receiptHeading.current?.focus();
    }
  }, [currentReceipt]);
  return <div className={`op-attention ${selected && treatment ? 'op-attention-selected' : ''}`}>
    {discardDialog}
    <div className="op-patient-list">
      <h2 ref={listHeading} tabIndex={-1}>Pacientes autorizados <span className="op-muted">({patients.length})</span></h2>
      <label className="op-search">Buscar paciente por nombre o referencia<input type="search" disabled={!!readError} value={search} onChange={event => onSearch(event.target.value)} placeholder="Nombre o referencia del paciente"/></label>
      {!readError && !visible.length && <p className="op-empty op-patient-state" role="status">{query ? 'No hay pacientes para esta busqueda.' : 'No hay pacientes con permiso vigente.'}</p>}
      {visible.map(ref => {
        const items = authorized.filter(t => t.patient_ref === ref);
        const p = data.patientProfiles?.find(p => p.patient_ref === ref);
        const current = currentPeriod(items[0], now);
        if (!current) return null;
        return <button type="button" className="op-patient" key={ref} aria-pressed={selected === ref} disabled={disabled} onClick={async event => {
          const target = event.currentTarget;
          if (ref === selected || !await mayLeave()) return;
          scroll.current = window.scrollY; origin.current = target;
          previousReceipt.current = receiptRef; setSubmitted(false); setDirty(false);
          setTreatmentRef(items[0].treatment_ref); setSelected(ref);
        }}><span><strong>{p?.name ?? 'Perfil de prueba pendiente'}</strong><small>Paciente {ref.slice(0, 8)} · Permiso vigente</small>
          <small>{items.length > 1 ? `${items.length} tratamientos autorizados` : `${formatGrams(current.allowance_mg - current.used_mg)} disponibles`}</small></span><ArrowRight size={18} aria-hidden="true"/></button>;
      })}
    </div>
    <section className="op-patient-detail" aria-label="Detalle del paciente">
      {!treatment && <p className="op-empty op-patient-state">{readError ? 'La atencion no esta disponible hasta verificar los datos.' : 'Selecciona un paciente para revisar su tratamiento.'}</p>}
      {treatment && period && <>
        <button type="button" className="op-command op-back" disabled={disabled} onClick={back}><ArrowLeft size={16} aria-hidden="true"/>Volver a pacientes</button>
        <h2 ref={heading} tabIndex={-1}>{profile?.name ?? 'Perfil de prueba pendiente'}</h2>
        <p className="op-patient-permission">Paciente {treatment.patient_ref.slice(0, 8)} · Permiso hasta {grant ? <time dateTime={grant.expires_at}>{date(grant.expires_at)}</time> : 'no disponible'}</p>
        {treatments.length > 1 && <label>Tratamiento<select aria-label="Tratamiento" value={treatmentRef ?? ''} disabled={disabled} onChange={async e => {
          const next = e.target.value;
          if (!await mayLeave()) return; setTreatmentRef(next); setDirty(false); setSubmitted(false); previousReceipt.current = receiptRef;
        }}>{treatments.map(t => <option key={t.treatment_ref} value={t.treatment_ref}>{t.treatment_ref.slice(0, 8)} · {date(t.issued_at)}</option>)}</select></label>}
        <div className="op-balance"><div><span>Disponible</span><strong>{formatGrams(period.allowance_mg - period.used_mg)}</strong></div><div><span>Asignada</span><strong>{formatGrams(period.allowance_mg)}</strong></div><div><span>Retirada</span><strong>{formatGrams(period.used_mg)}</strong></div></div>
        {receipt ? (
          <section aria-label="Entrega registrada" className="op-patient-receipt">
            <h3 ref={receiptHeading} tabIndex={-1}>Entrega registrada: {formatGrams(receipt.quantity_mg)}</h3>
            <dl className="dispensary-task-review-details">
              <div><dt>Paciente</dt><dd>{profile?.name ?? 'Perfil de prueba pendiente'} · {treatment.patient_ref.slice(0, 8)}</dd></div>
              <div><dt>Fecha y hora</dt><dd><time dateTime={receipt.created_at}>{date(receipt.created_at)}</time></dd></div>
              <div><dt>Lote</dt><dd>{receipt.product ?? 'Producto no disponible'} · {receipt.lot_code ?? 'Lote no disponible'}</dd></div>
            </dl>
            <p className="op-reference">Comprobante: {receipt.delivery_ref}</p>
            <button type="button" className="op-command" onClick={() => history(receipt.delivery_ref)}><History size={16} aria-hidden="true"/>Ver historial</button>
          </section>
        )
          : <DispensingForm key={treatment.treatment_ref} data={data} treatment={treatment} disabled={disabled || !!readError || (submitted && receiptRef !== previousReceipt.current)} onDirty={() => setDirty(true)} submit={input => { setSubmitted(true); submit(input); }}/>
        }
        {!receipt && lastReceipt && <details><summary>Ultimo comprobante · {formatGrams(lastReceipt.quantity_mg)}</summary><p>{lastReceipt.product ?? 'Producto no disponible'} · {lastReceipt.lot_code ?? 'Lote no disponible'}</p><p className="op-reference">{lastReceipt.delivery_ref}</p><button type="button" className="op-command" onClick={() => history(lastReceipt.delivery_ref)}>Ver historial</button></details>}
        <details><summary>Contactos de prueba</summary><p>{profile?.email || 'Correo no disponible'} · {profile?.phone || 'Telefono no disponible'}</p></details>
        <details><summary>Periodos del tratamiento</summary>{treatment.periods.map(p => <p key={p.period_index}>Periodo {p.period_index}: {date(p.starts_at)} a {date(p.ends_at)} · {formatGrams(p.allowance_mg - p.used_mg)} disponibles</p>)}</details>
        <details><summary>Historial autorizado</summary>{(data.deliveries ?? []).filter(d => d.treatment_ref === treatmentRef).map(d => <p key={d.delivery_ref}>{formatGrams(d.quantity_mg)} · {date(d.created_at)} · {d.product ?? 'Producto no disponible'} · {d.lot_code ?? 'Lote no disponible'}<br/>Comprobante: {d.delivery_ref}</p>)}</details>
        <details><summary>Trazabilidad</summary><p>Paciente: {treatment.patient_ref}</p><p>Tratamiento: {treatment.treatment_ref}</p></details>
      </>}
    </section>
  </div>;
}
