import { createHash } from 'node:crypto';
import { createReadonlyReceiptVerifier, DEPLOYED_RECEIPT_CONTRACT_ID } from '../_lib/readonly-receipt-verifier.js';
import { createStellarReadonlyReceiptReader } from '../_lib/stellar-readonly-receipt-reader.js';
const unavailable = { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' };
const attempts = new Map<string,{window:number;count:number}>();
function allowed(ip:string){const key=createHash('sha256').update(ip).digest('hex').slice(0,16),window=Math.floor(Date.now()/60000),current=attempts.get(key);if(!current||current.window!==window){attempts.set(key,{window,count:1});return true;}current.count++;return current.count<=30;}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Pragma','no-cache');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json(unavailable);const ip=String(req.headers?.['x-forwarded-for']??req.socket?.remoteAddress??'').split(',')[0].trim();if(!allowed(ip))return res.status(429).json(unavailable);
  try{const contractId=process.env.STELLAR_RECEIPT_CONTRACT_ID??'';if(contractId!==DEPLOYED_RECEIPT_CONTRACT_ID)throw new Error('closed');const verifier=createReadonlyReceiptVerifier({contractId,tokenKey:process.env.TRUSTLEAF_PUBLIC_QR_HMAC_KEY??'',submissionEnabled:process.env.TRUSTLEAF_TESTNET_SUBMIT_ENABLED,reader:createStellarReadonlyReceiptReader({rpcUrl:process.env.STELLAR_RPC_URL??'',contractId,startLedger:Number(process.env.STELLAR_RECEIPT_START_LEDGER??4282700)})});return res.status(200).json(await verifier.verify(req.body?.token));}catch{return res.status(200).json(unavailable);}
}
