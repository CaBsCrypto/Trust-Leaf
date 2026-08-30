import { fundTestnetAccount, getContractsStatus, getDeterministicKeypair, getRuntimeReadiness } from '../_lib/stellar.js';
import { createLegacyAuthorizationMiddleware } from '../_lib/legacy-route-authorization.ts';
import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../_lib/pilot-safety.js';

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

  res.status(404).json({ message: 'Ruta Stellar no disponible.' });
}

async function authorizeConsolidatedRoute(req: any, res: any, path: string) {
  res.locals ??= {};
  let allowed = false;
  const middleware = createLegacyAuthorizationMiddleware(process.env);
  await middleware({ ...req, path, headers: req.headers ?? {} }, res, () => { allowed = true; });
  return allowed;
}
