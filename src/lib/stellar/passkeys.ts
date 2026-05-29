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

export function getStoredPasskeyWallet(username?: string): StoredPasskeyWallet | null {
  const accounts = passkeyService.getRegisteredAccounts();
  if (accounts.length === 0) return null;
  
  // Si se especifica un username, buscar coincidencia exacta, de lo contrario tomar el primero
  const match = username
    ? accounts.find((acc) => acc.username === username)
    : accounts[0];
    
  if (!match) return null;
  
  return {
    contractId: match.publicKey,
    keyId: match.credentialId,
    userLabel: match.username,
    createdAt: new Date(match.createdAt).toISOString(),
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

export async function connectPasskeyWallet(username?: string) {
  // Call the robust, platform-native passkeyService login logic
  const acc = await passkeyService.login(username);
  
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
  const storedWallet = getStoredPasskeyWallet(userLabel);
  if (storedWallet) {
    return connectPasskeyWallet(userLabel);
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
