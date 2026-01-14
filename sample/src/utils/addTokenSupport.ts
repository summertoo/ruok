import { getSuiClient } from '../services/contractService';
import { getContractConfig } from '../config/contractConfig';
import { getUSDCType } from '../config/tokenConfig';
import { Transaction } from '@mysten/sui/transactions';

/**
 * 添加USDC代币支持到市场
 * 需要管理员权限执行
 */
export async function addUSDCTokenSupport(signer: any): Promise<boolean> {
  try {
    console.log('🚀 开始添加USDC代币支持...');
    
    const client = getSuiClient();
    const config = getContractConfig('testnet');
    const usdcType = getUSDCType('testnet');
    
    console.log('📍 配置信息:', {
      packageId: config.packageId,
      marketplaceId: config.marketplaceId,
      usdcType
    });

    const tx = new Transaction();

    // 调用 add_supported_token 函数添加USDC支持
    tx.moveCall({
      target: `${config.packageId}::trading_object::add_supported_token`,
      typeArguments: [usdcType],
      arguments: [
        tx.object(config.marketplaceId)
      ]
    });

    console.log('📝 构建的交易:', tx);

    const result = await signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    });

    console.log('✅ 交易结果:', result);

    if (result.effects?.status?.status === 'success') {
      console.log('🎉 USDC代币支持添加成功！');
      return true;
    } else {
      console.error('❌ 交易失败:', result.effects?.status?.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 添加USDC代币支持失败:', error);
    return false;
  }
}

/**
 * 检查USDC代币是否已被支持
 */
export async function checkUSDCTokenSupport(): Promise<boolean> {
  try {
    const client = getSuiClient();
    const config = getContractConfig('testnet');
    
    const result = await client.getObject({
      id: config.marketplaceId,
      options: {
        showContent: true
      }
    });

    if (result.data?.content) {
      const content = result.data.content as any;
      const supportedTokens = content.fields.supported_tokens;
      
      if (supportedTokens && supportedTokens.fields && supportedTokens.fields.id) {
        const tableId = supportedTokens.fields.id.id;
        
        const tableResult = await client.getDynamicFields({
          parentId: tableId
        });
        
        if (tableResult.data) {
          const usdcType = getUSDCType('testnet');
          const hasUSDC = tableResult.data.some((field: any) => 
            field.name.value === usdcType ||
            field.name.value.includes('usdc') ||
            field.name.value.includes('test_coin')
          );
          
          console.log('📍 USDC支持检查结果:', hasUSDC);
          return hasUSDC;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ 检查USDC代币支持失败:', error);
    return false;
  }
}

/**
 * 获取当前支持的所有代币类型
 */
export async function getSupportedTokenTypes(): Promise<string[]> {
  try {
    const client = getSuiClient();
    const config = getContractConfig('testnet');
    
    const result = await client.getObject({
      id: config.marketplaceId,
      options: {
        showContent: true
      }
    });

    if (result.data?.content) {
      const content = result.data.content as any;
      const supportedTokens = content.fields.supported_tokens;
      
      if (supportedTokens && supportedTokens.fields && supportedTokens.fields.id) {
        const tableId = supportedTokens.fields.id.id;
        
        const tableResult = await client.getDynamicFields({
          parentId: tableId
        });
        
        if (tableResult.data) {
          return tableResult.data.map((field: any) => field.name.value);
        }
      }
    }
    
    return [];
  } catch (error) {
    console.error('❌ 获取支持的代币类型失败:', error);
    return [];
  }
}

/**
 * 批量添加多个代币支持
 */
export async function addMultipleTokenSupport(
  tokenTypes: string[],
  signer: any
): Promise<boolean> {
  try {
    console.log('🚀 开始批量添加代币支持...');
    
    const client = getSuiClient();
    const config = getContractConfig('testnet');
    
    const tx = new Transaction();

    // 为每个代币类型添加支持
    for (const tokenType of tokenTypes) {
      tx.moveCall({
        target: `${config.packageId}::trading_object::add_supported_token`,
        typeArguments: [tokenType],
        arguments: [
          tx.object(config.marketplaceId)
        ]
      });
    }

    console.log('📝 构建的批量交易:', tx);

    const result = await signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    });

    console.log('✅ 批量交易结果:', result);

    if (result.effects?.status?.status === 'success') {
      console.log('🎉 批量添加代币支持成功！');
      return true;
    } else {
      console.error('❌ 批量交易失败:', result.effects?.status?.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 批量添加代币支持失败:', error);
    return false;
  }
}

/**
 * 获取常用的代币类型列表
 */
export function getCommonTokenTypes(): string[] {
  return [
    '0x2::sui::SUI', // SUI
    '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN', // 测试网USDC
    '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN', // 主网USDC
  ];
}
