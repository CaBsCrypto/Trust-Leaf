import { fundTestnetAccount, getContractsStatus, getDeterministicKeypair, getRuntimeReadiness } from '../_lib/stellar.js';
import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../_lib/pilot-safety.js';
import { createPrivyIdentityVerifier } from '../_lib/privy-identity.js';
import { createSupabasePrivyActorStore } from '../_lib/privy-supabase-rbac.js';

/**
 * Preview-only Vercel function consolidation. Exact rewrites below preserve the
 * public URLs of the static Stellar endpoints while keeping their original
 * method checks and fail-closed mutation guard.
 */
export default async function handler(req: any, res: any) {
  const route = String(req.query?.__trustleaf_route ?? 'readiness');

  if (route === 'readiness') {
    res.status(200).json(getRuntimeReadiness());
    return;
  }

  if (route === 'contracts') {
    try {
      res.status(200).json(await getContractsStatus());
    } catch {
      res.status(500).json({ message: 'No fue posible obtener el estado de los contratos en testnet.' });
    }
    return;
  }

  if (route === 'derive-wallet') {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method Not Allowed' });
      return;
    }
    if (!await authorizeConsolidatedRoute(req, res, '/api/stellar/derive-wallet')) return;
    try {
      const { email } = req.body ?? {};
      if (!email) {
        res.status(400).json({ message: 'Falta email.' });
        return;
      }
      const normalized = String(email).toLowerCase().trim();
      if (normalized === 'paciente@trustleaf.test') {
        res.status(200).json({ publicKey: 'GDKCAFBRPVG4E6VEX4SUFVOMLDQKXDVEECR2DIWYRDEMIAS7CUR2RMXP' });
        return;
      }
      res.status(200).json({ publicKey: getDeterministicKeypair(normalized).publicKey() });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Error al derivar la wallet en testnet.' });
    }
    return;
  }

  if (route === 'faucet') {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method Not Allowed' });
      return;
    }
    if (!await authorizeConsolidatedRoute(req, res, '/api/stellar/faucet')) return;
    try {
      assertTestnetMutationEnabled();
      const { role, address } = req.body ?? {};
      res.status(200).json(await fundTestnetAccount({
        role: role ? String(role) as 'admin' | 'doctor' | 'dispensary' | 'patient' : undefined,
        address: address ? String(address) : undefined,
      }));
    } catch (error) {
      sendPilotSafetyError(res, error, 'No fue posible fondear la cuenta en Stellar Testnet.');
    }
    return;
  }

  if (route === 'privy-session') {
    if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return resolvePrivySession(req, res);
  }

  if (route === 'privy-bootstrap-admin') {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return bootstrapPrivyAdmin(req, res);
  }

  if (route === 'privy-enroll-actor') {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return enrollPrivyActor(req, res);
  }

  res.status(404).json({ message: 'Ruta Stellar no disponible.' });
}

async function resolvePrivySession(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const token = readPrivyToken(req.headers ?? {});
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  try {
    const identity = await createPrivyIdentityVerifier(process.env).verify(token);
    const binding = await createSupabasePrivyActorStore(process.env).resolve(identity.subject);
    if (!binding) {
      return res.status(200).json({ authenticated: true, authorized: false });
    }
    return res.status(200).json({ authenticated: true, authorized: binding.state === 'active' && !isExpired(binding.validUntil), role: binding.role, state: binding.state, actorRef: binding.actorRef });
  } catch (error) {
    const candidate = error as { code?: string; statusCode?: number };
    return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'AUTH_UNAVAILABLE' });
  }
}

async function enrollPrivyActor(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const token = readPrivyToken(req.headers ?? {});
  const role = req.body?.role;
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  if (role !== 'patient' && role !== 'doctor' && role !== 'dispensary') return res.status(400).json({ code: 'ROLE_INVALID' });
  try {
    const identity = await createPrivyIdentityVerifier(process.env).verify(token);
    const actor = await createSupabasePrivyActorStore(process.env).enroll(identity.subject, role);
    return res.status(200).json({ authenticated: true, authorized: actor.state === 'active' && !isExpired(actor.validUntil), role: actor.role, state: actor.state, actorRef: actor.actorRef });
  } catch (error) {
    const candidate = error as { code?: string; statusCode?: number };
    return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'ENROLLMENT_UNAVAILABLE' });
  }
}

async function bootstrapPrivyAdmin(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const token = readPrivyToken(req.headers ?? {});
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  try {
    const identity = await createPrivyIdentityVerifier(process.env).verify(token);
    const allowedEmail = requiredBootstrapEmail(process.env.TRUSTLEAF_BOOTSTRAP_ADMIN_EMAIL);
    if (!identity.emails.includes(allowedEmail)) return res.status(403).json({ code: 'BOOTSTRAP_NOT_ALLOWED' });
    const actor = await createSupabasePrivyActorStore(process.env).bootstrapFirstAdmin(identity.subject);
    if (actor.role !== 'admin' || actor.state !== 'active') return res.status(503).json({ code: 'BOOTSTRAP_INVALID_RESULT' });
    return res.status(200).json({ authorized: true, role: 'admin', actorRef: actor.actorRef });
  } catch (error) {
    const candidate = error as { code?: string; statusCode?: number };
    // Emit only a stable category: never the Privy token, email, subject or database payload.
    console.error('Privy admin bootstrap denied.', {
      code: candidate.code ?? 'BOOTSTRAP_UNAVAILABLE',
      statusCode: candidate.statusCode ?? 503,
    });
    return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'BOOTSTRAP_UNAVAILABLE' });
  }
}

function readPrivyToken(headers: Record<string, string | string[] | undefined>) {
  const value = headers['privy-id-token'];
  return typeof value === 'string' && value.trim() && value.length <= 12_000 ? value.trim() : null;
}

function isExpired(value: string | undefined) { return Boolean(value && Date.parse(value) <= Date.now()); }

function requiredBootstrapEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Bootstrap configuration unavailable.'), { code: 'BOOTSTRAP_CONFIGURATION_MISSING', statusCode: 503 });
  }
  return email;
}

async function authorizeConsolidatedRoute(req: any, res: any, path: string) {
  res.locals ??= {};
  let allowed = false;
  const { createLegacyAuthorizationMiddleware } = await import('../_lib/legacy-route-authorization.js');
  const middleware = createLegacyAuthorizationMiddleware(process.env);
  await middleware({ ...req, path, headers: req.headers ?? {} }, res, () => { allowed = true; });
  return allowed;
}
