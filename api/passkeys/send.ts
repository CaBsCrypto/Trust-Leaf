import { createPasskeyServer } from '../_lib/stellar.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const passkeyServer = await createPasskeyServer();
  if (!passkeyServer) {
    res
      .status(503)
      .send(
        'Passkey relayer no configurado. Define STELLAR_RELAYER_URL y STELLAR_RELAYER_API_KEY para testnet.',
      );
    return;
  }

  const { xdr } = req.body ?? {};
  if (!xdr || typeof xdr !== 'string') {
    res.status(400).send('Debe enviarse un XDR base64 válido.');
    return;
  }

  try {
    const result = await passkeyServer.send(xdr);
    res.status(200).json(result);
  } catch (error) {
    res
      .status(500)
      .send(
        error instanceof Error
          ? error.message
          : 'No fue posible enviar la transacción passkey a testnet.',
      );
  }
}
