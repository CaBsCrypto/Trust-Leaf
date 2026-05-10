import { getRuntimeReadiness } from '../_lib/stellar.js';

export default async function handler(_req: any, res: any) {
  res.status(200).json(getRuntimeReadiness());
}
