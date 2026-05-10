import { PasskeyKit } from 'passkey-kit/src/kit';
import { SignerStore } from 'passkey-kit/src/types';
import { getPasskeyRpId, stellarConfig, TRUST_LEAF_PASSKEY_APP } from './config';

const PASSKEY_STORAGE_KEY = 'trust_passkey_wallet';

export interface StoredPasskeyWallet {
  contractId: string;
  keyId: string;
  userLabel: string;
  createdAt: string;
}

export interface PasskeyWalletResult {
  contractId: string;
  keyId: string;
  userLabel: string;
}

function getKit() {
  if (!stellarConfig.walletWasmHash) {
    throw new Error(
      'Falta configurar VITE_STELLAR_WALLET_WASM_HASH para crear smart wallets con passkey en testnet.',
    );
  }

  return new PasskeyKit({
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
    walletWasmHash: stellarConfig.walletWasmHash,
  });
}

function persistStoredWallet(wallet: StoredPasskeyWallet) {
  localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(wallet));
}

async function sendPasskeyTransaction(xdr: string) {
  const response = await fetch('/api/passkeys/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ xdr }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || 'La transacción passkey no pudo enviarse a testnet.');
  }

  return response.json();
}

export function getStoredPasskeyWallet() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = localStorage.getItem(PASSKEY_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredPasskeyWallet;
  } catch {
    localStorage.removeItem(PASSKEY_STORAGE_KEY);
    return null;
  }
}

export function getPasskeyAvailability() {
  if (typeof window === 'undefined') {
    return {
      available: false,
      reason: 'Passkeys solo están disponibles en el navegador.',
    };
  }

  if (!window.PublicKeyCredential) {
    return {
      available: false,
      reason: 'Este navegador no soporta passkeys/WebAuthn.',
    };
  }

  if (!stellarConfig.walletWasmHash) {
    return {
      available: false,
      reason:
        'Falta VITE_STELLAR_WALLET_WASM_HASH para desplegar la smart wallet en testnet.',
    };
  }

  return {
    available: true,
    reason: null,
  };
}

export async function createPasskeyWallet(userLabel: string) {
  const kit = getKit();
  const result = await kit.createWallet(TRUST_LEAF_PASSKEY_APP, userLabel, {
    rpId: getPasskeyRpId(),
  });

  await sendPasskeyTransaction(result.signedTx.toXDR());

  const storedWallet: StoredPasskeyWallet = {
    contractId: result.contractId,
    keyId: result.keyIdBase64,
    userLabel,
    createdAt: new Date().toISOString(),
  };
  persistStoredWallet(storedWallet);

  return {
    contractId: result.contractId,
    keyId: result.keyIdBase64,
    userLabel,
  } satisfies PasskeyWalletResult;
}

export async function connectPasskeyWallet() {
  const storedWallet = getStoredPasskeyWallet();
  if (!storedWallet) {
    throw new Error('No hay una smart wallet con passkey guardada en este navegador.');
  }

  const kit = getKit();
  const result = await kit.connectWallet({
    rpId: getPasskeyRpId(),
    keyId: storedWallet.keyId,
    getContractId: async (keyId) => {
      if (keyId === storedWallet.keyId) {
        return storedWallet.contractId;
      }

      return storedWallet.contractId;
    },
  });

  persistStoredWallet({
    ...storedWallet,
    contractId: result.contractId,
    keyId: result.keyIdBase64,
  });

  return {
    contractId: result.contractId,
    keyId: result.keyIdBase64,
    userLabel: storedWallet.userLabel,
  } satisfies PasskeyWalletResult;
}

export async function connectOrCreatePasskeyWallet(userLabel: string) {
  const storedWallet = getStoredPasskeyWallet();
  if (storedWallet) {
    return connectPasskeyWallet();
  }

  return createPasskeyWallet(userLabel);
}

export async function addFreighterBackupSigner(publicKey: string) {
  const storedWallet = getStoredPasskeyWallet();
  if (!storedWallet) {
    throw new Error('Primero debes crear o conectar tu wallet con passkey.');
  }

  const kit = getKit();
  await kit.connectWallet({
    rpId: getPasskeyRpId(),
    keyId: storedWallet.keyId,
    getContractId: async () => storedWallet.contractId,
  });

  const addSignerTx = await kit.addEd25519(publicKey, undefined, SignerStore.Persistent);
  const signedTx = await kit.sign(addSignerTx, {
    rpId: getPasskeyRpId(),
    keyId: storedWallet.keyId,
  });

  await sendPasskeyTransaction(signedTx.toXDR());

  return {
    contractId: storedWallet.contractId,
    keyId: storedWallet.keyId,
  };
}
