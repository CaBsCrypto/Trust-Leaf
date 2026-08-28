import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../../_lib/pilot-safety.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try { assertTestnetMutationEnabled(); }
  catch (error) { return sendPilotSafetyError(res, error, 'Operación no disponible.'); }
  return res.status(503).json({ code: 'PUBLIC_DEMO_DISABLED', message: 'La emisión no está disponible en la demo sintética.' });
}
