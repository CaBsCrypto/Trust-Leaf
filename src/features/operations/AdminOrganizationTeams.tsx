import { useEffect, useState } from 'react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { readPrivyAdminJson } from '../../lib/privyRead';
import type { Membership, Organization } from './contracts';

type Actor = { actorRef: string; email: string | null };
type Directory = { actors: Actor[]; nextOffset: number | null };

export default function AdminOrganizationTeams({ organizations, members, search, revision }: {
  organizations: Organization[]; members: Membership[]; search: string; revision: number;
}) {
  const identity = useTrustLeafPrivyIdentity();
  const [emails, setEmails] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recovery, setRecovery] = useState(0);
  const membershipKey = members.map(member => `${member.organization_ref}:${member.actor_ref}:${member.role}`).sort().join('|');
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setRecovery(value => value + 1); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setEmails({}); setLoading(true); setError(false);
    async function load() {
      const result: Record<string, string | null> = {};
      const seen = new Set<number>();
      let offset: number | null = 0;
      while (offset !== null) {
        if (seen.has(offset)) throw new Error('DIRECTORY_INVALID');
        seen.add(offset);
        const page: Directory = await readPrivyAdminJson<Directory>(`/api/auth/privy/admin/actors?offset=${offset}`, identity, controller.signal);
        if (!Array.isArray(page.actors)) throw new Error('DIRECTORY_INVALID');
        for (const actor of page.actors) result[actor.actorRef] = actor.email;
        offset = page.nextOffset;
        if (offset !== null && (!Number.isSafeInteger(offset) || offset < 0)) throw new Error('DIRECTORY_INVALID');
      }
      if (!controller.signal.aborted) setEmails(result);
    }
    void load().catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [identity.subject, identity.ready, identity.tokenReady, revision, recovery, membershipKey]);
  const query = search.trim().toLocaleLowerCase();
  return <>
    {loading && <p role="status">Cargando correos del equipo...</p>}
    {error && <p role="alert">No fue posible cargar los correos. Actualiza los datos para reintentar.</p>}
    {organizations.filter(o => `${o.name} ${o.organization_ref}`.toLocaleLowerCase().includes(query)).map(org => {
      const team = members.filter(member => member.organization_ref === org.organization_ref);
      return <article className="op-row" key={org.organization_ref}>
        <h3>{org.name}</h3><p className="op-reference">{org.organization_ref}</p>
        {!team.length && <p>Sin miembros actuales.</p>}
        {team.map(member => <div className="op-line" key={member.actor_ref}>
          <span><span>{loading ? 'Cargando correo...' : emails[member.actor_ref] ?? 'Correo no disponible'}</span>
            <small>{member.role === 'manager' ? 'Encargado' : 'Operador'}</small></span>
        </div>)}
      </article>;
    })}
  </>;
}
