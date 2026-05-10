import {
  getAddress,
  getNetworkDetails,
  requestAccess,
} from '@stellar/freighter-api';
import { isTestnetPassphrase, stellarConfig } from './config';

export interface FreighterWalletConnection {
  address: string;
  network: string;
  networkPassphrase: string;
  sorobanRpcUrl?: string;
}

function normalizeFreighterError(message?: string) {
  if (!message) {
    return 'No fue posible conectar Freighter en este navegador.';
  }

  return message;
}

export async function connectFreighterOnTestnet(): Promise<FreighterWalletConnection> {
  const access = await requestAccess();
  if (access.error) {
    throw new Error(normalizeFreighterError(access.error.message));
  }

  const details = await getNetworkDetails();
  if (details.error) {
    throw new Error(normalizeFreighterError(details.error.message));
  }

  if (!isTestnetPassphrase(details.networkPassphrase)) {
    throw new Error('Freighter debe estar configurada en Stellar Testnet para continuar.');
  }

  const addressResponse = await getAddress();
  if (addressResponse.error || !addressResponse.address) {
    throw new Error(normalizeFreighterError(addressResponse.error?.message));
  }

  return {
    address: addressResponse.address,
    network: details.network || stellarConfig.network,
    networkPassphrase: details.networkPassphrase,
    sorobanRpcUrl: details.sorobanRpcUrl,
  };
}
