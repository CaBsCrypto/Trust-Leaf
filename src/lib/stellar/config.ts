import * as StellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

export const STELLAR_TESTNET_NETWORK = 'TESTNET';
export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const TRUST_LEAF_PASSKEY_APP = 'Trust Leaf Testnet';

export const stellarConfig = {
  network: STELLAR_TESTNET_NETWORK,
  networkLabel: 'Stellar Testnet',
  rpcUrl:
    import.meta.env.VITE_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ?? STELLAR_TESTNET_PASSPHRASE,
  walletWasmHash: import.meta.env.VITE_STELLAR_WALLET_WASM_HASH ?? '',
} as const;

export function isTestnetPassphrase(passphrase?: string) {
  return passphrase === STELLAR_TESTNET_PASSPHRASE;
}

export function shortenAddress(value: string, size = 4) {
  if (!value || value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function getPasskeyRpId() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  let { hostname } = window.location;
  if (!hostname || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return undefined;
  }

  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }

  return hostname;
}

export async function deriveStellarPublicKey(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();

  // Compatibility mapping with default wallets
  if (normalized === 'medico@trustleaf.test') {
    return 'GDHHRMBOY22KGDH26KTQKTVNVGZ3GFHGL25ZT3HDTOST36U5V3L765RV';
  }
  if (normalized === 'dispensario@trustleaf.test') {
    return 'GDRERO3UET6MOXRL2BQRTBI4FB7RUY6DLNHOLLJC5WX4SYWHMJBZP4WX';
  }
  if (normalized === 'paciente@trustleaf.test') {
    return 'GDKCAFBRPVG4E6VEX4SUFVOMLDQKXDVEECR2DIWYRDEMIAS7CUR2RMXP';
  }

  try {
    const response = await fetch('/api/stellar/derive-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalized }),
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload.publicKey) {
        return payload.publicKey;
      }
    }
  } catch (error) {
    console.error('Error deriving wallet from backend API:', error);
  }

  // Deterministic hashing fallback
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized + 'trust-leaf-secret-salt-2026');
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  try {
    const keypair = StellarSdk.Keypair.fromRawEd25519Seed(Buffer.from(hashArray));
    return keypair.publicKey();
  } catch (e) {
    console.error('Error deriving keypair:', e);
    return '';
  }
}

