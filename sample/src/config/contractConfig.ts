import { NetworkType } from './networkConfig';

export interface ContractConfig {
  packageId: string;
  marketplaceId: string;
  capManagerId: string;
  listingCapId: string;
}

export const getContractConfig = (network: NetworkType): ContractConfig => {
  const configs: Record<NetworkType, ContractConfig> = {
    testnet: {
      packageId: import.meta.env.VITE_TESTNET_PACKAGE_ID || '',
      marketplaceId: import.meta.env.VITE_TESTNET_MARKETPLACE_ID || '',
      capManagerId: import.meta.env.VITE_TESTNET_CAP_MANAGER_ID || '',
      listingCapId: import.meta.env.VITE_TESTNET_LISTING_CAP_ID || ''
    },
    mainnet: {
      packageId: import.meta.env.VITE_MAINNET_PACKAGE_ID || '',
      marketplaceId: import.meta.env.VITE_MAINNET_MARKETPLACE_ID || '',
      capManagerId: import.meta.env.VITE_MAINNET_CAP_MANAGER_ID || '',
      listingCapId: import.meta.env.VITE_MAINNET_LISTING_CAP_ID || ''
    },
    devnet: {
      packageId: import.meta.env.VITE_DEVNET_PACKAGE_ID || '',
      marketplaceId: import.meta.env.VITE_DEVNET_MARKETPLACE_ID || '',
      capManagerId: import.meta.env.VITE_DEVNET_CAP_MANAGER_ID || '',
      listingCapId: import.meta.env.VITE_DEVNET_LISTING_CAP_ID || ''
    }
  };

  return configs[network];
};

export const getPackageId = (network: NetworkType): string => {
  return getContractConfig(network).packageId;
};

export const getMarketplaceId = (network: NetworkType): string => {
  return getContractConfig(network).marketplaceId;
};

export const getCapManagerId = (network: NetworkType): string => {
  return getContractConfig(network).capManagerId;
};

export const getListingCapId = (network: NetworkType): string => {
  return getContractConfig(network).listingCapId;
};
