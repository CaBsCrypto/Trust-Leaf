import { useState } from 'react';
import { ActiveTrustLeafPrivyProvider } from '../../components/ActiveTrustLeafPrivyProvider';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { readPrivyRuntimeConfig } from '../../lib/privyConfig';
import { requestFichaPilot } from './client';

const action = 'rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function FichaIdentityRebind() {
  const [previousToken, setPreviousToken] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const previous = readPrivyRuntimeConfig({ VITE_PRIVY_APP_ID: import.meta.env.VITE_TRUSTLEAF_LEGACY_PRIVY_APP_ID,
    VITE_PRIVY_CLIENT_ID: import.meta.env.VITE_TRUSTLEAF_LEGACY_PRIVY_CLIENT_ID });
  const shared = readPrivyRuntimeConfig(import.meta.env);
  const available = previous.enabled && shared.enabled && previous.appId !== shared.appId
    && import.meta.env.VITE_TRUSTLEAF_FICHA_LINK_SHARED_ENROLLMENT_ENABLED === 'true';
  const config = previousToken ? shared : previous;

  return <main className="min-h-screen bg-stone-100 px-4 py-12 text-stone-900">
    <section className="mx-auto max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Conservar mi cuenta anterior</h1>
      {!available || !config.enabled ? <p>El cambio de cuenta no está disponible en este entorno.</p> : complete ? <>
        <p role="status">Tu cuenta de Cannabis conserva sus permisos e historial.</p>
        <a className={action} href="/">Volver a TrustLeaf Cannabis</a>
      </> : <>
        <ActiveTrustLeafPrivyProvider key={config.appId} config={config}>
          <VerifyAccount key={config.appId} previousToken={previousToken} onPrevious={setPreviousToken}
            onComplete={() => { setPreviousToken(null); setComplete(true); }} />
        </ActiveTrustLeafPrivyProvider>
        {previousToken && <button type="button" className="underline" onClick={() => setPreviousToken(null)}>Empezar de nuevo</button>}
      </>}
    </section>
  </main>;
}

function VerifyAccount({ previousToken, onPrevious, onComplete }: {
  previousToken: string | null; onPrevious: (token: string) => void; onComplete: () => void;
}) {
  const identity = useTrustLeafPrivyIdentity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function next() {
    setError('');
    setBusy(true);
    try {
      if (!identity.authenticated) await identity.beginLogin();
      else if (previousToken) {
        await requestFichaPilot(identity, 'rebind-identity', {}, { previousIdentityToken: previousToken });
        onComplete();
      } else {
        const token = await identity.getIdentityToken();
        if (!token) throw new Error('AUTH_REQUIRED');
        onPrevious(token);
      }
    } catch (error) {
      setError(error instanceof Error && error.message === 'PILOT_CONFLICT'
        ? 'La cuenta nueva ya está asociada a otro perfil. Solicita revisión a administración.'
        : 'No pudimos confirmar ambas sesiones. Revisa la cuenta e inténtalo nuevamente.');
    } finally { setBusy(false); }
  }

  return <div className="space-y-3">
    <p>{previousToken ? 'Inicia sesión con la cuenta nueva de TrustLeaf que deseas usar en ambos portales.'
      : 'Inicia sesión con tu cuenta de Cannabis anterior para conservar su historial y permisos.'}</p>
    <button type="button" className={action} disabled={!identity.ready || busy || (identity.authenticated && identity.tokenReady === false)} onClick={() => void next()}>
      {!identity.authenticated ? 'Iniciar sesión' : previousToken ? 'Confirmar cambio de cuenta' : 'Confirmar cuenta anterior'}
    </button>
    {identity.authenticated && <button type="button" className="ml-3 underline" disabled={busy} onClick={() => void identity.logout().catch(() => setError('No pudimos cerrar esta sesión.'))}>
      Usar otra cuenta
    </button>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
  </div>;
}
