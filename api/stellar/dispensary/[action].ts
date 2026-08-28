import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../../_lib/pilot-safety.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  try { assertTestnetMutationEnabled(); }
  catch (error) { return sendPilotSafetyError(res, error, 'Operación no disponible.'); }
  return res.status(503).json({ code: 'PUBLIC_DEMO_DISABLED', message: 'Las acciones de dispensación no están disponibles en la demo sintética.' });
}
