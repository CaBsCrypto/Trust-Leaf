import { createClient, type AuthChangeEvent, type Session, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseAuthRuntimeStatus =
  | { enabled: false; reason: 'FEATURE_DISABLED' }
  | { enabled: true; projectUrl: string };

export interface SupabaseAuthGateway {
  readonly status: SupabaseAuthRuntimeStatus;
  getSession(): Promise<Session | null>;
  getAccessToken(): Promise<string | null>;
  signInWithPassword(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  onSessionChange(listener: (session: Session | null, event: AuthChangeEvent) => void): () => void;
}

type ClientEnv = Readonly<Record<string, string | undefined>>;

/**
 * Browser integration boundary. It is inert unless the explicit feature gate is
 * enabled and only accepts Supabase's publishable-key format. Operational roles
 * are never read from browser metadata; the server/database resolves them.
 */
export function createSupabaseAuthGateway(
  env: ClientEnv,
  dependencies: { createClient?: typeof createClient } = {},
): SupabaseAuthGateway {
  const config = readSupabaseAuthConfig(env);
  if (config.enabled === false) return disabledGateway(config);

  const client = (dependencies.createClient ?? createClient)(config.projectUrl, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return enabledGateway(client, config.projectUrl);
}

export function readSupabaseAuthConfig(env: ClientEnv):
  | { enabled: false; reason: 'FEATURE_DISABLED' }
  | { enabled: true; projectUrl: string; publishableKey: string } {
  rejectSecretLikeClientConfig(env);
  if (env.VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED !== 'true') {
    return { enabled: false, reason: 'FEATURE_DISABLED' };
  }

  const rawUrl = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !publishableKey) throw authConfigError('SUPABASE_AUTH_CONFIG_MISSING');

  let projectUrl: URL;
  try { projectUrl = new URL(rawUrl); } catch { throw authConfigError('SUPABASE_PROJECT_URL_INVALID'); }
  if (projectUrl.protocol !== 'https:' || projectUrl.username || projectUrl.password || projectUrl.search || projectUrl.hash) {
    throw authConfigError('SUPABASE_PROJECT_URL_INVALID');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publishableKey)) {
    throw authConfigError('SUPABASE_PUBLISHABLE_KEY_INVALID');
  }
  return { enabled: true, projectUrl: projectUrl.origin, publishableKey };
}

function rejectSecretLikeClientConfig(env: ClientEnv) {
  for (const [name, value] of Object.entries(env)) {
    if (!value?.trim()) continue;
    if (/VITE_.*(?:SERVICE[_-]?ROLE|SECRET)/i.test(name) || /^sb_secret_/i.test(value.trim())) {
      throw authConfigError('SUPABASE_CLIENT_SECRET_FORBIDDEN');
    }
  }
}

function disabledGateway(status: Extract<SupabaseAuthRuntimeStatus, { enabled: false }>): SupabaseAuthGateway {
  const unavailable = async () => { throw authConfigError('SUPABASE_AUTH_DISABLED'); };
  return {
    status,
    async getSession() { return null; },
    async getAccessToken() { return null; },
    signInWithPassword: unavailable,
    signOut: unavailable,
    onSessionChange() { return () => undefined; },
  };
}

function enabledGateway(client: SupabaseClient, projectUrl: string): SupabaseAuthGateway {
  return {
    status: { enabled: true, projectUrl },
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw authConfigError('SUPABASE_SESSION_UNAVAILABLE');
      return data.session;
    },
    async getAccessToken() { return (await this.getSession())?.access_token ?? null; },
    async signInWithPassword(input) {
      const { error } = await client.auth.signInWithPassword(input);
      if (error) throw authConfigError('SUPABASE_SIGN_IN_FAILED');
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw authConfigError('SUPABASE_SIGN_OUT_FAILED');
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => listener(session, event));
      return () => data.subscription.unsubscribe();
    },
  };
}

function authConfigError(code: string) {
  return Object.assign(new Error('Supabase Auth is unavailable.'), { code });
}
