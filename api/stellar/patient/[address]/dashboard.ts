import { getPatientDashboard } from '../../../_lib/stellar';

export default async function handler(req: any, res: any) {
  try {
    const address = String(req.query.address || '');
    if (!address) {
      res.status(400).json({ message: 'Falta la dirección del paciente.' });
      return;
    }

    const data = await getPatientDashboard(address);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible consultar el dashboard del paciente en testnet.',
    });
  }
}
