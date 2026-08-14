import * as StellarSdk from '@stellar/stellar-sdk';
import {
  getNetworkPassphrase,
  getAdminSecret,
  getAdminAddress,
} from './stellar';

const DEFINDEX_API_BASE = 'https://api.defindex.io';
const DEFINDEX_XLM_VAULT_TESTNET =
  'CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6';
const DEFINDEX_SOROSWAP_USDC_VAULT_MAINNET =
  'CA2FIPJ7U6BG3N7EOZFI74XPJZOEOD4TYWXFVCIO5VDCHTVAGS6F4UKK';

export interface DefindexVaultInfo {
  address: string;
  label: string;
  assetCode: string;
  assetIssuer: string;
  network: 'testnet' | 'mainnet';
  decimals: number;
}

export const DEFINDEX_VAULTS: DefindexVaultInfo[] = [
  {
    address: DEFINDEX_XLM_VAULT_TESTNET,
    label: 'XLM Vault (Testnet)',
    assetCode: 'XLM',
    assetIssuer: 'native',
    network: 'testnet',
    decimals: 7,
  },
  {
    address: DEFINDEX_SOROSWAP_USDC_VAULT_MAINNET,
    label: 'Soroswap Earn USDC (Mainnet)',
    assetCode: 'USDC',
    assetIssuer: 'GA5ZSEJYB37JRC5AVCIAPEMGB2C4ZRVIASPFZ4ZKHZO2FOSX6CQ3ENZL',
    network: 'mainnet',
    decimals: 7,
  },
];

export function getDefindexApiKey(): string {
  return process.env.DEFINDEX_API_KEY?.trim() || '';
}

export function getDefindexNetwork(): 'testnet' | 'mainnet' {
  const envNetwork = process.env.DEFINDEX_NETWORK?.trim().toLowerCase();
  if (envNetwork === 'mainnet') return 'mainnet';
  return 'testnet';
}

export function getDefaultVaultAddress(): string {
  return (
    process.env.DEFINDEX_VAULT_DEFAULT?.trim() || DEFINDEX_XLM_VAULT_TESTNET
  );
}

export function getSocialFundAddress(): string {
  return process.env.DEFINDEX_SOCIAL_FUND_ADDRESS?.trim() || getAdminAddress();
}

export function getSocialFundKeypair(): StellarSdk.Keypair | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  return StellarSdk.Keypair.fromSecret(secret);
}

export function getVaultByAddress(address: string): DefindexVaultInfo | null {
  return DEFINDEX_VAULTS.find((v) => v.address === address) ?? null;
}

export interface DefindexBuildOptions {
  vaultAddress: string;
  caller: string;
  amountStroops: bigint;
  slippageBps?: number;
  invest?: boolean;
  network?: 'testnet' | 'mainnet';
}

export interface DefindexBuildSharesOptions {
  vaultAddress: string;
  caller: string;
  shares: bigint;
  slippageBps?: number;
  network?: 'testnet' | 'mainnet';
}

interface DefindexXdrResponse {
  xdr?: string;
  message?: string;
  error?: string;
}

interface DefindexSendResponse {
  txHash?: string;
  hash?: string;
  message?: string;
  error?: string;
}

interface DefindexBalanceResponse {
  shares?: string | number;
  balance?: string | number;
  dfTokens?: string | number;
  vault_shares?: string | number;
  message?: string;
  error?: string;
}

