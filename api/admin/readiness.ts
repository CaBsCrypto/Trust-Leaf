import { createAdminReadinessController } from '../_lib/admin-readiness.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    const controller = createAdminReadinessController(process.env);
    return res.status(200).json(await controller(req.headers));
  } catch (error) {
    const candidate = error as { code?: string; statusCode?: number };
    return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'AUTH_UNAVAILABLE' });
  }
}
