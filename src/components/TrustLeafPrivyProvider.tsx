import { lazy, Suspense, type ReactNode } from 'react';
import { readPrivyRuntimeConfig } from '../lib/privyConfig';
import { disabledPrivyIdentity, loadingPrivyIdentity, TrustLeafPrivyContext } from './privyIdentityContext';

const ActiveTrustLeafPrivyProvider = lazy(async () => {
  const module = await import('./ActiveTrustLeafPrivyProvider');
  return { default: module.ActiveTrustLeafPrivyProvider };
});

interface TrustLeafPrivyProviderProps {
  children: ReactNode;
}

export { useTrustLeafPrivyIdentity } from './privyIdentityContext';

/** A missing Privy dashboard setup must never break existing actor routes. */
export function TrustLeafPrivyProvider({ children }: TrustLeafPrivyProviderProps) {
  // Keep the public app resilient while Privy is being validated. Activation
  // requires an explicit Vercel flag instead of enabling from App ID alone.
  const config = import.meta.env.VITE_PRIVY_ENABLED === 'true'
    ? readPrivyRuntimeConfig(import.meta.env)
    : { enabled: false as const, reason: 'CONFIG_MISSING' as const };
  if (!config.enabled) {
    return <TrustLeafPrivyContext.Provider value={disabledPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>;
  }

  return (
    <Suspense fallback={<TrustLeafPrivyContext.Provider value={loadingPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>}>
      <ActiveTrustLeafPrivyProvider config={config}>{children}</ActiveTrustLeafPrivyProvider>
    </Suspense>
  );
}
