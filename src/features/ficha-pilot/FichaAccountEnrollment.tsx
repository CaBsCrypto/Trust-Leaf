import { useEffect, useState } from 'react';
import type { TrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { requestFichaPilot } from './client';

type Enrollment = { status: 'active'; associationStatus: 'active' | 'not_authorized'; accountUrl: string };
const actionClass = 'inline-flex min-h-10 items-center rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

async function completeEnrollment(identity: TrustLeafPrivyIdentity, authorizePrescriptionLinks: boolean, signal?: AbortSignal) {
  const response = await requestFichaPilot(identity, 'enroll-account', { authorizePrescriptionLinks }, { signal });
  const result: Enrollment = await response.json();
  const url = new URL(result.accountUrl);
  if (result.status !== 'active' || !['active', 'not_authorized'].includes(result.associationStatus)
    || url.pathname !== '/patient' || url.search !== '?tab=perfil' || url.hash || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('PILOT_UNAVAILABLE');
  }
  return result;
}

export default function FichaAccountEnrollment({ identity }: { identity: TrustLeafPrivyIdentity }) {
  const [account, setAccount] = useState<Enrollment | null>(null);
  const [grantSelected, setGrantSelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (identity.tokenReady === false) return;
    const request = new AbortController();
    void completeEnrollment(identity, false, request.signal).then(result => {
      if (!request.signal.aborted) { setAccount(result); setFailed(false); }
    }).catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [attempt, identity]);

  async function authorize() {
    if (!grantSelected || saving) return;
    setSaving(true);
    setFailed(false);
    try { setAccount(await completeEnrollment(identity, true)); } catch { setFailed(true); } finally { setSaving(false); }
  }

  return <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-stone-900" aria-labelledby="ficha-enrollment-heading">
    <h3 id="ficha-enrollment-heading" className="text-lg font-semibold">Mi cuenta TrustLeaf</h3>
    {failed && <p className="text-sm text-red-800" role="alert">No pudimos completar la conexión con TrustLeaf. Puedes reintentar y seguir usando Cannabis.</p>}
    {!account ? failed ? <button type="button" className={actionClass} onClick={() => { setFailed(false); setAttempt(i => i + 1); }}>Reintentar conexión</button>
      : <p role="status">Activando tu cuenta TrustLeaf…</p> : <>
      <a className={actionClass} href={account.accountUrl} rel="noreferrer">Abrir mi cuenta TrustLeaf</a>
      {account.associationStatus === 'active' ? <p role="status">Sincronización de referencias de recetas autorizada.</p> : <>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={grantSelected} onChange={event => setGrantSelected(event.target.checked)} />
          Permito que TrustLeaf Cannabis vincule las referencias de mis recetas con mi ficha TrustLeaf.
        </label>
        <button type="button" className={actionClass} disabled={!grantSelected || saving} onClick={() => void authorize()}>Autorizar sincronización</button>
      </>}
    </>}
  </section>;
}
