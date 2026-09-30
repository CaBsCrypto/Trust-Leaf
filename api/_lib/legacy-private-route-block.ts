type LegacyPrivateRouteResponse = {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: { code: string }): unknown };
};

export function blockLegacyPrivateRoute(
  req: { method?: string },
  res: LegacyPrivateRouteResponse,
  allowedMethod: 'GET' | 'POST',
): void {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== allowedMethod) {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  res.status(410).json({ code: 'LEGACY_PRIVATE_ROUTE_DISABLED' });
}
