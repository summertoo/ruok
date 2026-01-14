import { SuiClient } from '@mysten/sui/client';
import { NetworkType, networkConfig } from '../config/networkConfig';
import { getContractConfig } from '../config/contractConfig';

/**
 * 单个代币余额信息接口
 */
export interface CoinBalanceInfo {
  coinType: string;
  symbol: string;
  balance: number;
  balanceFormatted: number;
  decimals: number;
}

/**
 * 钱包余额信息接口（兼容WalletInfo组件）
 */
export interface BalanceInfo {
  sui: number;
  usdc: number;
}

/**
 * 余额检查服务
 */
export class BalanceService {
  private client: SuiClient;

  constructor(network: NetworkType = 'testnet') {
    this.client = new SuiClient({
      url: networkConfig[network].url,
    });
  }

  /**
   * 检查用户SUI余额是否足够支付交易费用
   */
  async checkSuiBalance(address: string, estimatedGas: number = 10000000): Promise<{
    hasBalance: boolean;
    balance: number;
    required: number;
    balanceInSUI: number;
    requiredInSUI: number;
  }> {
    try {
      const balance = await this.client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
      });
      
      const balanceInMist = Number(balance.totalBalance);
      const balanceInSUI = balanceInMist / 1000000000;
      const requiredInSUI = estimatedGas / 1000000000;
      
      console.log(`📍 SUI余额检查:`, {
        address,
        balance: balanceInMist,
        balanceInSUI,
        required: estimatedGas,
        requiredInSUI,
        hasEnough: balanceInMist >= estimatedGas
      });
      