async function callDefindexApi<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): Promise<T> {
  const apiKey = getDefindexApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta DEFINDEX_API_KEY. Solicítala al equipo de Defindex y configúrala en .env',
    );
  }

  const url = `${DEFINDEX_API_BASE}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    const detail =
      payload.message || payload.error || `HTTP ${response.status}`;
    throw new Error(`Defindex API ${method} ${path} falló: ${detail}`);
  }

  return payload;
}

function normalizeAmount(amountStroops: bigint): number {
  const num = Number(amountStroops);
  if (!Number.isSafeInteger(num)) {
    throw new Error(
      `Amount ${amountStroops.toString()} excede el rango seguro para la API de Defindex. Usa Number[].`,
    );
  }
  return num;
}

export async function buildDefindexDeposit(
  opts: DefindexBuildOptions,
): Promise<string> {
  const network = opts.network ?? getDefindexNetwork();
  const payload = await callDefindexApi<DefindexXdrResponse>(
    `/vault/${opts.vaultAddress}/deposit?network=${network}`,
    'POST',
    {
      amounts: [normalizeAmount(opts.amountStroops)],
      caller: opts.caller,
      invest: opts.invest ?? true,
      slippageBps: opts.slippageBps ?? 50,
    },
  );

  if (!payload.xdr) {
    throw new Error('Defindex no devolvió XDR para el depósito.');
  }
  return payload.xdr;
}

export async function buildDefindexWithdraw(
  opts: DefindexBuildOptions,
): Promise<string> {
  const network = opts.network ?? getDefindexNetwork();
  const payload = await callDefindexApi<DefindexXdrResponse>(
    `/vault/${opts.vaultAddress}/withdraw?network=${network}`,
    'POST',
    {
      amounts: [normalizeAmount(opts.amountStroops)],
      caller: opts.caller,
      slippageBps: opts.slippageBps ?? 50,
    },
  );

  if (!payload.xdr) {
    throw new Error('Defindex no devolvió XDR para el retiro.');
  }
  return payload.xdr;
}

export async function buildDefindexWithdrawShares(
  opts: DefindexBuildSharesOptions,
): Promise<string> {
  const network = opts.network ?? getDefindexNetwork();
  const sharesNum = Number(opts.shares);
  if (!Number.isSafeInteger(sharesNum)) {
    throw new Error(
      `Shares ${opts.shares.toString()} excede el rango seguro para la API de Defindex.`,
    );
  }

  const payload = await callDefindexApi<DefindexXdrResponse>(
    `/vault/${opts.vaultAddress}/withdraw_shares?network=${network}`,
    'POST',
    {
      shares: sharesNum,
      caller: opts.caller,
      slippageBps: opts.slippageBps ?? 50,
    },
  );

  if (!payload.xdr) {
    throw new Error('Defindex no devolvió XDR para el retiro por shares.');
  }
  return payload.xdr;
}

export async function getDefindexShares(
  vaultAddress: string,
  address: string,
  network?: 'testnet' | 'mainnet',
): Promise<bigint> {
  const net = network ?? getDefindexNetwork();
  const payload = await callDefindexApi<DefindexBalanceResponse>(
    `/vault/${vaultAddress}/balance?network=${net}&address=${address}`,
    'GET',
  );

  const raw =
    payload.shares ?? payload.balance ?? payload.dfTokens ?? payload.vault_shares;

  if (raw === undefined || raw === null) {
    if (payload.message || payload.error) {
      throw new Error(
        `Defindex balance falló: ${payload.message || payload.error}`,
      );
    }
    return 0n;
  }

  try {
    return BigInt(raw);
  } catch {
    throw new Error(`Respuesta de balance de Defindex no numérica: ${raw}`);
  }
}

export async function submitDefindexSigned(signedXdr: string): Promise<string> {
  const network = getDefindexNetwork();
  const payload = await callDefindexApi<DefindexSendResponse>(
    `/send?network=${network}`,
    'POST',
    { xdr: signedXdr },
  );

  const txHash = payload.txHash || payload.hash;
  if (!txHash) {
    throw new Error(
      `Defindex /send no devolvió txHash. Respuesta: ${JSON.stringify(payload)}`,
    );
  }
  return txHash;
}

export interface SignAndSubmitOptions {
  unsignedXdr: string;
  signerKeypair: StellarSdk.Keypair;
  applyFeeSponsorship?: boolean;
}

export async function signAndSubmitDefindex(
  opts: SignAndSubmitOptions,
): Promise<{ txHash: string; signedXdr: string }> {
  const passphrase = getNetworkPassphrase();
  const parsed = StellarSdk.TransactionBuilder.fromXDR(
    opts.unsignedXdr,
    passphrase,
  );

  let txToSign: StellarSdk.Transaction = parsed as StellarSdk.Transaction;

  if (opts.applyFeeSponsorship !== false) {
    const sponsorSecret = getAdminSecret();
    if (sponsorSecret && txToSign.source !== getAdminAddress()) {
      const sponsorKeypair = StellarSdk.Keypair.fromSecret(sponsorSecret);
      const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
        sponsorKeypair.publicKey(),
        StellarSdk.BASE_FEE,
        txToSign,
        passphrase,
      );
      feeBump.sign(sponsorKeypair);
      const sponsoredXdr = feeBump
        .toEnvelope()
        .toXDR('base64') as string;
      const txHash = await submitDefindexSigned(sponsoredXdr);
      return { txHash, signedXdr: sponsoredXdr };
    }
  }

  txToSign.sign(opts.signerKeypair);
  const signedXdr = txToSign.toEnvelope().toXDR('base64') as string;
  const txHash = await submitDefindexSigned(signedXdr);
  return { txHash, signedXdr };
}

export interface SplitDepositOptions {
  vaultAddress: string;
  userAddress: string;
  userKeypair: StellarSdk.Keypair;
  totalAmountStroops: bigint;
  fundPercent: number;
  slippageBps?: number;
  invest?: boolean;
  network?: 'testnet' | 'mainnet';
}

export interface SplitDepositResult {
  userTxHash: string;
  fundTxHash: string | null;
  userAmountStroops: bigint;
  fundAmountStroops: bigint;
  fundPercent: number;
}

export async function executeSplitDeposit(
  opts: SplitDepositOptions,
): Promise<SplitDepositResult> {
  if (opts.fundPercent < 0 || opts.fundPercent > 100) {
    throw new Error('fundPercent debe estar entre 0 y 100.');
  }

  const userAmount =
    (opts.totalAmountStroops * BigInt(100 - opts.fundPercent)) / 100n;
  const fundAmount =
    (opts.totalAmountStroops * BigInt(opts.fundPercent)) / 100n;

  let userTxHash = '';
  let fundTxHash: string | null = null;

  if (userAmount > 0n) {
    const userXdr = await buildDefindexDeposit({
      vaultAddress: opts.vaultAddress,
      caller: opts.userAddress,
      amountStroops: userAmount,
      slippageBps: opts.slippageBps,
      invest: opts.invest,
      network: opts.network,
    });
    const userResult = await signAndSubmitDefindex({
      unsignedXdr: userXdr,
      signerKeypair: opts.userKeypair,
      applyFeeSponsorship: true,
    });
    userTxHash = userResult.txHash;
  } else {
    throw new Error(
      'El monto al usuario es 0 tras aplicar el split. Revisa fundPercent.',
    );
  }

  if (fundAmount > 0n) {
    const fundKeypair = getSocialFundKeypair();
    const fundAddress = getSocialFundAddress();
    if (!fundKeypair) {
      console.warn(
        '[Defindex Split] No hay Social Fund keypair configurado. Se omite la porción de fondo social.',
      );
    } else {
      const fundXdr = await buildDefindexDeposit({
        vaultAddress: opts.vaultAddress,
        caller: fundAddress,
        amountStroops: fundAmount,
        slippageBps: opts.slippageBps,
        network: opts.network,
      });
      const fundResult = await signAndSubmitDefindex({
        unsignedXdr: fundXdr,
        signerKeypair: fundKeypair,
        applyFeeSponsorship: false,
      });
      fundTxHash = fundResult.txHash;
    }
  }

  return {
    userTxHash,
    fundTxHash,
    userAmountStroops: userAmount,
    fundAmountStroops: fundAmount,
    fundPercent: opts.fundPercent,
  };
}

export function stroopsToDisplay(amountStroops: bigint, decimals = 7): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amountStroops / divisor;
  const fraction = amountStroops % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0');
  return `${whole.toString()}.${fractionStr}`;
}

export function displayToStroops(amount: string, decimals = 7): bigint {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Monto inválido: ${amount}`);
  }
  const [whole, fraction = ''] = normalized.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || '0');
}
