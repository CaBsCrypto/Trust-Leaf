import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, ClipboardCheck, FileText, Home, Leaf, Menu, Package, Search, SlidersHorizontal, ShieldCheck, Users, X } from 'lucide-react';
import { grams, lots, parseQuantity, patients, receipts } from './data';
import './style.css';
import './clinical.css';
import './desk.css';
import { DeskNavigation, DeskPatientList, DeskDetail } from './Desk';

type Page = 'home' | 'attention' | 'inventory' | 'history';
type ViewState = 'ready' | 'loading' | 'error' | 'empty';
const navigation = [
  { id: 'home', label: 'Jornada', icon: Home }, { id: 'attention', label: 'Atender', icon: Users },
  { id: 'inventory', label: 'Existencias', icon: Package }, { id: 'history', label: 'Comprobantes', icon: FileText },
] as const;

function App() {
  const [direction, setDirection] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('E');
  const [role, setRole] = useState('manager');
  const [page, setPage] = useState<Page>('home');
  const [viewState, setViewState] = useState<ViewState>('ready');
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [lot, setLot] = useState('');
  const [quantity, setQuantity] = useState('');
  const [review, setReview] = useState(false);
  const [formError, setFormError] = useState('');
  const [stockFilter, setStockFilter] = useState('Todos');
  const [historyLot, setHistoryLot] = useState('');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [deferred, setDeferred] = useState<(() => void) | null>(null);
  const deskHeading = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const originScroll = useRef(0);
  const firstRender = useRef(true);
  const patient = patients.find(p => p.id === patientId);
  const selectedLot = lots.find(l => l.id === lot);
  const amount = parseQuantity(quantity);
  const dirty = !!lot || !!quantity;
  const available = patient ? patient.assigned - patient.used : 0;
  const valid = !!patient && selectedLot?.state === 'Disponible' && amount !== null && amount <= available && amount <= selectedLot.stock;
  const safe = viewState === 'ready';
  const activeReceipt = receipts.find(r => r.id === receiptId);
  const query = search.trim().toLocaleLowerCase();
  const filteredPatients = patients.filter(p => `${p.name} ${p.id}`.toLocaleLowerCase().includes(query));
  const filteredLots = lots.filter(l => `${l.id} ${l.product}`.toLocaleLowerCase().includes(query) && (stockFilter === 'Todos' || l.state === stockFilter));
  const filteredReceipts = receipts.filter(r => `${r.id} ${r.lot} ${lots.find(l => l.id === r.lot)?.product}`.toLocaleLowerCase().includes(query) && (!historyLot || r.lot === historyLot));
  function clearDraft() { setLot(''); setQuantity(''); setReview(false); setFormError(''); }
  function guarded(action: () => void) { if (dirty) setDeferred(() => action); else action(); }
  function navigate(next: Page) {
    if (next === page) { setMenu(false); return; }
    guarded(() => { clearDraft(); setPage(next); setSearch(''); setPatientId(null); setReceiptId(null); setHistoryLot(''); setStockFilter('Todos'); setMenu(false); });
  }
  function back() {
    guarded(() => { clearDraft(); setPatientId(null); requestAnimationFrame(() => { origin.current?.focus({ preventScroll: true }); window.scrollTo(0, originScroll.current); }); });
  }
  function choose(id: string, target: HTMLButtonElement) {
    guarded(() => { clearDraft(); origin.current = target; originScroll.current = window.scrollY; setPatientId(id); });
  }
  function openHistory(id: string) { setPage('history'); setSearch(''); setHistoryLot(id); setReceiptId(null); }
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (page !== 'attention' || patientId || review) (direction === 'E' && patientId ? deskHeading.current : heading.current)?.focus({ preventScroll: true });
  }, [page, patientId, review]);
  useEffect(() => {
    if (!deferred) return;
    const target = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); target?.focus(); };
  }, [deferred]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const step = !patient ? 1 : review ? 3 : 2;
  const pageLabel = navigation.find(n => n.id === page)!.label;
  const title = page === 'home' ? (direction === 'D' || direction === 'E') ? 'Jornada' : 'Tu jornada, en orden.' : page === 'attention' ? review ? 'Revisar entrega' : patient ? patient.name : 'Pacientes autorizados' : pageLabel;
  const summary = page === 'home' ? 'Miércoles 23 de septiembre · Sede demostrativa' : page === 'attention' ? patient ? `${patient.id} · Tratamiento de prueba` : `${patients.length} pacientes con permiso vigente` : page === 'inventory' ? 'Lotes de esta sede' : 'Historial de entregas de esta sede';
  const SearchField = <label className="search"><Search size={18} aria-hidden="true"/><span className="sr-only">{page === 'attention' ? 'Buscar paciente por nombre o referencia' : 'Buscar por referencia, producto o lote'}</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={page === 'attention' ? 'Nombre o referencia del paciente' : 'Referencia, producto o lote'}/>{search && <button className="icon" title="Limpiar búsqueda" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X size={16}/></button>}</label>;
  function PatientList() { return <div className="patient-list" aria-label="Pacientes autorizados">{!filteredPatients.length ? <Empty text="No hay pacientes para esta búsqueda."/> : filteredPatients.map(p => <button className="patient-row" key={p.id} aria-pressed={patientId === p.id} onClick={e => choose(p.id, e.currentTarget)}>
    <span className="avatar">{p.initials}</span><span className="person"><strong>{p.name}</strong><small>{p.id} · Permiso vigente</small></span><span className="row-balance"><strong>{grams(p.assigned - p.used)}</strong><small>disponibles</small></span><ChevronRight size={18}/>
  </button>)}</div>; }
  const reviewPanel = patient && <div className="review-panel"><div className="review-top"><ClipboardCheck size={24}/><span>Revisión · sin ejecutar</span></div><h2>{grams(amount ?? 0)} de {selectedLot?.product}</h2><dl><div><dt>Paciente</dt><dd>{patient.name} · {patient.id}</dd></div><div><dt>Lote</dt><dd>{lot}</dd></div><div><dt>Disponible antes</dt><dd>{grams(available)}</dd></div><div className="result"><dt>Saldo hipotético</dt><dd>{grams(available - (amount ?? 0))}</dd></div></dl><p className="prototype-note">Prototipo de revisión. No se registra una entrega ni se modifica stock.</p><button onClick={() => setReview(false)}><ArrowLeft size={16}/>Volver a editar</button></div>;
  const detail = patient && <section className="patient-detail" aria-label="Detalle del paciente">
    {direction !== 'B' && <><div className="detail-top"><span className="avatar large">{patient.initials}</span><div><h2>{patient.name}</h2><span className="muted">{patient.id}</span></div></div><span className="permission"><ShieldCheck size={15}/>{patient.permission}</span></>}
    {!review && <><div className="balance"><div><span>Disponible</span><strong>{grams(available)}</strong></div><div><span>Asignada</span><strong>{grams(patient.assigned)}</strong></div><div><span>Retirada</span><strong>{grams(patient.used)}</strong></div></div>
      <form onSubmit={event => { event.preventDefault(); if (!valid || !safe) { setFormError('Revisa el lote, el saldo y la cantidad disponible.'); return; } setFormError(''); setReview(true); }}>
        <div className="form-heading"><span className="number">02</span><h2>Preparar entrega</h2></div>
        <label>Lote disponible<select required value={lot} onChange={e => setLot(e.target.value)}><option value="">Seleccionar lote</option>{lots.filter(l => l.state === 'Disponible').map(l => <option key={l.id} value={l.id}>{l.product} · {l.id} · {grams(l.stock)}</option>)}</select></label>
        <label>Cantidad en gramos<div className="quantity"><input required inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0"/><span>g</span></div></label>
        {formError && <p role="alert" className="form-error">{formError}</p>}
        <button className="primary" type="submit" disabled={!valid || !safe}>Revisar entrega<ArrowRight size={17}/></button>
      </form>
      <details><summary>Permiso y período</summary><p>Permiso vigente · {patient.permission}. Período ficticio del 01 al 30 de septiembre. El cupo no se acumula.</p></details>
      <details><summary>Entregas anteriores</summary>{receipts.filter(r => r.patient === patient.id).map(r => <p key={r.id}>{r.id} · {grams(r.quantity)} · {r.date}</p>)}{!receipts.some(r => r.patient === patient.id) && <p>Sin entregas registradas en estos datos de ejemplo.</p>}</details>
    </>}{review && reviewPanel}
  </section>;
  return <div className={`lab direction-${direction} ${direction === 'E' ? 'direction-D desk-page-' + page : ''}`}>

    <div className="app-shell">{direction === 'E' ? <DeskNavigation page={page} navigate={navigate}/> : <aside className="navigation"><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate(role === 'manager' ? 'home' : 'attention'); }}><Leaf size={26}/><span>trust leaf<span className="brand-caption">ESPACIO DE TRABAJO</span></span></a><button className="mobile-menu" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}><Menu size={20}/>{pageLabel}</button><nav id="main-nav" aria-label="Navegación del dispensario" className={menu ? 'expanded' : ''}>{navigation.map(n => <button key={n.id} aria-current={page === n.id ? 'page' : undefined} onClick={() => navigate(n.id)}><n.icon size={19}/><span>{n.label}</span>{direction === 'B' && <ChevronRight size={14}/>}</button>)}</nav><div className="nav-foot"><ShieldCheck size={18}/><span>Piloto de pruebas<br/><small>Una sede · datos ficticios</small></span></div></aside>}
    <div className="workspace"><header className="identity"><div><span className="site-mark">D</span><div><strong>Dispensario Demo</strong><small>{(direction === 'D' || direction === 'E') ? 'Piloto · Datos ficticios' : 'Sede de prueba'}</small></div></div><div className="account"><span className="account-dot">{role === 'manager' ? 'EC' : 'OP'}</span><div><strong>{role === 'manager' ? 'Encargado' : 'Operador'}</strong><small>{role}@example.test</small></div></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">{direction !== 'B' ? 'OPERACIÓN DIARIA' : 'TU ESPACIO DE TRABAJO'} / {pageLabel}</div><h1 tabIndex={-1} ref={heading}>{title}</h1><p>{summary}</p></div>{page === 'home' && <button className="primary" onClick={() => navigate('attention')}>Iniciar atención<ArrowRight size={18}/></button>}</div>
    {page === 'attention' && direction !== 'A' && direction !== 'E' && <ol className="steps" aria-label="Etapas de atención">{['Elegir paciente', 'Preparar entrega', 'Revisar'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined}><span>{i + 1 < step ? <Check size={15}/> : `0${i + 1}`}</span>{label}</li>)}</ol>}
    {!safe ? <section className="state-surface" role={viewState === 'error' ? 'alert' : 'status'}>{viewState === 'loading' ? <><div className="skeleton"/><div className="skeleton short"/><p>Cargando {pageLabel.toLowerCase()}…</p></> : viewState === 'error' ? <><CircleAlert size={32}/><h2>No pudimos actualizar los datos</h2><p>La revisión está bloqueada hasta recuperar la información.</p><button onClick={() => setViewState('ready')}>Reintentar</button></> : <><Package size={32}/><h2>Sin registros disponibles</h2><p>No hay {page === 'attention' ? 'pacientes autorizados' : 'registros'} para esta vista.</p></>}</section> : <>
    {page === 'home' && <><div className="overview"><Metric label="Pacientes autorizados" value="03" detail="Con permiso vigente" onClick={() => navigate('attention')}/><Metric label="Stock disponible" value={grams(lots.filter(l => l.state === 'Disponible').reduce((a,l) => a+l.stock,0))} detail="1 lote disponible" onClick={() => navigate('inventory')}/><Metric label="Entregas registradas" value="02" detail="Historial de ejemplo" onClick={() => navigate('history')}/></div><div className="home-work"><section><div className="section-title"><h2>{direction === 'A' ? 'Para revisar' : '¿Qué necesitas resolver?'}</h2><span>2 pendientes</span></div><button className="work-item" onClick={() => { navigate('inventory'); setStockFilter('Cuarentena'); }}><span className="work-icon warning"><Package size={20}/></span><span><strong>Lote en cuarentena</strong><small>Flor Norte · NOR-018 · 25 g</small></span><ArrowRight size={20}/></button><button className="work-item" onClick={() => { navigate('inventory'); setStockFilter('Vencido'); }}><span className="work-icon danger"><CircleAlert size={20}/></span><span><strong>Lote vencido</strong><small>Flor Sur · SUR-009 · no disponible para entregar</small></span><ArrowRight size={20}/></button></section><section className="recent"><div className="section-title"><h2>Último comprobante</h2><FileText size={20}/></div><span className="receipt-number">REC-001</span><h3>10 g · Flor Cordillera</h3><p>ALB-024 · 23 sep, 09:15</p><button onClick={() => { navigate('history'); setReceiptId('REC-001'); }}>Abrir comprobante<ArrowRight size={17}/></button></section></div>{role === 'manager' && <details className="preparation"><summary>Preparación del dispensario <span>4 de 4</span></summary><ul><li>Organización creada</li><li>Operador incorporado</li><li>Lote disponible</li><li>Primera entrega registrada</li></ul></details>}</>}
    {page === 'attention' && direction !== 'E' && <>{patient && <button className="back" onClick={back}><ArrowLeft size={16}/>Volver a pacientes</button>}<div className={`attention ${patient ? 'selected' : ''}`}><section className="people">{SearchField}{PatientList()}</section>{patient ? detail : direction !== 'B' && <section className="selection-empty"><Users size={36}/><h2>Una atención a la vez</h2><p>Selecciona un paciente autorizado.</p></section>}</div></>}
    {page === 'attention' && direction === 'E' && <div className={`desk-attention ${patient ? 'selected' : ''}`}><DeskPatientList searchField={SearchField} selected={patientId} items={filteredPatients} choose={choose}/>{patient ? <DeskDetail patient={patient} lot={lot} quantity={quantity} available={available} amount={amount} valid={!!valid && safe} review={review} reviewPanel={reviewPanel} heading={deskHeading} setLot={setLot} setQuantity={setQuantity} onReview={() => setReview(true)} back={back} openReceipt={(id, batch) => guarded(() => { clearDraft(); openHistory(batch); setPatientId(null); setReceiptId(id); })}/> : <section className="desk-no-selection"><Users size={32}/><h2>Selecciona un paciente</h2><p>Su saldo, lotes y comprobantes aparecerán aquí.</p></section>}</div>}
    {page === 'inventory' && <>{SearchField}<div className="filters" role="group" aria-label="Estado del lote">{['Todos','Disponible','Cuarentena','Vencido'].map(s => <button key={s} aria-pressed={stockFilter === s} onClick={() => setStockFilter(s)}>{s}</button>)}</div><div className="stock-list">{!filteredLots.length && <Empty text="No hay lotes para estos filtros."/>}{filteredLots.map(l => <article className="stock-row" key={l.id}><div className="lot-symbol"><Leaf size={24}/></div><div className="stock-name"><h2>{l.product}</h2><span>{l.id}</span></div><strong className="stock-quantity">{grams(l.stock)}</strong><span className={`badge ${l.state === 'Disponible' ? 'ok' : l.state === 'Vencido' ? 'danger' : 'warning'}`}>{l.state}</span><span className="expiry">Vence<br/><strong>{l.expires}</strong></span><button onClick={() => openHistory(l.id)}>Ver historial<ArrowRight size={16}/></button></article>)}</div></>}
    {page === 'history' && <>{SearchField}<label className="lot-filter">Lote<select value={historyLot} onChange={e => { setHistoryLot(e.target.value); setReceiptId(null); }}><option value="">Todos los lotes</option>{lots.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}</select>{(historyLot || search) && <button onClick={() => { setHistoryLot(''); setSearch(''); setReceiptId(null); }}>Limpiar filtros</button>}</label><div className="receipts">{!filteredReceipts.length && <Empty text="No hay comprobantes para estos filtros."/>}{filteredReceipts.map(r => <button className="receipt-row" key={r.id} aria-expanded={receiptId === r.id} onClick={() => setReceiptId(receiptId === r.id ? null : r.id)}><FileText size={22}/><span><strong>{(direction === 'D' || direction === 'E') ? 'Flor Cordillera' : `${r.id} · Flor Cordillera`}</strong><small>{(direction === 'D' || direction === 'E') ? `${r.date} · ${r.id}` : `${r.lot} · ${r.date}`}</small></span><strong>{grams(r.quantity)}</strong><ChevronRight size={18}/></button>)}</div>{activeReceipt && filteredReceipts.includes(activeReceipt) && <section className="receipt-detail" aria-label="Detalle del comprobante"><div className="section-title"><h2>{activeReceipt.id}</h2><span className="badge ok">Entrega histórica</span></div><dl><div><dt>Dispensario</dt><dd>Dispensario Demo</dd></div><div><dt>Producto / lote</dt><dd>Flor Cordillera / {activeReceipt.lot}</dd></div><div><dt>Cantidad</dt><dd>{grams(activeReceipt.quantity)}</dd></div><div><dt>Responsable</dt><dd>{activeReceipt.operator}</dd></div><div><dt>Fecha</dt><dd>{activeReceipt.date}</dd></div><div><dt>Período</dt><dd>Septiembre · período 1</dd></div></dl><p className="muted">Datos de ejemplo. Nombres del registro actual.</p></section>}</>}
    </>}
    <footer>Trust Leaf <span>Entorno de diseño · sin conexión a producción</span></footer><details className="lab-settings"><summary title="Configuración del prototipo" aria-label="Configuración del prototipo"><SlidersHorizontal size={17}/><span>Configuración del prototipo</span></summary><aside className="lab-bar" aria-label="Controles del prototipo"><strong>LAB / TRUST LEAF</strong><span>Datos ficticios · sin guardado</span><div className="variant" role="group" aria-label="Dirección visual"><button aria-pressed={direction === 'A'} onClick={() => setDirection('A')}>A · Operativo</button><button aria-pressed={direction === 'B'} onClick={() => setDirection('B')}>B · Por tareas</button><button aria-pressed={direction === 'C'} onClick={() => setDirection('C')}>C · Combinada</button><button aria-pressed={direction === 'D'} onClick={() => setDirection('D')}>D · Clínica</button><button aria-pressed={direction === 'E'} onClick={() => setDirection('E')}>Mesa de atención</button></div><label><span>Rol</span><select value={role} onChange={e => { const next = e.target.value; guarded(() => { clearDraft(); setRole(next); setPage(next === 'manager' ? 'home' : 'attention'); setPatientId(null); setSearch(''); setHistoryLot(''); setReceiptId(null); setViewState('ready'); }); }}><option value="manager">Encargado</option><option value="operator">Operador</option></select></label><label><span>Estado</span><select value={viewState} onChange={e => setViewState(e.target.value as ViewState)}><option value="ready">Contenido</option><option value="loading">Carga</option><option value="error">Error</option><option value="empty">Vacío</option></select></label></aside></details></main></div></div>
    <dialog ref={dialog} aria-labelledby="discard-title" onCancel={e => { e.preventDefault(); setDeferred(null); }}><h2 id="discard-title">¿Descartar la preparación?</h2><p>Se perderán el lote y la cantidad seleccionados. No se ha registrado una entrega.</p><div className="dialog-actions"><button autoFocus onClick={() => setDeferred(null)}>Seguir editando</button><button className="primary" onClick={() => { const action = deferred; setDeferred(null); action?.(); }}>Descartar cambios</button></div></dialog>
  </div>;
}
function Metric({ label, value, detail, onClick }: { label: string; value: string; detail: string; onClick: () => void }) { return <button className="metric" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{detail}</small><ArrowRight size={18}/></button>; }
function Empty({ text }: { text: string }) { return <p className="empty" role="status">{text}</p>; }
createRoot(document.getElementById('root')!).render(<App/>);
