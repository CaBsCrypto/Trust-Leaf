import { registerDoctorOnTestnet } from '../../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
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
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible registrar el medico en DoctorRegistry Testnet.',
    });
  }
}
