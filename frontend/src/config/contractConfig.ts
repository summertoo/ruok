import type { NetworkType } from './types';

export type { NetworkType };

export interface ContractConfig {
  packageId: string;
  registryId: string;
}

export const getContractConfig = (network: NetworkType): ContractConfig => {
  const configs: Record<NetworkType, ContractConfig> = {
    testnet: {
      packageId: import.meta.env.VITE_TESTNET_PACKAGE_ID || '',
      registryId: import.meta.env.VITE_TESTNET_REGISTRY_ID || ''
    },
    mainnet: {
      packageId: import.meta.env.VITE_MAINNET_PACKAGE_ID || '',
      registryId: import.meta.env.VITE_MAINNET_REGISTRY_ID || ''
    },
    devnet: {
      packageId: import.meta.env.VITE_DEVNET_PACKAGE_ID || '',
      registryId: import.meta.env.VITE_DEVNET_REGISTRY_ID || ''
    }
  };

  return configs[network];
};

export const getPackageId = (network: NetworkType): string => {
  return getContractConfig(network).packageId;
};

export const getRegistryId = (network: NetworkType): string => {
  return getContractConfig(network).registryId;
};
