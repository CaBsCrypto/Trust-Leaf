import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Save } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { formatGrams, gramsToMg, type PilotSnapshot } from '../operations/contracts';
import type { CommercialReceipt, CommerceCommand, CommerceMutationResult, CommercePage, Product, Supplier } from './contracts';

type Collection = 'products' | 'suppliers' | 'receipts';
type Item = Product | Supplier | CommercialReceipt;
const money = (value: number | null | undefined) => value == null ? 'Sin registrar' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
const amount = (value: FormDataEntryValue | null, optional = true): number | null => {
  if (value === '' && optional) return null;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) > 1000000000) throw new Error('Usa un importe entero entre 0 y 1.000.000.000 CLP.');
  return Number(value);
};

export default function CommercePanel({ data, changed }: { data: PilotSnapshot; changed: () => void }) {
  const identity = useTrustLeafPrivyIdentity();
  const manager = data.membership?.role === 'manager';
  const [collection, setCollection] = useState<Collection>('products');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<CommercePage<Item> | null>(null);
  const [selected, setSelected] = useState<Product | Supplier | null>(null);
  const [editor, setEditor] = useState(false);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CommerceCommand | null>(null);
  const [revision, setRevision] = useState(0);
  const [formRevision, setFormRevision] = useState(0);
  const [supplierPage, setSupplierPage] = useState<CommercePage<Supplier> | null>(null);
  const [supplierOffset, setSupplierOffset] = useState(0);
  const [supplierError, setSupplierError] = useState('');
  const abort = useRef(new AbortController());
  const lock = useRef(false);
  useEffect(() => { abort.current = new AbortController(); return () => abort.current.abort(); }, []);
  async function request(command: CommerceCommand, signal: AbortSignal) {
    const token = await identity.getIdentityToken(); signal.throwIfAborted();
    if (!token) throw Object.assign(new Error('Inicia sesion nuevamente.'), { status: 401 });
    const read = ['products', 'suppliers', 'receipts'].includes(command.action);
    const parameters = new URLSearchParams({ collection: command.action,
      ...Object.fromEntries(Object.entries(command.input).map(([key, value]) => [key, String(value)])) });
    const response = await fetch(`/api/dispensary-commerce${read ? `?${parameters}` : ''}`, {
      method: read ? 'GET' : 'POST', signal, cache: 'no-store',
      headers: { 'privy-id-token': token, ...(read ? {} : { 'content-type': 'application/json' }) },
      ...(read ? {} : { body: JSON.stringify(command) }),
    });
    if (!response.ok) throw Object.assign(new Error(response.status === 409 ? 'El registro cambio o ya no esta disponible. Actualiza antes de continuar.'
      : response.status === 403 ? 'Esta cuenta ya no tiene acceso a esta operacion.'
      : response.status === 400 ? 'Revisa los campos antes de guardar.' : 'No se pudo confirmar la respuesta. Puedes reintentar.'), { status: response.status });
    return response.json();
  }
  useEffect(() => {
    const controller = new AbortController(); let sequence = 0;
    async function read() {
      if (lock.current) return;
      const current = ++sequence;
      try {
        const result: CommercePage<Item> = await request({ action: collection, input: { offset, limit: 25 } }, controller.signal);
        if (controller.signal.aborted || current !== sequence) return;
        if (result.synthetic !== true || !Array.isArray(result.items)) throw new Error('Respuesta comercial no disponible.');
        setPage(result); setReadError('');
      } catch (e) {
        if (controller.signal.aborted || current !== sequence) return;
        setReadError((e as Error).message);
        if ([401, 403].includes((e as { status?: number }).status ?? 0)) { setPage(null); setSelected(null); }
      }
    }
    void read();
    const refresh = () => { if (document.visibilityState === 'visible') void read(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [collection, offset, revision, identity.subject]);
  useEffect(() => {
    if (!manager || collection !== 'products') return;
    const controller = new AbortController();
    setSupplierPage(null);
    void request({ action: 'suppliers', input: { offset: supplierOffset, limit: 25 } }, controller.signal)
      .then((result: CommercePage<Supplier>) => {
        if (!controller.signal.aborted) { setSupplierPage(result); setSupplierError(''); }
      }).catch((e: Error) => { if (!controller.signal.aborted) setSupplierError(e.message); });
    return () => controller.abort();
  }, [manager, collection, supplierOffset, revision]);
  async function execute(command: CommerceCommand) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setPending(command); setError(''); setNotice(''); setRevision(n => n + 1);
    try {
      const result: CommerceMutationResult = await request(command, abort.current.signal);
      if (abort.current.signal.aborted) return;
      if (result.synthetic !== true || typeof result.resourceRef !== 'string') throw new Error('No se pudo confirmar el resultado. Reintenta la misma operacion.');
      setPending(null); setSelected(null); setEditor(false); setFormRevision(n => n + 1);
      setNotice(`Guardado. Referencia: ${result.resourceRef}`); changed();
    } catch (e) {
      if (abort.current.signal.aborted) return;
      setError((e as Error).message);
      if ([400, 401, 403, 409].includes((e as { status?: number }).status ?? 0)) setPending(null);
      if ([401, 403].includes((e as { status?: number }).status ?? 0)) { setPage(null); setSelected(null); }
    } finally {
      lock.current = false;
      if (!abort.current.signal.aborted) { setBusy(false); setRevision(n => n + 1); }
    }
  }
  const disabled = busy || !!pending || !!readError || !page;
  function submit(event: FormEvent<HTMLFormElement>, action: 'save-product' | 'save-supplier' | 'receive' | 'link-batch') {
    event.preventDefault(); if (disabled) return;
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? '');
    const operationId = crypto.randomUUID();
    try {
      const version = selected?.version;
      if (action === 'save-product') void execute({ action, input: { operationId,
        resourceRef: selected && 'product_ref' in selected ? selected.product_ref : undefined, version,
        code: text('code'), name: text('name'), presentation: text('presentation'), referencePriceClp: amount(values.get('price')),
        reorderMg: text('threshold') === '0' ? 0 : gramsToMg(text('threshold')), archived: values.has('archived') } });
      if (action === 'save-supplier') void execute({ action, input: { operationId,
        resourceRef: selected && 'supplier_ref' in selected ? selected.supplier_ref : undefined, version,
        name: text('name'), internalReference: text('reference'), contact: text('contact') || null, archived: values.has('archived') } });
      if (selected && 'product_ref' in selected && action === 'receive') void execute({ action, input: { operationId,
        productRef: selected.product_ref, supplierRef: text('supplier') || null, lotCode: text('lot'), sourceReference: text('source'),
        expiresAt: new Date(text('expiry')).toISOString(), quantityMg: gramsToMg(text('grams')), costClp: amount(values.get('cost')) } });
      if (selected && 'product_ref' in selected && action === 'link-batch') {
        const batch = data.batches?.find(b => b.batch_ref === text('batch'));
        if (!batch) throw new Error('Selecciona un lote.');
        void execute({ action, input: { operationId, productRef: selected.product_ref, supplierRef: text('supplier') || null, resourceRef: batch.batch_ref, version: batch.version } });
      }
    } catch (e) { setError((e as Error).message); }
  }
  const product = selected && 'product_ref' in selected ? selected : null;
  const supplier = selected && 'supplier_ref' in selected ? selected : null;
  return <section aria-label="Gestion comercial" className="op-commerce">
    <h2>Gestion comercial</h2>
    <div className="op-tabs" role="group" aria-label="Registros comerciales">
      {([['products', 'Catalogo'], ...(manager ? [['suppliers', 'Proveedores']] : []), ['receipts', 'Recepciones']] as [Collection, string][]).map(([id, label]) =>
        <button key={id} disabled={!!pending} aria-pressed={collection === id} onClick={() => { setCollection(id); setOffset(0); setPage(null); setSelected(null); setEditor(false); setError(''); }}>{label}</button>)}
      <button aria-label="Actualizar registros comerciales" title="Actualizar registros comerciales" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={18}/></button>
    </div>
    {(error || readError) && <p role="alert" className="op-error">{error || readError}</p>}
    {notice && <p role="status" className="op-success op-reference">{notice}</p>}
    {pending && !busy && <button className="op-command" onClick={() => void execute(pending)}><RefreshCw size={16}/>Reintentar la misma operacion</button>}
    {!page && !readError && <p role="status">Cargando registros...</p>}
    {page?.items.map(item => 'code' in item ? <article className="op-row" key={item.product_ref}>
      <h3>{item.name}</h3><p>{item.code} · {item.presentation} · {item.archived ? 'Archivado' : 'Activo'}</p>
      <p>Precio de referencia: {money(item.reference_price_clp)} · Reposicion: {formatGrams(item.reorder_mg)}</p>
      {manager && <button className="op-command" disabled={disabled} onClick={() => { setSelected(item); setEditor(true); }}>Abrir producto</button>}
    </article> : 'internal_reference' in item ? <article className="op-row" key={item.supplier_ref}>
      <h3>{item.name}</h3><p>{item.internal_reference} · {item.archived ? 'Archivado' : 'Activo'}</p><p>{item.contact ?? 'Sin contacto'}</p>
      <details><summary>Referencia del proveedor</summary><p className="op-reference">{item.supplier_ref}</p></details>
      <button className="op-command" disabled={disabled} onClick={() => { setSelected(item); setEditor(true); }}>Editar proveedor</button>
    </article> : <article className="op-row" key={item.receipt_ref}><h3>{formatGrams(item.quantity_mg)}</h3>
      <p>{item.product_name} · Lote {item.lot_code}</p>
      <p>{new Date(item.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
      {manager && <p>Costo: {money(item.cost_clp)}</p>}<details><summary>Trazabilidad</summary><p className="op-reference">Recepcion: {item.receipt_ref}<br/>Lote: {item.batch_ref}<br/>Producto: {item.product_ref}</p></details>
    </article>)}
    {page && !page.items.length && !readError && <p className="op-empty">No hay registros en esta pagina.</p>}
    <div className="op-toolbar"><button aria-label="Pagina anterior" title="Pagina anterior" disabled={offset === 0 || !!pending} onClick={() => { setPage(null); setOffset(n => Math.max(0, n - 25)); }}><ChevronLeft size={18}/></button>
      <span>Pagina {offset / 25 + 1}</span><button aria-label="Pagina siguiente" title="Pagina siguiente" disabled={page?.nextOffset == null || !!pending} onClick={() => { setOffset(page!.nextOffset!); setPage(null); }}><ChevronRight size={18}/></button></div>
    {manager && collection !== 'receipts' && <>
      <button className="op-command" disabled={disabled} onClick={() => { setSelected(null); setEditor(true); setFormRevision(n => n + 1); }}>Nuevo {collection === 'products' ? 'producto' : 'proveedor'}</button>
      {editor && <form className="op-form" key={`${collection}-${selected?.version}-${product?.product_ref ?? supplier?.supplier_ref ?? 'new'}-${formRevision}`} onSubmit={e => submit(e, collection === 'products' ? 'save-product' : 'save-supplier')}>
        <fieldset disabled={disabled}><legend>{selected ? 'Editar' : 'Nuevo'} {collection === 'products' ? 'producto' : 'proveedor'}</legend>
          <label>Nombre<input name="name" required maxLength={160} defaultValue={selected?.name}/></label>
          {collection === 'products' ? <>
            <label>Codigo interno<input name="code" required maxLength={64} defaultValue={product?.code}/></label>
            <label>Presentacion<input name="presentation" maxLength={160} defaultValue={product?.presentation}/></label>
            <label>Precio de referencia (CLP)<input name="price" type="number" min="0" max="1000000000" step="1" defaultValue={product?.reference_price_clp ?? ''}/></label>
            <label>Umbral de reposicion (g)<input name="threshold" inputMode="decimal" required defaultValue={product ? String(product.reorder_mg / 1000) : '0'}/></label>
          </> : <><label>Referencia interna<input name="reference" maxLength={120} defaultValue={supplier?.internal_reference}/></label><label>Contacto comercial<input name="contact" maxLength={300} defaultValue={supplier?.contact ?? ''}/></label></>}
          <label className="op-check"><input name="archived" type="checkbox" defaultChecked={selected?.archived}/>Archivado</label>
          <button type="submit" className="op-command"><Save size={16}/>Guardar</button>
        </fieldset>
      </form>}
      {product && !product.archived && <>
        <details><summary>Recibir lote de {product.name}</summary>
          <form className="op-form" key={`receive-${product.product_ref}-${formRevision}`} onSubmit={e => submit(e, 'receive')}><fieldset disabled={disabled}>
            <label>Codigo de lote<input name="lot" required maxLength={100}/></label>
            <label>Referencia de origen<input name="source" required maxLength={160}/></label>
            <label>Proveedor (opcional)<select aria-label="Proveedor de la recepcion" name="supplier" key={`suppliers-${supplierOffset}`} defaultValue=""><option value="">Sin proveedor</option>{supplierPage?.items.filter(s => !s.archived).map(s => <option key={s.supplier_ref} value={s.supplier_ref}>{s.name}</option>)}</select></label>
            {supplierError && <p role="alert">{supplierError}</p>}
            <div className="op-toolbar"><button type="button" title="Proveedores anteriores" aria-label="Proveedores anteriores" disabled={supplierOffset === 0} onClick={() => setSupplierOffset(n => Math.max(0, n - 25))}><ChevronLeft size={18}/></button>
              <button type="button" title="Proveedores siguientes" aria-label="Proveedores siguientes" disabled={supplierPage?.nextOffset == null} onClick={() => setSupplierOffset(supplierPage!.nextOffset!)}><ChevronRight size={18}/></button></div>
            <label>Cantidad (g)<input name="grams" required inputMode="decimal"/></label>
            <label>Vencimiento<input name="expiry" type="datetime-local" required/></label>
            <label>Costo total (CLP)<input name="cost" type="number" min="0" max="1000000000" step="1"/></label>
            <button className="op-command" type="submit"><Save size={16}/>Registrar recepcion simulada</button>
          </fieldset></form>
        </details>
        <details><summary>Vincular lote existente sin cambiar stock</summary>
          <form className="op-form" onSubmit={e => submit(e, 'link-batch')}><fieldset disabled={disabled}>
            <label>Lote<select name="batch" required defaultValue=""><option value="" disabled>Seleccionar lote</option>{data.batches?.map(b => <option key={b.batch_ref} value={b.batch_ref}>{b.product} · {b.lot_code}</option>)}</select></label>
            <label>Proveedor (opcional)<select aria-label="Proveedor del lote" name="supplier" defaultValue=""><option value="">Sin proveedor</option>{supplierPage?.items.filter(s => !s.archived).map(s => <option key={s.supplier_ref} value={s.supplier_ref}>{s.name}</option>)}</select></label>
            <button className="op-command" type="submit"><Save size={16}/>Vincular sin cambiar stock</button>
          </fieldset></form>
        </details>
      </>}
    </>}
  </section>;
}
