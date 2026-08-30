import { createPrivyIdentityVerifier } from '../../_lib/privy-identity.ts';
import { createSupabasePrivyActorStore } from '../../_lib/privy-supabase-rbac.ts';

/** Resolves the signed-in Privy DID to a private Trust Leaf actor binding. */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });

  const token = readIdentityToken(req.headers ?? {});
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });

  try {
    const identity = await createPrivyIdentityVerifier(process.env).verify(token);
    const binding = await createSupabasePrivyActorStore(process.env).resolve(identity.subject);
    if (!binding || binding.state !== 'active' || isExpired(binding.validUntil)) {
      return res.status(200).json({ authenticated: true, authorized: false });
    }
    return res.status(200).json({
      authenticated: true,
      authorized: true,
      role: binding.role,
      actorRef: binding.actorRef,
    });
  } catch (error) {
    const candidate = error as { code?: string; statusCode?: number };
    return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'AUTH_UNAVAILABLE' });
  }
}

function readIdentityToken(headers: Record<string, string | string[] | undefined>) {
  const value = headers['privy-id-token'];
  return typeof value === 'string' && value.trim() && value.length <= 12_000 ? value.trim() : null;
}

function isExpired(value: string | undefined) {
  return Boolean(value && Date.parse(value) <= Date.now());
}
