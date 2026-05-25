import { fundTestnetAccount } from '../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const { role, address } = req.body ?? {};
    const result = await fundTestnetAccount({
      role: role ? String(role) as 'admin' | 'doctor' | 'dispensary' | 'patient' : undefined,
      address: address ? String(address) : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible fondear la cuenta en Stellar Testnet.',
    });
  }
}
