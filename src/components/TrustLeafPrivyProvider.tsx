import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { readPrivyRuntimeConfig } from '../lib/privyConfig';
import { disabledPrivyIdentity, loadingPrivyIdentity, TrustLeafPrivyContext } from './privyIdentityContext';

const ActiveTrustLeafPrivyProvider = lazy(async () => {
  const module = await import('./ActiveTrustLeafPrivyProvider');
  return { default: module.ActiveTrustLeafPrivyProvider };
});

interface TrustLeafPrivyProviderProps {
  children: ReactNode;
}

interface PrivyBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface PrivyBoundaryState {
  hasError: boolean;
}

/** Keep an SDK configuration/runtime failure from blanking the whole portal. */
class PrivyBoundary extends Component<PrivyBoundaryProps, PrivyBoundaryState> {
  state: PrivyBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PrivyBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    console.error('Privy initialization failed; continuing without Privy.', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export { useTrustLeafPrivyIdentity } from './privyIdentityContext';

/** A missing Privy dashboard setup must never break existing actor routes. */
export function TrustLeafPrivyProvider({ children }: TrustLeafPrivyProviderProps) {
  // Keep the public app resilient while Privy is being validated. Activation
  // requires an explicit Vercel flag instead of enabling from App ID alone.
  const config = import.meta.env.VITE_PRIVY_ENABLED?.trim() === 'true'
    ? readPrivyRuntimeConfig(import.meta.env)
    : { enabled: false as const, reason: 'CONFIG_MISSING' as const };
  if (!config.enabled) {
    return <TrustLeafPrivyContext.Provider value={disabledPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>;
  }

  return (
    <PrivyBoundary
      fallback={<TrustLeafPrivyContext.Provider value={disabledPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>}
    >
      <Suspense fallback={<TrustLeafPrivyContext.Provider value={loadingPrivyIdentity}>{children}</TrustLeafPrivyContext.Provider>}>
        <ActiveTrustLeafPrivyProvider config={config}>{children}</ActiveTrustLeafPrivyProvider>
      </Suspense>
    </PrivyBoundary>
  );
}
