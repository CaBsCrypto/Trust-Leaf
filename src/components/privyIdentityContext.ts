import { createContext, useContext } from 'react';

export interface TrustLeafPrivyIdentity {
  enabled: boolean;
  ready: boolean;
  authenticated: boolean;
  subject?: string;
  beginLogin: () => Promise<void>;
  logout: () => Promise<void>;
  getIdentityToken: () => Promise<string | null>;
}

export const disabledPrivyIdentity: TrustLeafPrivyIdentity = {
  enabled: false,
  ready: true,
  authenticated: false,
  async beginLogin() {
    throw new Error('PRIVY_NOT_CONFIGURED');
  },
  async logout() {},
  async getIdentityToken() {
    return null;
  },
};

export const loadingPrivyIdentity: TrustLeafPrivyIdentity = {
  enabled: true,
  ready: false,
  authenticated: false,
  async beginLogin() {
    throw new Error('PRIVY_LOADING');
  },
  async logout() {},
  async getIdentityToken() {
    return null;
  },
};

export const TrustLeafPrivyContext = createContext<TrustLeafPrivyIdentity>(disabledPrivyIdentity);

export function useTrustLeafPrivyIdentity() {
  return useContext(TrustLeafPrivyContext);
}
