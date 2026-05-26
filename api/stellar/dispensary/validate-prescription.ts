import { validatePrescriptionForDispensary } from '../../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const { prescriptionId } = req.body ?? {};
    const normalizedPrescriptionId = Number(prescriptionId);

    if (!Number.isFinite(normalizedPrescriptionId)) {
      res.status(400).json({
        message: 'Falta prescriptionId para validar la receta.',
      });
      return;
    }

    const result = await validatePrescriptionForDispensary({
      prescriptionId: normalizedPrescriptionId,
    });

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No fue posible validar la receta en testnet.';

    if (/missing|not found|PrescriptionMissing|#4/i.test(message)) {
      res.status(404).json({
        code: 'PRESCRIPTION_NOT_FOUND',
        message: 'No encontramos esa receta en el contrato Prescription de Testnet.',
      });
      return;
    }

    res.status(500).json({ message });
  }
}
