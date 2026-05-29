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
