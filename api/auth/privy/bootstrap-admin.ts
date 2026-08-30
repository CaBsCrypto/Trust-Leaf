import { createPrivyIdentityVerifier } from '../../_lib/privy-identity.ts';
import { createSupabasePrivyActorStore } from '../../_lib/privy-supabase-rbac.ts';

/**
 * One-time administrative bootstrap. The server verifies the Privy token and
 * compares its linked email with a server-only Vercel allowlist before any DB
 * write. The client cannot nominate a role or an email.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });

  const token = readIdentityToken(req.headers ?? {});
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });

  try {
    const identity = await createPrivyIdentityVerifier(process.env).verify(token);
    const allowedEmail = requiredBootstrapEmail(process.env.TRUSTLEAF_BOOTSTRAP_ADMIN_EMAIL);
    if (!identity.emails.includes(allowedEmail)) {
      return res.status(403).json({ code: 'BOOTSTRAP_NOT_ALLOWED' });
    }
    const actor = await createSupabasePrivyActorStore(process.env).bootstrapFirstAdmin(identity.subject);
    if (actor.role !== 'admin' || actor.state !== 'active') {
      return res.status(503).json({ code: 'BOOTSTRAP_INVALID_RESULT' });
    }
    return res.status(200).json({ authorized: true, role: 'admin', actorRef: actor.actorRef });
  } catch (error) {
    const candidate = error as { code?: string; statusCode?: number };
    return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'BOOTSTRAP_UNAVAILABLE' });
  }
}

function readIdentityToken(headers: Record<string, string | string[] | undefined>) {
  const value = headers['privy-id-token'];
  return typeof value === 'string' && value.trim() && value.length <= 12_000 ? value.trim() : null;
}

function requiredBootstrapEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Bootstrap configuration unavailable.'), { code: 'BOOTSTRAP_CONFIGURATION_MISSING', statusCode: 503 });
  }
  return email;
}
