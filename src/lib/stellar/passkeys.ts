import { passkeyService } from './passkeyService';

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

export function getStoredPasskeyWallet(): StoredPasskeyWallet | null {
  const accounts = passkeyService.getRegisteredAccounts();
  if (accounts.length === 0) return null;
  
  // Return the first/active registered account
  const active = accounts[0];
  return {
    contractId: active.publicKey,
    keyId: active.credentialId,
    userLabel: active.username,
    createdAt: new Date(active.createdAt).toISOString(),
  };
}

export function getPasskeyAvailability() {
  const supported = passkeyService.isSupported();
  return {
    available: supported,
    reason: supported ? null : 'Este navegador no soporta passkeys/WebAuthn.',
  };
}

export async function createPasskeyWallet(
  userLabel: string,
  options?: { authenticatorAttachment?: 'platform' | 'cross-platform' }
) {
  // Call the robust, platform-native passkeyService register logic
  const acc = await passkeyService.register(userLabel, undefined, options?.authenticatorAttachment);
  
  return {
    contractId: acc.publicKey,
    keyId: acc.credentialId,
    userLabel: acc.username,
  } satisfies PasskeyWalletResult;
}

export async function connectPasskeyWallet() {
  // Call the robust, platform-native passkeyService login logic
  const acc = await passkeyService.login();
  
  return {
    contractId: acc.publicKey,
    keyId: acc.credentialId,
    userLabel: acc.username,
  } satisfies PasskeyWalletResult;
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

  // Under the proxy keypair architecture, freighter backup is treated as a successful mapping
  return {
    contractId: storedWallet.contractId,
    keyId: storedWallet.keyId,
  };
}
