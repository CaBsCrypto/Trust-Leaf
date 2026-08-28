import assert from 'node:assert/strict';
import { createSupabaseAuthGateway, readSupabaseAuthConfig } from '../src/lib/supabaseAuth.ts';

const disabled = createSupabaseAuthGateway({});
assert.deepEqual(disabled.status, { enabled: false, reason: 'FEATURE_DISABLED' });
assert.equal(await disabled.getSession(), null);
await assert.rejects(disabled.signInWithPassword({ email: 'fixture@example.invalid', password: 'not-used' }), error => (
  error as { code?: string }
).code === 'SUPABASE_AUTH_DISABLED');

assert.throws(() => readSupabaseAuthConfig({
  VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED: 'true',
  VITE_SUPABASE_URL: 'https://synthetic.supabase.invalid',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden_client_value',
}), error => (error as { code?: string }).code === 'SUPABASE_CLIENT_SECRET_FORBIDDEN');
assert.throws(() => readSupabaseAuthConfig({
  VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED: 'true',
  VITE_SUPABASE_URL: 'http://synthetic.supabase.invalid',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_AAAAAAAAAAAAAAAAAAAAAAAA',
}), error => (error as { code?: string }).code === 'SUPABASE_PROJECT_URL_INVALID');
assert.throws(() => readSupabaseAuthConfig({
  VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED: 'true',
  VITE_SUPABASE_URL: 'https://synthetic.supabase.invalid',
  VITE_SUPABASE_ANON_KEY: 'legacy-key-is-not-consumed',
}), error => (error as { code?: string }).code === 'SUPABASE_AUTH_CONFIG_MISSING');

assert.throws(() => readSupabaseAuthConfig({
  VITE_TRUSTLEAF_SUPABASE_AUTH_ENABLED: 'true',
  VITE_SUPABASE_URL: 'https://synthetic.supabase.invalid/path?ignored=no',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_AAAAAAAAAAAAAAAAAAAAAAAA',
}), error => (error as { code?: string }).code === 'SUPABASE_PROJECT_URL_INVALID');

console.log('supabase auth client: disabled gate, publishable-only config and secret/url negatives passed');
