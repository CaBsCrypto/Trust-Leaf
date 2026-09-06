import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import type { TrustLeafPrivyIdentity } from './privyIdentityContext';

type Actor = { actorRef: string; email: string | null; role: string; state: string };
const labels: Record<string, string> = { admin: 'Administrador', doctor: 'Medico', dispensary: 'Dispensario', patient: 'Paciente', active: 'Activo', pending: 'Pendiente', suspended: 'Suspendido', revoked: 'Revocado', expired: 'Vencido' };

export default function PrivyActorDirectory({ identity }: { identity: TrustLeafPrivyIdentity }) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [actors, setActors] = useState<Actor[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setActors([]);
    setNextOffset(null);
    void (async () => {
      try {
        const token = await identity.getIdentityToken();
        if (!token) throw new Error('SESSION_REQUIRED');
        const response = await fetch(`/api/auth/privy/admin/actors?offset=${page}`, { cache: 'no-store', headers: { 'privy-id-token': token }, signal: controller.signal });
        if (!response.ok) throw new Error('DIRECTORY_UNAVAILABLE');
        const payload = await response.json();
        if (!Array.isArray(payload.actors)) throw new Error('DIRECTORY_INVALID');
        if (!cancelled) { setActors(payload.actors); setNextOffset(payload.nextOffset ?? null); }
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [page, revision, identity.subject]);
  const buttonStyle = 'flex h-9 w-9 items-center justify-center rounded border border-brand-green-deep/20 disabled:opacity-40';
  return <section className="mt-8 border-t border-brand-green-deep/15 pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-serif">Actores registrados</h2><button type="button" title="Actualizar actores" aria-label="Actualizar actores" disabled={loading} className={buttonStyle} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /></button></div>
    {loading ? <p role="status" className="mt-4 text-sm">Cargando actores...</p> : error ? <p role="alert" className="mt-4 text-sm text-red-700">No fue posible cargar los actores. Actualiza para reintentar.</p> : actors.length === 0 ? <p className="mt-4 text-sm">No hay actores en esta pagina.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full table-fixed text-left text-sm"><thead><tr className="border-b"><th className="w-1/2 py-3 pr-3">Correo de Privy</th><th className="w-1/4 py-3 pr-3">Rol</th><th className="w-1/4 py-3">Estado</th></tr></thead><tbody>{actors.map(actor => <tr key={actor.actorRef} className="border-b border-brand-green-deep/10"><td className="break-words py-3 pr-3">{actor.email ?? 'No disponible'}</td><td className="break-words py-3 pr-3">{labels[actor.role] ?? actor.role}</td><td className="break-words py-3">{labels[actor.state] ?? actor.state}</td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex items-center justify-end gap-3"><button type="button" title="Pagina anterior" aria-label="Pagina anterior" className={buttonStyle} disabled={loading || page === 0} onClick={() => setPage(Math.max(0, page - 25))}><ArrowLeft size={16} /></button><span className="text-sm">{Math.floor(page / 25) + 1}</span><button type="button" title="Pagina siguiente" aria-label="Pagina siguiente" className={buttonStyle} disabled={loading || error || nextOffset === null} onClick={() => { if (nextOffset !== null) setPage(nextOffset); }}><ArrowRight size={16} /></button></div>
  </section>;
}
