import { dispensePrescriptionForPatient } from '../../_lib/stellar';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const { prescriptionId, productLabel, batchLabel, quantity } = req.body ?? {};
    const normalizedPrescriptionId = Number(prescriptionId);
    const normalizedQuantity = Number(quantity);

    if (
      !Number.isFinite(normalizedPrescriptionId) ||
      !productLabel ||
      !batchLabel ||
      !Number.isFinite(normalizedQuantity)
    ) {
      res.status(400).json({
        message:
          'Faltan datos para dispensar: prescriptionId, productLabel, batchLabel y quantity.',
      });
      return;
    }

    const result = await dispensePrescriptionForPatient({
      prescriptionId: normalizedPrescriptionId,
      productLabel: String(productLabel),
      batchLabel: String(batchLabel),
      quantity: normalizedQuantity,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible dispensar la receta en testnet.',
    });
  }
}
