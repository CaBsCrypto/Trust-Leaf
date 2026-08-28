
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  return res.status(503).json({ code: 'PUBLIC_DEMO_DISABLED', message: 'El envío mediante passkeys está deshabilitado en la demo sintética.' });
}
