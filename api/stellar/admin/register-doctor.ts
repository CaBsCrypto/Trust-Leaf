import { registerDoctorOnTestnet } from '../../_lib/stellar.js';
import { assertTestnetMutationEnabled, sendPilotSafetyError } from '../../_lib/pilot-safety.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    assertTestnetMutationEnabled();
    const { doctorAddress } = req.body ?? {};

    if (!doctorAddress) {
      res.status(400).json({ message: 'Falta doctorAddress.' });
      return;
    }

    const result = await registerDoctorOnTestnet({
      doctorAddress: String(doctorAddress),
    });

    res.status(200).json(result);
  } catch (error) {
    sendPilotSafetyError(res, error, 'No fue posible registrar el medico en DoctorRegistry Testnet.');
  }
}
