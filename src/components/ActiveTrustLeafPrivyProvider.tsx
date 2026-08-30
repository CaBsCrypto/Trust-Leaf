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
  return (
    <PrivyProvider
      appId={config.appId}
      clientId={config.clientId}
      config={{
        // Google keeps sign-in familiar for most patients; email OTP remains
        // available for people who do not want to use a social provider.
        loginMethods: ['google', 'email', 'passkey'],
        appearance: { theme: 'light', accentColor: '#1e4437' },
      }}
    >
      <PrivyIdentityBridge>{children}</PrivyIdentityBridge>
    </PrivyProvider>
  );
}
