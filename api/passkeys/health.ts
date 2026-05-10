import { createPasskeyServer, getRpcUrl } from '../_lib/stellar.js';

export default async function handler(_req: any, res: any) {
  const configured = Boolean(await createPasskeyServer());

  res.status(200).json({
    configured,
    network: 'Stellar Testnet',
    rpcUrl: getRpcUrl(),
  });
}
