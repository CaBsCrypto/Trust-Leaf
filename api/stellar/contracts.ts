import { getContractsStatus } from '../_lib/stellar.js';

export default async function handler(_req: any, res: any) {
  try {
    const data = await getContractsStatus();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: 'No fue posible obtener el estado de los contratos en testnet.',
    });
  }
}
