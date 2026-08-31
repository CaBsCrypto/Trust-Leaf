import { useMemo, type ReactNode } from 'react';
import { getIdentityToken, PrivyProvider, useLogin, usePrivy } from '@privy-io/react-auth';
import type { PrivyRuntimeConfig } from '../lib/privyConfig';
import { TrustLeafPrivyContext, type TrustLeafPrivyIdentity } from './privyIdentityContext';

interface ActiveTrustLeafPrivyProviderProps {
  config: Extract<PrivyRuntimeConfig, { enabled: true }>;
  children: ReactNode;
}

function PrivyIdentityBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLogin();
  const value = useMemo<TrustLeafPrivyIdentity>(() => ({
    enabled: true,
    ready,
    authenticated,
    async beginLogin() {
      await login({ loginMethods: ['google', 'email', 'passkey', 'wallet'] });
    },
    async logout() {
      await logout();
    },
    async getIdentityToken() {
      return getIdentityToken();
    },
  }), [authenticated, login, logout, ready]);

  return <TrustLeafPrivyContext.Provider value={value}>{children}</TrustLeafPrivyContext.Provider>;
}

export function ActiveTrustLeafPrivyProvider({ config, children }: ActiveTrustLeafPrivyProviderProps) {
  const providerProps = config.clientId
    ? { appId: config.appId, clientId: config.clientId }
    : { appId: config.appId };
  return (
    <PrivyProvider
      {...providerProps}
      config={{ loginMethods: ['google', 'email', 'passkey', 'wallet'] }}
    >
      <PrivyIdentityBridge>{children}</PrivyIdentityBridge>
    </PrivyProvider>
  );
}
