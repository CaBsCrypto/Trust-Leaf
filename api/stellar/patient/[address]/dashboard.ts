export default async function handler(_req: any, res: any) {
  return res.status(503).json({ code: 'PUBLIC_DEMO_DISABLED', message: 'La consulta de dashboards legacy está deshabilitada en la demo sintética.' });
}
