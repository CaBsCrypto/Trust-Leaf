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
  const config = readPrivyRuntimeConfig(import.meta.env);
  if (!config.enabled) {
    return <TrustLeafPrivyContext.Provider value={disabledPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>;
  }

  return (
    <Suspense fallback={<TrustLeafPrivyContext.Provider value={loadingPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>}>
      <ActiveTrustLeafPrivyProvider config={config}>{children}</ActiveTrustLeafPrivyProvider>
    </Suspense>
  );
}
