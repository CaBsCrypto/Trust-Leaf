import { createPasskeyServer } from '../../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  const passkeyServer = await createPasskeyServer();
  if (!passkeyServer || !process.env.STELLAR_MERCURY_URL) {
    res
      .status(503)
      .send(
        'Mercury no configurado. Define STELLAR_MERCURY_URL y credenciales para descubrir smart wallets por passkey.',
      );
    return;
  }

  try {
    const keyId = String(req.query.keyId || '');
    const contractId = await passkeyServer.getContractId({ keyId });
    res.status(200).send(contractId);
  } catch (error) {
    res
      .status(404)
      .send(
        error instanceof Error
          ? error.message
          : 'No fue posible resolver el contract id para esta passkey.',
      );
  }
}
