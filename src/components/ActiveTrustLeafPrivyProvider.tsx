import { useMemo, type ReactNode } from 'react';
import { getIdentityToken, PrivyProvider, useLogin, usePrivy } from '@privy-io/react-auth';
import type { PrivyRuntimeConfig } from '../lib/privyConfig';
import { TrustLeafPrivyContext, type TrustLeafPrivyIdentity } from './privyIdentityContext';

interface ActiveTrustLeafPrivyProviderProps {
  config: Extract<PrivyRuntimeConfig, { enabled: true }>;
  children: ReactNode;
}

function PrivyIdentityBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const value = useMemo<TrustLeafPrivyIdentity>(() => ({
    enabled: true,
    ready,
    authenticated,
    async beginLogin() {
      await login();
    },
    async getIdentityToken() {
      return getIdentityToken();
    },
  }), [authenticated, login, ready]);

  return <TrustLeafPrivyContext.Provider value={value}>{children}</TrustLeafPrivyContext.Provider>;
}

export function ActiveTrustLeafPrivyProvider({ config, children }: ActiveTrustLeafPrivyProviderProps) {
  const providerProps = config.clientId
    ? { appId: config.appId, clientId: config.clientId }
    : { appId: config.appId };
  return (
    <PrivyProvider
      {...providerProps}
    >
      <PrivyIdentityBridge>{children}</PrivyIdentityBridge>
    </PrivyProvider>
  );
}
