import { SuiClient } from '@mysten/sui/client';
import type { NetworkType } from '../config/types';
import { networkConfig } from '../config/networkConfig';
import { getContractConfig } from '../config/contractConfig';

let currentNetwork: NetworkType = 'testnet';
let suiClient = new SuiClient({
  url: networkConfig[currentNetwork]?.url || networkConfig.testnet.url,
});

export function getCurrentNetwork(): NetworkType {
  return currentNetwork;
}

export function getSuiClient(): SuiClient {
  return suiClient;
}

export function updateNetwork(network: NetworkType) {
  currentNetwork = network;
  suiClient = new SuiClient({
    url: networkConfig[network]?.url || networkConfig.testnet.url,
  });
}

export function getPackageId(): string {
  return getContractConfig(currentNetwork).packageId;
}

export function getRegistryId(): string {
  return getContractConfig(currentNetwork).registryId;
}
