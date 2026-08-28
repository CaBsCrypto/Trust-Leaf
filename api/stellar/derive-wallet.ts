export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  res.status(503).json({ message: 'La derivación de billeteras está deshabilitada en la demo sintética.' });
}
