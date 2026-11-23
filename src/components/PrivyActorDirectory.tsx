import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import type { TrustLeafPrivyIdentity } from './privyIdentityContext';
import { readPrivyAdminJson } from '../lib/privyRead';
import './administration-review.css';

type Actor = { actorRef: string; email: string | null; role: string; state: string };
const labels: Record<string, string> = { admin: 'Administrador', doctor: 'Médico', dispensary: 'Dispensario', patient: 'Paciente', active: 'Activo', pending: 'Pendiente', suspended: 'Suspendido', revoked: 'Revocado', expired: 'Vencido' };

export default function PrivyActorDirectory({ identity }: { identity: TrustLeafPrivyIdentity }) {
  const headingId = useId();
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
    if (!identity.ready || identity.tokenReady === false) {
      const timeout = setTimeout(() => { setError(true); setLoading(false); }, 10000);
      return () => clearTimeout(timeout);
    }
    void (async () => {
      try {
        const payload = await readPrivyAdminJson<{ actors: Actor[]; nextOffset: number | null }>(`/api/auth/privy/admin/actors?offset=${page}`, identity, controller.signal);
        if (!Array.isArray(payload.actors)) throw new Error('DIRECTORY_INVALID');
        if (!cancelled) { setActors(payload.actors); setNextOffset(payload.nextOffset ?? null); }
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [page, revision, identity.subject, identity.ready, identity.tokenReady]);
  return <section className="tl-admin-directory" aria-labelledby={headingId}>
    <div className="tl-admin-directory-heading">
      <h2 id={headingId}>Actores registrados</h2>
      <button type="button" aria-label="Actualizar actores" disabled={loading} className="tl-admin-directory-button" onClick={() => setRevision(value => value + 1)}>
        <RefreshCw size={16} aria-hidden="true" /> Actualizar
      </button>
    </div>
    {loading ? <p role="status" className="tl-admin-directory-state">Cargando actores...</p>
      : error ? <p role="alert" className="tl-admin-directory-state is-error">No fue posible cargar los actores. Actualiza para reintentar.</p>
      : actors.length === 0 ? <p className="tl-admin-directory-state">No hay actores en esta página.</p>
      : <table className="tl-admin-directory-table" role="table" aria-labelledby={headingId}>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Correo de Privy</th>
            <th scope="col" role="columnheader">Rol</th>
            <th scope="col" role="columnheader">Estado</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {actors.map(actor => <tr key={actor.actorRef} role="row">
            <td role="cell"><span className="tl-admin-mobile-label" aria-hidden="true">Correo de Privy</span>{actor.email ?? 'No disponible'}</td>
            <td role="cell"><span className="tl-admin-mobile-label" aria-hidden="true">Rol</span>{labels[actor.role] ?? actor.role}</td>
            <td role="cell"><span className="tl-admin-mobile-label" aria-hidden="true">Estado</span><span className="tl-admin-record-status">{labels[actor.state] ?? actor.state}</span></td>
          </tr>)}
        </tbody>
      </table>}
    <nav className="tl-admin-directory-pages" aria-label="Paginación del directorio">
      <button type="button" aria-label="Pagina anterior" className="tl-admin-directory-button" disabled={loading || page === 0} onClick={() => setPage(Math.max(0, page - 25))}><ArrowLeft size={16} aria-hidden="true" /></button>
      <span role="status">Página {Math.floor(page / 25) + 1}</span>
      <button type="button" aria-label="Pagina siguiente" className="tl-admin-directory-button" disabled={loading || error || nextOffset === null} onClick={() => { if (nextOffset !== null) setPage(nextOffset); }}><ArrowRight size={16} aria-hidden="true" /></button>
    </nav>
  </section>;
}
