import { marketplaceService } from '../services/marketplaceService';
import { getUSDCType } from '../config/tokenConfig';

/**
 * 检查并确保USDC代币被市场支持
 */
export async function ensureUSDCTokenSupport(): Promise<boolean> {
  try {
    console.log('🔍 检查USDC代币支持状态...');
    
    // 获取当前支持的代币类型
    const supportedTokens = await marketplaceService.getSupportedTokenTypes();
    console.log('📍 当前支持的代币类型:', supportedTokens);
    
    // 获取USDC代币类型
    const usdcType = getUSDCType('testnet'); // 假设使用testnet
    console.log('📍 USDC代币类型:', usdcType);
    
    // 检查USDC是否已被支持
    const isUSDCSupported = supportedTokens.some(token => 
      token.toLowerCase() === usdcType.toLowerCase() ||
      token.toLowerCase().includes('usdc') ||
      token.toLowerCase().includes('test_coin')
    );
    
    console.log('📍 USDC支持状态:', isUSDCSupported);
    
    if (!isUSDCSupported) {
      console.warn('⚠️ USDC代币未被市场支持，需要管理员添加支持');
      console.log('💡 建议执行以下操作:');
      console.log('1. 使用管理员账户调用 add_supported_token 函数');
      console.log('2. 传入USDC代币类型:', usdcType);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ 检查USDC代币支持失败:', error);
    return false;
  }
}

/**
 * 获取代币类型的标准化显示名称
 */
export function getTokenDisplayName(tokenType: string): string {
  if (tokenType.includes('USDC') || tokenType.includes('test_coin')) {
    return 'USDC';
  }
  if (tokenType.includes('SUI')) {
    return 'SUI';
  }
  if (tokenType.includes('USDT')) {
    return 'USDT';
  }
  
  // 从类型字符串中提取最后部分
  const parts = tokenType.split('::');
  if (parts.length >= 3) {
    return parts[2];
  }
  
  return tokenType;
}

/**
 * 验证代币类型格式
 */
export function validateTokenType(tokenType: string): boolean {
  // 基本格式检查
  if (!tokenType || typeof tokenType !== 'string') {
    return false;
  }
  
  // 检查是否包含基本的包结构
  const parts = tokenType.split('::');
  if (parts.length < 3) {
    return false;
  }
  
  // 检查地址格式（第一部分应该是0x开头的地址）
  const address = parts[0];
  if (!address.startsWith('0x') || address.length !== 66) {
    return false;
  }
  
  return true;
}

/**
 * 获取所有可能的USDC代币类型变体
 */
export function getUSDCTypeVariants(): string[] {
  return [
    '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN', // 测试网USDC
    '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN', // 主网USDC
    '0x2::sui::SUI', // SUI
  ];
}
