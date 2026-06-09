import { getDeterministicKeypair } from '../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ message: 'Falta email.' });
      return;
    }

    const normalized = email.toLowerCase().trim();
    if (normalized === 'paciente@trustleaf.test') {
      res.status(200).json({ publicKey: 'GDKCAFBRPVG4E6VEX4SUFVOMLDQKXDVEECR2DIWYRDEMIAS7CUR2RMXP' });
      return;
    }

    const keypair = getDeterministicKeypair(normalized);
    res.status(200).json({ publicKey: keypair.publicKey() });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Error al derivar la wallet en testnet.',
    });
  }
}
