import { useEffect, useState } from 'react';

type AdminReadiness = {
  mode: 'read-only';
  submissionEnabled: false;
  mutationsAvailable: false;
  readiness: { ready: boolean; checks: Record<string, boolean>; blockers: string[] };
};

/** Read-only by construction: this component exposes no callbacks or mutation requests. */
export function AdminReadinessPanel({ getIdToken }: { getIdToken: () => Promise<string> }) {
  const [state, setState] = useState<AdminReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getIdToken().then(token => fetch('/api/admin/readiness', {
      method: 'GET', headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
    })).then(async response => {
      if (!response.ok) throw new Error('ADMIN_READINESS_UNAVAILABLE');
      const body = await response.json() as AdminReadiness;
      if (body.mode !== 'read-only' || body.submissionEnabled !== false || body.mutationsAvailable !== false) throw new Error('ADMIN_READINESS_UNSAFE');
      if (active) setState(body);
    }).catch(() => { if (active) setError('Readiness no disponible. Acceso cerrado.'); });
    return () => { active = false; };
  }, [getIdToken]);

  if (error) return <section aria-live="polite"><h2>Admin read-only</h2><p>{error}</p></section>;
  if (!state) return <section aria-busy="true"><h2>Admin read-only</h2><p>Verificando autorizacion…</p></section>;
  return <section>
    <h2>Admin read-only</h2>
    <p>Submissions Testnet: deshabilitadas</p>
    <p>Estado: {state.readiness.ready ? 'preparado para revision' : 'bloqueado'}</p>
    <ul>{state.readiness.blockers.map(code => <li key={code}>{code}</li>)}</ul>
  </section>;
}
