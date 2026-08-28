import { getContractsStatus, getRuntimeReadiness } from '../_lib/stellar.js';

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

  if (route === 'derive-wallet' || route === 'faucet') {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method Not Allowed' });
      return;
    }
    res.status(503).json({ message: 'La operación no está disponible en la demo sintética.' });
    return;
  }

  res.status(404).json({ message: 'Ruta Stellar no disponible.' });
}
