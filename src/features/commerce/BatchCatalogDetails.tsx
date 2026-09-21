import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import type { BatchCatalogLink, CommercePage } from './contracts';

export default function BatchCatalogDetails({ batchRef, version }: { batchRef: string; version: number }) {
  const identity = useTrustLeafPrivyIdentity();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<BatchCatalogLink | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); let sequence = 0;
    async function refresh() {
      const current = ++sequence;
      setLoading(true);
      try {
        const token = await identity.getIdentityToken(); controller.signal.throwIfAborted();
        if (!token) throw new Error('Inicia sesion nuevamente.');
        const response = await fetch(`/api/dispensary-commerce?${new URLSearchParams({ collection: 'batch-links', batchRef, limit: '1' })}`, {
          headers: { 'privy-id-token': token }, cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('No se pudo consultar la vinculacion del lote.');
        const result: CommercePage<BatchCatalogLink> = await response.json();
        if (result.synthetic !== true || !Array.isArray(result.items)) throw new Error('Respuesta no disponible.');
        if (!controller.signal.aborted && current === sequence) { setLink(result.items[0] ?? null); setError(''); }
      } catch (e) {
        if (!controller.signal.aborted && current === sequence) { setLink(null); setError((e as Error).message); }
      } finally {
        if (!controller.signal.aborted && current === sequence) setLoading(false);
      }
    }
    void refresh();
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = setInterval(focus, 15000);
    window.addEventListener('focus', focus); window.addEventListener('online', focus);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener('focus', focus); window.removeEventListener('online', focus); };
  }, [open, batchRef, version, revision, identity.subject]);
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>Vinculacion con catalogo</summary>
    {open && <>
      {error ? <p role="alert" className="op-error">{error}</p> : loading ? <p role="status">Consultando vinculacion...</p> : link ? <>
        <p>{link.product_ref ? `${link.product_name} · ${link.product_code}` : 'Sin producto de catalogo vinculado'}</p>
        {'supplier_name' in link && <p>Proveedor: {link.supplier_name ?? 'Sin proveedor vinculado'}</p>}
      </> : <p role="status">Sin detalle disponible.</p>}
      <button type="button" className="op-command" title="Actualizar vinculacion" aria-label="Actualizar vinculacion" onClick={() => setRevision(n => n + 1)}><RefreshCw size={16}/></button>
    </>}
  </details>;
}
