type ClientEnv = Readonly<Record<string, string | undefined>>;

export type PrivyRuntimeConfig =
  | { enabled: false; reason: 'CONFIG_MISSING' }
  | { enabled: true; appId: string; clientId?: string };

/**
 * Privy remains opt-in until the dashboard configuration is provisioned. The
 * browser receives only public identifiers; all secrets stay server-side.
 */
export function readPrivyRuntimeConfig(env: ClientEnv): PrivyRuntimeConfig {
  for (const [name, value] of Object.entries(env)) {
    if (!value?.trim()) continue;
    if (/^VITE_.*(?:PRIVY.*(?:SECRET|AUTHORIZATION)|APP_SECRET)/i.test(name)) {
      throw new Error('PRIVY_CLIENT_SECRET_FORBIDDEN');
    }
  }

  const appId = env.VITE_PRIVY_APP_ID?.trim();
  const clientId = env.VITE_PRIVY_CLIENT_ID?.trim();
  if (!appId) return { enabled: false, reason: 'CONFIG_MISSING' };
  if (!/^[A-Za-z0-9_-]{6,}$/.test(appId) || (clientId && !/^[A-Za-z0-9_-]{6,}$/.test(clientId))) {
    throw new Error('PRIVY_CLIENT_CONFIG_INVALID');
  }
  return { enabled: true, appId, clientId };
}
