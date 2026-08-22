import { createSyntheticReceiptLedger } from '../_lib/receipt-ledger.js';
import { createReceiptService } from '../_lib/receipt-service.js';

const service = createReceiptService(createSyntheticReceiptLedger());

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });
  const operationId = globalThis.crypto.randomUUID();
  const result = await service.verifyPublic(req.body?.token, operationId);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.status(200).json(result);
}
