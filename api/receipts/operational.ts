import { createSyntheticReceiptLedger } from '../_lib/receipt-ledger.js';
import { createReceiptService, identityFromHeaders } from '../_lib/receipt-service.js';

const service = createReceiptService(createSyntheticReceiptLedger());

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    const result = await service.getOperational(String(req.query?.handle || ''), identityFromHeaders(req.headers));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    const candidate = error as { statusCode?: number; code?: string };
    return res.status(candidate.statusCode || 500).json({ code: candidate.code || 'INTERNAL_ERROR' });
  }
}
