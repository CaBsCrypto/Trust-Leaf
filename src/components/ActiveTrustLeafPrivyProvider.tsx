import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPrivyTokenCoordinator } from '../lib/privyTokenCoordinator';
import { usePrivySessionSync } from './usePrivySessionSync';
import { getIdentityToken, PrivyProvider, useIdentityToken, useLogin, usePrivy, useUser } from '@privy-io/react-auth';
import type { PrivyRuntimeConfig } from '../lib/privyConfig';
import { TrustLeafPrivyContext, type TrustLeafPrivyIdentity } from './privyIdentityContext';

interface ActiveTrustLeafPrivyProviderProps {
  config: Extract<PrivyRuntimeConfig, { enabled: true }>;
  children: ReactNode;
}

function PrivyIdentityBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout, user } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { refreshUser } = useUser();
  const { login } = useLogin();
  const refreshUserRef = useRef(refreshUser);
  useLayoutEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  const sessionToken = useRef({ subject: user?.id, token: identityToken });
  useLayoutEffect(() => { sessionToken.current = { subject: user?.id, token: identityToken }; }, [user?.id, identityToken]);
  const tokens = useMemo(() => createPrivyTokenCoordinator(
    async () => {
      if (!ready || !authenticated || sessionToken.current.subject !== user?.id) return null;
      // The SDK owns token rotation; ordinary reads need not refresh its user endpoint.
      return sessionToken.current.token ?? getIdentityToken();
    },
    async () => {
      if (!ready || !authenticated) return null;
      await refreshUserRef.current();
      return getIdentityToken();
    },
  ), [ready, authenticated, user?.id]);
  const currentTokens = useRef(tokens);
  useLayoutEffect(() => {
    currentTokens.current = tokens;
    tokens.activate();
    return () => tokens.invalidate();
  }, [tokens]);
  const syncing = usePrivySessionSync(ready, authenticated, user?.id, () => tokens.invalidate());
  const value = useMemo<TrustLeafPrivyIdentity>(() => ({
    enabled: true,
    ready: ready && !syncing,
    authenticated: authenticated && !syncing,
    subject: syncing ? undefined : user?.id,
    email: syncing ? undefined : user?.email?.address ?? user?.google?.email ?? undefined,
    tokenReady: ready && authenticated && !syncing && Boolean(identityToken),
    async refreshIdentityToken() {
      if (syncing || currentTokens.current !== tokens) return null;
      return tokens.refresh();
    },
    async beginLogin() {
      await login({ loginMethods: ['google', 'email', 'passkey', 'wallet'] });
    },
    async logout() {
      tokens.invalidate();
      try { await logout(); } catch (error) {
        if (currentTokens.current === tokens) tokens.activate();
        throw error;
      }
    },
    async getIdentityToken() {
      if (syncing || currentTokens.current !== tokens) return null;
      return tokens.read();
    },
  }), [authenticated, login, logout, ready, user?.id, user?.email?.address, user?.google?.email, identityToken, tokens, syncing]);

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
