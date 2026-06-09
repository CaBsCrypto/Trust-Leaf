import {
  dispensePrescriptionForPatient,
  validatePrescriptionForDispensary,
  releasePrescriptionToPatient,
  retainPrescriptionForDispensary,
} from '../../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const { action } = req.query ?? {};

  try {
    if (action === 'validate-prescription') {
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
      return;
    }

    if (action === 'dispense-prescription') {
      const { prescriptionId, productLabel, batchLabel, quantity, dispensaryEmail, doctorEmail } = req.body ?? {};
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
        dispensaryEmail: dispensaryEmail ? String(dispensaryEmail) : undefined,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.status(200).json(result);
      return;
    }

    if (action === 'retain-prescription') {
      const { prescriptionId, dispensaryAddress, lockPeriodDays, doctorEmail } = req.body ?? {};
      const normalizedPrescriptionId = Number(prescriptionId);

      if (!Number.isFinite(normalizedPrescriptionId) || !dispensaryAddress) {
        res.status(400).json({
          message: 'Faltan datos para retener la receta: prescriptionId y dispensaryAddress.',
        });
        return;
      }

      const result = await retainPrescriptionForDispensary({
        prescriptionId: normalizedPrescriptionId,
        dispensaryAddress: String(dispensaryAddress),
        lockPeriodDays: lockPeriodDays ? Number(lockPeriodDays) : undefined,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.status(200).json(result);
      return;
    }

    if (action === 'release-prescription') {
      const { prescriptionId, doctorEmail } = req.body ?? {};
      const normalizedPrescriptionId = Number(prescriptionId);

      if (!Number.isFinite(normalizedPrescriptionId)) {
        res.status(400).json({
          message: 'Falta prescriptionId para liberar la receta.',
        });
        return;
      }

      const result = await releasePrescriptionToPatient({
        prescriptionId: normalizedPrescriptionId,
        doctorEmail: doctorEmail ? String(doctorEmail) : undefined,
      });

      res.status(200).json(result);
      return;
    }

    res.status(404).json({ message: `Action '${action}' not found.` });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No fue posible procesar la operación en el dispensario.';

    if (/Error\(Contract,\s*#4\)|is_valid.*false|not valid|invalid|used|consum/i.test(message)) {
      res.status(409).json({
        code: 'PRESCRIPTION_NOT_VALID',
        message:
          'La receta no tiene cupo activo en el contrato actual. Para el MVP se debe emitir una nueva receta o usar el modo de retiro fraccionado.',
      });
      return;
    }

    if (/Error\(Contract,\s*#8\)|QuantityExceeded|exceed|cupo|saldo/i.test(message)) {
      res.status(409).json({
        code: 'QUANTITY_EXCEEDS_ALLOWANCE',
        message:
          'La cantidad solicitada supera el saldo disponible de la receta. Reduce gramos o solicita una nueva evaluacion medica.',
      });
      return;
    }

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
