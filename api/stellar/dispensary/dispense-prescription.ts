import { dispensePrescriptionForPatient } from '../../_lib/stellar.js';

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
    const message =
      error instanceof Error
        ? error.message
        : 'No fue posible dispensar la receta en testnet.';

    if (/Error\(Contract,\s*#4\)|is_valid.*false|not valid|invalid|used|consum/i.test(message)) {
      res.status(409).json({
        code: 'PRESCRIPTION_NOT_VALID',
        message:
          'La receta no tiene cupo activo en el contrato actual. Para el MVP se debe emitir una nueva receta o usar el modo de retiro fraccionado.',
      });
      return;
    }

    res.status(500).json({
      message,
    });
  }
}
