import { getFullnodeUrl } from '@mysten/sui/client';

export type NetworkType = 'testnet' | 'mainnet' | 'devnet';

export const networkConfig = {
  testnet: {
    url: getFullnodeUrl('testnet'),
    name: 'Testnet',
    description: '测试网络'
  },
  mainnet: {
    url: getFullnodeUrl('mainnet'),
    name: 'Mainnet',
    description: '主网络'
  },
  devnet: {
    url: getFullnodeUrl('devnet'),
    name: 'Devnet',
    description: '开发网络'
  }
};

// 从环境变量获取默认网络，默认为testnet
export const getDefaultNetwork = (): NetworkType => {
  const envNetwork = import.meta.env.VITE_SUI_NETWORK as NetworkType;
  return envNetwork && ['testnet', 'mainnet', 'devnet'].includes(envNetwork) 
    ? envNetwork 
    : 'testnet';
};
