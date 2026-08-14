import { registerDispensaryOnTestnet } from '../../_lib/stellar.js';
import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../../_lib/pilot-safety.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    assertTestnetMutationEnabled();
    const { dispensaryAddress } = req.body ?? {};

    if (!dispensaryAddress) {
      res.status(400).json({ message: 'Falta dispensaryAddress.' });
      return;
    }

    const result = await registerDispensaryOnTestnet({
      dispensaryAddress: String(dispensaryAddress),
    });

    res.status(200).json(result);
  } catch (error) {
    sendPilotSafetyError(res, error, 'No fue posible registrar el dispensario en DispensaryRegistry Testnet.');
  }
}
