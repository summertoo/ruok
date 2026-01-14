import { NetworkType } from './networkConfig';

/**
 * 代币配置文件
 * 包含测试代币的合约地址和类型信息
 */

// 测试网配置
export const TESTNET_CONFIG = {
  // 从 coinmanager 项目获取的包 ID
  PACKAGE_ID: '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962',
  
  // TreasuryCap 对象 ID（用于铸造和销毁代币）
  USDC_TREASURY_CAP: '0xd08ce224e193cfa6999d4d3d5e36af93ddd3bddf479ef8340496910529a0f6f3',
  
  // 测试网 USDC 代币类型 (从 coinmanager 项目)
  USDC_TYPE: '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN',
  
  // 代币小数位数
  USDC_DECIMALS: 6,
  
  // SUI 代币小数位数
  SUI_DECIMALS: 9,
};

// 主网配置
export const MAINNET_CONFIG = {
  PACKAGE_ID: '', // 需要部署后填入
  USDC_TREASURY_CAP: '', // 需要部署后填入
  
  // 主网 USDC 代币类型 (官方 USDC)
  // 注意：这是 Sui 主网上的官方 USDC 地址，需要确认
  USDC_TYPE: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
  
  // 代币小数位数
  USDC_DECIMALS: 6,
  SUI_DECIMALS: 9,
};

// 开发网配置
export const DEVNET_CONFIG = {
  PACKAGE_ID: '',
  USDC_TREASURY_CAP: '',
  USDC_TYPE: '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN',
  USDC_DECIMALS: 6,
  SUI_DECIMALS: 9,
};

// 获取指定网络的配置
export function getNetworkConfig(network: NetworkType) {
  switch (network) {
    case 'mainnet':
      return MAINNET_CONFIG;
    case 'devnet':
      return DEVNET_CONFIG;
    case 'testnet':
    default:
      return TESTNET_CONFIG;
  }
}

// 获取指定网络的 USDC 代币类型
export function getUSDCType(network: NetworkType = 'testnet'): string {
  const config = getNetworkConfig(network);
  return config.USDC_TYPE;
}

// 获取指定网络的代币信息
export function getTokenInfo(network: NetworkType = 'testnet') {
  const config = getNetworkConfig(network);
  const isTestnet = network === 'testnet';
  const isDevnet = network === 'devnet';
  
  return {
    SUI: {
      symbol: 'SUI',
      icon: '💧',
      decimals: 9,
      color: 'blue'
    },
    USDC: {
      symbol: 'USDC',
      name: isTestnet ? 'Test USDC' : (isDevnet ? 'Dev USDC' : 'USDC'),
      decimals: 6,
      icon: '💵',
      type: config.USDC_TYPE,
    },
  };
}

// 向后兼容的函数（使用默认网络）
export function getCurrentConfig() {
  return getNetworkConfig('testnet');
}
