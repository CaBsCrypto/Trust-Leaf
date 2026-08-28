import { createHmac, timingSafeEqual } from 'node:crypto';
export const DEPLOYED_RECEIPT_CONTRACT_ID = 'CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3';
const CONTRACT = /^C[A-Z2-7]{55}$/; const TOKEN = /^tl_testnet_([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;
const UNAVAILABLE = { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' as const };
export type ReadonlyReceiptState = 'issued'|'active'|'partial'|'dispensed'|'revoked'|'expired';
export type PublicReadonlyResult = typeof UNAVAILABLE | { demo:true; evidenceExists:true; proofMatches:true; status:'active'|'revoked'|'expired' };
export interface ReceiptStatusReader { latest(receiptIdHex:string, signal:AbortSignal):Promise<ReadonlyReceiptState|null> }
const b64 = (bytes:Uint8Array) => Buffer.from(bytes).toString('base64url');
const equal = (a:string,b:string) => { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); };
export function createReadonlyReceiptVerifier(input:{contractId:string;tokenKey:string;submissionEnabled:string|undefined;reader:ReceiptStatusReader;timeoutMs?:number}) {
  if (input.contractId!==DEPLOYED_RECEIPT_CONTRACT_ID || !CONTRACT.test(input.contractId)) throw safe('CONTRACT_NOT_ALLOWLISTED');
  if (input.submissionEnabled!=='false') throw safe('SUBMISSION_FLAG_NOT_CLOSED'); if(input.tokenKey.length<32) throw safe('TOKEN_KEY_UNAVAILABLE');
  const timeoutMs=Math.max(100,Math.min(input.timeoutMs??4000,8000));
  return { async verify(raw:unknown):Promise<PublicReadonlyResult> { if(typeof raw!=='string'||raw.length>128)return UNAVAILABLE; const m=TOKEN.exec(raw); if(!m)return UNAVAILABLE;
    const bytes=Buffer.from(m[1],'base64url'); if(bytes.length!==32)return UNAVAILABLE; const expected=b64(createHmac('sha256',input.tokenKey).update(`trustleaf:testnet:receipt:v1:${m[1]}`).digest()); if(!equal(expected,m[2]))return UNAVAILABLE;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs); try { const state=await input.reader.latest(bytes.toString('hex'),controller.signal); const status=state==='revoked'?'revoked':state==='expired'?'expired':['active','partial'].includes(state??'')?'active':'unavailable'; return status==='unavailable'?UNAVAILABLE:{demo:true,evidenceExists:true,proofMatches:true,status}; } catch{return UNAVAILABLE;} finally{clearTimeout(timer);} } };
}
export function issueSyntheticReadonlyToken(id:string,key:string){if(!/^[a-f0-9]{64}$/.test(id)||key.length<32)throw safe('INVALID_SYNTHETIC_TOKEN_INPUT');const encoded=b64(Buffer.from(id,'hex'));return `tl_testnet_${encoded}.${b64(createHmac('sha256',key).update(`trustleaf:testnet:receipt:v1:${encoded}`).digest())}`;}
function safe(code:string){return Object.assign(new Error('Read-only receipt verification unavailable.'),{code});}
