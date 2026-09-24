import { lotStateLabel, lotReviewReason } from './lotPresentation';
import type { ReactNode, RefObject } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Home, Users, Package, FileText, ShieldCheck, Leaf } from 'lucide-react';
import { patients, lots, receipts, grams } from './data';

type Page = 'home' | 'attention' | 'inventory' | 'history';
export function DeskNavigation({ page, navigate }: { page: Page; navigate: (page: Page) => void }) {
  return <aside className="desk-navigation"><div className="desk-brand"><Leaf size={26}/><span>Trust Leaf</span></div><nav aria-label="Navegación del dispensario">{[
    { id: 'home', label: 'Jornada', icon: Home }, { id: 'attention', label: 'Pacientes', icon: Users },
    { id: 'inventory', label: 'Inventario', icon: Package }, { id: 'history', label: 'Historial', icon: FileText },
  ].map(n => <button key={n.id} aria-current={page === n.id ? 'page' : undefined} onClick={() => navigate(n.id as Page)}><n.icon size={22}/><span>{n.label}</span></button>)}</nav></aside>;
}

export function DeskPatientList({ searchField, selected, items, choose }: { searchField: ReactNode; selected: string | null; items: typeof patients[number][]; choose: (id: string, target: HTMLButtonElement) => void }) {
  return <section className="desk-patients"><h2>Pacientes autorizados</h2>{searchField}<div className="patient-list">{items.length ? items.map(p => <button key={p.id} className="patient-row" aria-pressed={selected === p.id} onClick={e => choose(p.id, e.currentTarget)}><span className="avatar">{p.initials}</span><span className="person"><strong>{p.name}</strong><small>{p.id}</small></span><ChevronRight size={18}/></button>) : <p className="empty" role="status">No hay pacientes para esta búsqueda.</p>}</div></section>;
}

export function DeskLotSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return <fieldset className="desk-lots"><legend>Seleccionar lote</legend><div className="desk-lot-columns" aria-hidden="true"><span>Producto / código</span><span>Existencias</span><span>Estado</span></div>{lots.map(l => <label className={`desk-lot ${l.state !== 'Disponible' ? 'unavailable' : ''}`} key={l.id}><input type="radio" name="desk-lot" value={l.id} checked={value === l.id} disabled={l.state !== 'Disponible'} onChange={() => onChange(l.id)}/><span className="desk-product"><strong>{l.product}</strong><small>{l.id}</small></span><strong className="desk-stock">{grams(l.stock)}</strong><span className="desk-lot-status"><span className={`badge ${l.state === 'Disponible' ? 'ok' : l.state === 'Vencido' ? 'danger' : 'warning'}`}>{lotStateLabel(l.state, true)}</span>{lotReviewReason(l) && <small>{lotReviewReason(l)}</small>}</span></label>)}</fieldset>;
}

type DetailProps = {
  patient: typeof patients[number]; lot: string; quantity: string; available: number; amount: number | null;
  valid: boolean; review: boolean; reviewPanel: ReactNode; heading: RefObject<HTMLHeadingElement | null>;
  setLot: (id: string) => void; setQuantity: (value: string) => void; onReview: () => void;
  back: () => void; openReceipt: (id: string, lot: string) => void;
};
export function DeskDetail(p: DetailProps) {
  const last = receipts.find(r => r.patient === p.patient.id);
  return <section className="desk-detail" aria-label="Detalle del paciente"><button className="desk-back" onClick={p.back}><ArrowLeft size={16}/>Volver a pacientes</button><h1 ref={p.heading} tabIndex={-1}>{p.patient.name}</h1><div className="desk-patient-meta"><span>{p.patient.id}</span><span className="permission"><ShieldCheck size={15}/>Permiso vigente</span></div>{p.review ? p.reviewPanel : <><div className="desk-balance"><div><strong>{grams(p.available)}</strong><span>disponibles</span></div><div><strong>{grams(p.patient.assigned)}</strong><span>asignados</span></div><div><strong>{grams(p.patient.used)}</strong><span>retirados</span></div></div><form onSubmit={e => { e.preventDefault(); if (p.valid) p.onReview(); }}><DeskLotSelector value={p.lot} onChange={p.setLot}/><h2 className="desk-preparation-title">Preparación de entrega</h2><div className="desk-preparation"><label>Cantidad en gramos<div className="quantity"><input required inputMode="decimal" value={p.quantity} onChange={e => p.setQuantity(e.target.value)} placeholder="0" aria-describedby="desk-quantity-help"/><span>g</span></div></label><div className="desk-result"><span>Saldo resultante</span><strong>{p.valid && p.amount !== null ? grams(p.available - p.amount) : '—'}</strong></div><button type="submit" className="primary" disabled={!p.valid}>Revisar entrega<ArrowRight size={18}/></button></div><p id="desk-quantity-help" className={p.quantity && !p.valid ? 'form-error' : 'muted'}>{p.quantity && !p.valid ? 'Selecciona un lote disponible e indica una cantidad válida dentro del saldo y las existencias.' : 'Revisión de prueba. No se registrará una entrega.'}</p></form><details className="desk-last-receipt"><summary>{last ? `Última entrega · ${grams(last.quantity)} · ${last.id}` : 'Sin entregas anteriores'}</summary>{last && <><p>{last.date} · {last.lot}</p><p>{last.operator}</p><button onClick={() => p.openReceipt(last.id, last.lot)}>Ver comprobante<ArrowRight size={16}/></button></>}</details><details><summary>Permiso y período</summary><p>{p.patient.permission}. Período ficticio: 01 al 30 de septiembre.</p></details></>}</section>;
}
