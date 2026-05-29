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
  // Use a fallback 32-byte dummy WASM hash to instantiate the kit safely for connections
  const hash = stellarConfig.walletWasmHash || '0000000000000000000000000000000000000000000000000000000000000000';
  return new PasskeyKit({
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
    walletWasmHash: hash,
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

  return {
    available: true,
    reason: null,
  };
}

export async function createPasskeyWallet(
  userLabel: string,
  options?: { authenticatorAttachment?: 'platform' | 'cross-platform' }
) {
  const kit = getKit();
  const result = await kit.createWallet(TRUST_LEAF_PASSKEY_APP, userLabel, {
    rpId: getPasskeyRpId(),
    authenticatorSelection: options?.authenticatorAttachment ? {
      authenticatorAttachment: options.authenticatorAttachment,
      residentKey: 'preferred',
      userVerification: 'preferred',
    } : {
      residentKey: 'preferred',
      userVerification: 'preferred',
    }
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
  const kit = getKit();

  if (storedWallet) {
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
  } else {
    // DISCOVERABLE CREDENTIAL FLOW (No stored wallet on this device/session)
    console.log('[Passkey Connect] Intentando flujo de credenciales descubribles...');
    const result = await kit.connectWallet({
      rpId: getPasskeyRpId(),
      getContractId: async (keyId) => {
        const response = await fetch(`/api/passkeys/contract/${keyId}`);
        if (!response.ok) {
          throw new Error('No se encontró ninguna Smart Wallet registrada para esta Passkey.');
        }
        const contractId = await response.text();
        return contractId;
      },
    });

    const newWallet: StoredPasskeyWallet = {
      contractId: result.contractId,
      keyId: result.keyIdBase64,
      userLabel: 'Smart Wallet Recuperada',
      createdAt: new Date().toISOString(),
    };
    persistStoredWallet(newWallet);

    return {
      contractId: result.contractId,
      keyId: result.keyIdBase64,
      userLabel: newWallet.userLabel,
    } satisfies PasskeyWalletResult;
  }
}

export async function connectOrCreatePasskeyWallet(
  userLabel: string,
  options?: { authenticatorAttachment?: 'platform' | 'cross-platform' }
) {
  const storedWallet = getStoredPasskeyWallet();
  if (storedWallet) {
    return connectPasskeyWallet();
  }

  return createPasskeyWallet(userLabel, options);
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
