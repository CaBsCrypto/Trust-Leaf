import { blockLegacyPrivateRoute } from '../../../_lib/legacy-private-route-block.js';

export default async function handler(req: any, res: any) {
  blockLegacyPrivateRoute(req, res, 'GET');
}