      return {
        hasBalance: balanceInMist >= estimatedGas,
        balance: balanceInMist,
        required: estimatedGas,
        balanceInSUI,
        requiredInSUI
      };
    } catch (error) {
      console.error('检查SUI余额失败:', error);
      return {
        hasBalance: false,
        balance: 0,
        required: estimatedGas,
        balanceInSUI: 0,
        requiredInSUI: estimatedGas / 1000000000
      };
    }
  }

  /**
   * 检查用户是否有足够的指定代币余额
   */
  async checkTokenBalance(
    address: string, 
    tokenType: string, 
    requiredAmount: number
  ): Promise<{
    hasBalance: boolean;
    coinId?: string;
    balance: number;
    required: number;
    balanceFormatted: number;
    requiredFormatted: number;
    decimals: number;
    symbol: string;
  }> {
    try {
      console.log('🔍 检查用户代币余额...', {
        address,
        tokenType,
        requiredAmount
      });
      
      // 确保代币类型有 0x 前缀
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      const coins = await this.client.getCoins({
        owner: address,
        coinType: formattedTokenType,
      });

      console.log('📍 查询到的代币数量:', coins.data?.length || 0);

      // 检查coins.data是否存在且是数组
      if (!coins.data || !Array.isArray(coins.data) || coins.data.length === 0) {
        const symbol = this.getTokenSymbol(tokenType);
        console.log(`❌ 用户没有 ${symbol} (${tokenType}) 代币`);
        
        return {
          hasBalance: false,
          balance: 0,
          required: requiredAmount,
          balanceFormatted: 0,
          requiredFormatted: requiredAmount / Math.pow(10, this.getTokenDecimals(tokenType)),
          decimals: this.getTokenDecimals(tokenType),
          symbol
        };
      }

      // 计算总余额
      const totalBalance = coins.data.reduce((sum, coin) => sum + Number(coin.balance), 0);
      const decimals = this.getTokenDecimals(tokenType);
      const symbol = this.getTokenSymbol(tokenType);
      
      console.log('📍 代币余额详情:', {
        totalBalance,
        requiredAmount,
        decimals,
        symbol,
        hasEnough: totalBalance >= requiredAmount
      });

      if (totalBalance < requiredAmount) {
        const balanceFormatted = totalBalance / Math.pow(10, decimals);
        const requiredFormatted = requiredAmount / Math.pow(10, decimals);
        
        console.log(`❌ ${symbol} 余额不足: 实际 ${balanceFormatted}, 需要 ${requiredFormatted}`);
        return {
          hasBalance: false,
          balance: totalBalance,
          required: requiredAmount,
          balanceFormatted,
          requiredFormatted,
          decimals,
          symbol
        };
      }

      // 返回第一个代币的 ID
      const coinId = coins.data[0].coinObjectId;
      console.log('✅ 余额充足，找到代币 ID:', coinId);
      
      return {
        hasBalance: true,
        coinId,
        balance: totalBalance,
        required: requiredAmount,
        balanceFormatted: totalBalance / Math.pow(10, decimals),
        requiredFormatted: requiredAmount / Math.pow(10, decimals),
        decimals,
        symbol
      };
    } catch (error) {
      console.error('❌ 检查代币余额失败:', error);
      return {
        hasBalance: false,
        balance: 0,
        required: requiredAmount,
        balanceFormatted: 0,
        requiredFormatted: requiredAmount / Math.pow(10, this.getTokenDecimals(tokenType)),
        decimals: this.getTokenDecimals(tokenType),
        symbol: this.getTokenSymbol(tokenType)
      };
    }
  }

  /**
   * 获取代币精度
   */
  getTokenDecimals(tokenType: string): number {
    const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
    
    if (formattedTokenType.includes('sui::SUI')) return 9;
    if (formattedTokenType.includes('usdc') || formattedTokenType.includes('USDC')) return 6;
    if (formattedTokenType.includes('usdt') || formattedTokenType.includes('USDT')) return 6;
    // 特殊处理测试USDC
    if (formattedTokenType.includes('test_coin::TEST_COIN')) return 6;
    return 9; // 默认精度
  }

  /**
   * 获取代币符号
   */
  getTokenSymbol(tokenType: string): string {
    const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
    
    // 已知代币映射
    const knownTokens: { [key: string]: string } = {
      // 主网 USDC
      '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': 'USDC',
      // 测试网 USDC (从 coinmanager 项目)
      '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN': 'USDC',
      // SUI
      '0x2::sui::SUI': 'SUI',
      // USDT (示例)
      '0x6f9bae4d1e3c42d3b5ae5e1a9c2c9e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d::usdt::USDT': 'USDT',
    };
    
    // 首先检查精确匹配
    if (knownTokens[formattedTokenType]) {
      return knownTokens[formattedTokenType];
    }
    
    // 如果没有精确匹配，检查是否包含特定关键词
    if (formattedTokenType.includes('test_coin::TEST_COIN')) {
      return 'USDC';
    }
    if (formattedTokenType.includes('usdc::USDC') || formattedTokenType.includes('USDC')) {
      return 'USDC';
    }
    if (formattedTokenType.includes('sui::SUI')) {
      return 'SUI';
    }
    if (formattedTokenType.includes('usdt::USDT') || formattedTokenType.includes('USDT')) {
      return 'USDT';
    }
    
    return 'Unknown';
  }

  /**
   * 获取用户的所有代币余额信息
   */
  async getAllBalances(address: string): Promise<Array<{
    coinType: string;
    symbol: string;
    balance: number;
    balanceFormatted: number;
    decimals: number;
  }>> {
    try {
      const allCoins = await this.client.getAllCoins({
        owner: address,
      });

      // 检查allCoins.data是否存在且是数组
      if (!allCoins.data || !Array.isArray(allCoins.data)) {
        console.warn('⚠️ 获取用户所有代币失败，数据不是有效数组:', allCoins.data);
        return [];
      }

      console.log('🔍 获取到的所有代币:', allCoins.data.map(coin => ({
        coinType: coin.coinType,
        balance: coin.balance,
        symbol: this.getTokenSymbol(coin.coinType)
      })));

      const balances = new Map<string, any>();

      // 按代币类型分组并计算总余额
      allCoins.data.forEach(coin => {
        const coinType = coin.coinType;
        const symbol = this.getTokenSymbol(coinType);
        const decimals = this.getTokenDecimals(coinType);
        
        console.log(`📍 处理代币: ${coinType}, 符号: ${symbol}, 精度: ${decimals}, 原始余额: ${coin.balance}`);
        
        if (!balances.has(coinType)) {
          balances.set(coinType, {
            coinType,
            symbol,
            balance: 0,
            decimals
          });
        }
        balances.get(coinType).balance += Number(coin.balance);
      });

      // 格式化余额
      const result = Array.from(balances.values()).map(item => {
        const balanceFormatted = item.balance / Math.pow(10, item.decimals);
        console.log(`🔢 格式化 ${item.symbol}: 原始值 ${item.balance} ÷ 10^${item.decimals} = ${balanceFormatted}`);
        
        return {
          ...item,
          balanceFormatted
        };
      });

      console.log('📍 最终用户所有代币余额:', result.map(item => ({
        symbol: item.symbol,
        coinType: item.coinType,
        decimals: item.decimals,
        rawBalance: item.balance,
        formattedBalance: item.balanceFormatted
      })));
      return result;
    } catch (error) {
      console.error('获取用户所有代币余额失败:', error);
      return [];
    }
  }

  /**
   * 估算购买交易的总费用
   */
  async estimatePurchaseCost(
    address: string,
    price: number,
    tokenType: string
  ): Promise<{
    canAfford: boolean;
    suiBalance: any;
    tokenBalance: any;
    totalGasEstimate: number;
    recommendations: string[];
  }> {
    try {
      console.log('🔧 估算购买成本...', { address, price, tokenType });

      // 估算gas费用 (购买交易通常需要更多gas)
      const gasEstimate = 15000000; // 0.015 SUI 估算

      // 检查SUI余额
      const suiBalance = await this.checkSuiBalance(address, gasEstimate);

      // 检查代币余额
      const decimals = this.getTokenDecimals(tokenType);
      const requiredAmount = Math.ceil(price * Math.pow(10, decimals));
      const tokenBalance = await this.checkTokenBalance(address, tokenType, requiredAmount);

      const canAfford = suiBalance.hasBalance && tokenBalance.hasBalance;
      const recommendations: string[] = [];

      if (!suiBalance.hasBalance) {
        recommendations.push(`需要至少 ${suiBalance.requiredInSUI.toFixed(4)} SUI 用于支付交易费用`);
      }

      if (!tokenBalance.hasBalance) {
        recommendations.push(
          `需要 ${tokenBalance.requiredFormatted} ${tokenBalance.symbol}，当前只有 ${tokenBalance.balanceFormatted}`
        );
      }

      if (canAfford) {
        recommendations.push('余额充足，可以执行购买');
      }

      return {
        canAfford,
        suiBalance,
        tokenBalance,
        totalGasEstimate: gasEstimate,
        recommendations
      };
    } catch (error) {
      console.error('估算购买成本失败:', error);
      return {
        canAfford: false,
        suiBalance: { hasBalance: false, balance: 0, required: 0, balanceInSUI: 0, requiredInSUI: 0 },
        tokenBalance: { hasBalance: false, balance: 0, required: 0, balanceFormatted: 0, requiredFormatted: 0, decimals: 9, symbol: 'Unknown' },
        totalGasEstimate: 15000000,
        recommendations: ['无法估算交易成本，请检查网络连接']
      };
    }
  }

  /**
   * 更新网络配置
   */
  updateNetwork(network: NetworkType) {
    this.client = new SuiClient({
      url: networkConfig[network].url,
    });
  }

  /**
   * 获取Sui客户端
   */
  getSuiClient(): SuiClient {
    return this.client;
  }
}

