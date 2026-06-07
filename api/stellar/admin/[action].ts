import {
  registerDoctorOnTestnet,
  registerDispensaryOnTestnet,
  revokeDoctorOnTestnet,
  revokeDispensaryOnTestnet,
} from '../../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const { action } = req.query ?? {};

  try {
    if (action === 'register-doctor') {
      const { doctorAddress } = req.body ?? {};
      if (!doctorAddress) {
        res.status(400).json({ message: 'Falta doctorAddress.' });
        return;
      }
      const result = await registerDoctorOnTestnet({
        doctorAddress: String(doctorAddress),
      });
      res.status(200).json(result);
      return;
    }

    if (action === 'register-dispensary') {
      const { dispensaryAddress } = req.body ?? {};
      if (!dispensaryAddress) {
        res.status(400).json({ message: 'Falta dispensaryAddress.' });
        return;
      }
      const result = await registerDispensaryOnTestnet({
        dispensaryAddress: String(dispensaryAddress),
      });
      res.status(200).json(result);
      return;
    }

    if (action === 'revoke-doctor') {
      const { doctorAddress } = req.body ?? {};
      if (!doctorAddress) {
        res.status(400).json({ message: 'Falta doctorAddress.' });
        return;
      }
      const result = await revokeDoctorOnTestnet({
        doctorAddress: String(doctorAddress),
      });
      res.status(200).json(result);
      return;
    }

    if (action === 'revoke-dispensary') {
      const { dispensaryAddress } = req.body ?? {};
      if (!dispensaryAddress) {
        res.status(400).json({ message: 'Falta dispensaryAddress.' });
        return;
      }
      const result = await revokeDispensaryOnTestnet({
        dispensaryAddress: String(dispensaryAddress),
      });
      res.status(200).json(result);
      return;
    }

    res.status(404).json({ message: `Action '${action}' not found.` });
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible procesar la operación en el portal administrativo de Testnet.',
    });
  }
}
