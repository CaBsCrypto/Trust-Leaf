import { issuePrescriptionForPatient } from '../../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const {
      patientAddress,
      treatment,
      dosage,
      notes,
      durationDays,
    } = req.body ?? {};

    if (!patientAddress || !treatment || !dosage || !durationDays) {
      res.status(400).json({
        message:
          'Faltan datos para emitir la receta: patientAddress, treatment, dosage y durationDays.',
      });
      return;
    }

    const normalizedDurationDays = Number(durationDays);
    if (!Number.isFinite(normalizedDurationDays) || normalizedDurationDays < 1) {
      res.status(400).json({
        message: 'durationDays debe ser un numero mayor o igual a 1.',
      });
      return;
    }

    const result = await issuePrescriptionForPatient({
      patientAddress: String(patientAddress),
      treatment: String(treatment),
      dosage: String(dosage),
      notes: notes ? String(notes) : '',
      durationDays: normalizedDurationDays,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible emitir la receta en testnet.',
    });
  }
}