// 导出单例实例
export const balanceService = new BalanceService();

// 导出便捷函数
export const checkSuiBalance = (address: string, estimatedGas?: number) => 
  balanceService.checkSuiBalance(address, estimatedGas);

export const checkTokenBalance = (address: string, tokenType: string, requiredAmount: number) => 
  balanceService.checkTokenBalance(address, tokenType, requiredAmount);

export const estimatePurchaseCost = (address: string, price: number, tokenType: string) => 
  balanceService.estimatePurchaseCost(address, price, tokenType);

export const getAllBalances = (address: string) => 
  balanceService.getAllBalances(address);

// 兼容WalletInfo组件的getAllBalances函数
export const getWalletBalances = async (address: string): Promise<BalanceInfo> => {
  try {
    const allBalances = await balanceService.getAllBalances(address);
    
    let suiBalance = 0;
    let usdcBalance = 0;

    allBalances.forEach(balance => {
      if (balance.symbol === 'SUI') {
        suiBalance = balance.balanceFormatted;
      } else if (balance.symbol === 'USDC') {
        usdcBalance = balance.balanceFormatted;
      }
    });

    return {
      sui: suiBalance,
      usdc: usdcBalance
    };
  } catch (error) {
    console.error('获取钱包余额失败:', error);
    return {
      sui: 0,
      usdc: 0
    };
  }
};

// 格式化函数
export const formatSUIBalance = (balance: number): string => {
  return `${balance.toFixed(4)} SUI`;
};

export const formatUSDCBalance = (balance: number): string => {
  return `${balance.toFixed(2)} USDC`;
};

// 获取当前网络
export const getCurrentNetwork = (): NetworkType => {
  return currentNetwork;
};

// 兼容性函数 - 用于其他组件的导入
export const updateNetwork = (network: string) => {
  console.log(`Network updated to: ${network}`);
  // 这个函数主要用于兼容性，实际的网络更新在networkConfig中处理
};

// 导出当前网络状态管理
let currentNetwork: NetworkType = 'testnet';

export function updateBalanceNetwork(network: NetworkType) {
  currentNetwork = network;
  balanceService.updateNetwork(network);
}

export function getCurrentBalanceNetwork(): NetworkType {
  return currentNetwork;
}
