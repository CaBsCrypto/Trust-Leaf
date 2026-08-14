import { fundTestnetAccount } from '../_lib/stellar.js';
import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../_lib/pilot-safety.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    assertTestnetMutationEnabled();
    const { role, address } = req.body ?? {};
    const result = await fundTestnetAccount({
      role: role ? String(role) as 'admin' | 'doctor' | 'dispensary' | 'patient' : undefined,
      address: address ? String(address) : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    sendPilotSafetyError(res, error, 'No fue posible fondear la cuenta en Stellar Testnet.');
  }
}
