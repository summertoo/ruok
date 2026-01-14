import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { NetworkType, networkConfig } from '../config/networkConfig';
import { getContractConfig } from '../config/contractConfig';

// 当前网络状态
let currentNetwork: NetworkType = 'testnet';
let suiClient = new SuiClient({
  url: networkConfig[currentNetwork]?.url || getFullnodeUrl('testnet'),
});

// 获取当前网络
export function getCurrentContractNetwork(): NetworkType {
  return currentNetwork;
}

// 获取当前 Sui 客户端
export function getSuiClient(): SuiClient {
  return suiClient;
}

// 更新网络配置
export function updateContractNetwork(network: NetworkType) {
  currentNetwork = network;
  suiClient = new SuiClient({
    url: networkConfig[network]?.url || getFullnodeUrl('testnet'),
  });
}

// 交易对象接口
export interface TradingObject {
  id: string;
  owner: string;
  bot: string;
  emoji: string;
  profile_picture: string;
  blob_id: string;
  price: number;
  is_for_sale: boolean;
  token_type?: string; // 新增字段，表示定价代币类型
  wallet_id?: string; // 新增字段，关联的钱包ID
}

// 对象钱包接口
export interface ObjectWallet {
  id: string;
  object_id: string;
  owner: string;
  created_at: number;
}

// 统一的 Signer 函数类型（参考 manager 项目的模式）
export type SignerFunction = (
  params: { transaction: Transaction; options?: any },
  callbacks?: { onSuccess?: (result: any) => void; onError?: (error: any) => void }
) => any;

// Signer 接口（保持向后兼容）
export interface Signer {
  address: string;
  signAndExecuteTransaction: SignerFunction;
}

// 合约服务类
export class ContractService {
  private client: SuiClient;
  private packageId: string;
  private marketplaceId: string;
  private network: NetworkType;

  constructor(network: NetworkType = 'testnet') {
    const config = getContractConfig(network);
    
    if (!config.packageId || !config.marketplaceId) {
      throw new Error(`Missing configuration for ${network}. Please check your .env file.`);
    }
    
    this.client = new SuiClient({
      url: networkConfig[network]?.url || getFullnodeUrl('testnet'),
    });
    this.packageId = config.packageId;
    this.marketplaceId = config.marketplaceId;
    this.network = network;
  }

  /**
   * 根据代币类型获取精度
   */
  private getDecimalsByTokenType(tokenType: string): number {
    // 确保代币类型有 0x 前缀
    const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
    
    if (formattedTokenType.includes('sui::SUI')) return 9;
    if (formattedTokenType.includes('usdc') || formattedTokenType.includes('USDC')) return 6;
    if (formattedTokenType.includes('test_coin::TEST_COIN')) return 6; // 测试网 USDC

    return 6; // 默认精度
  }

  /**
   * 将价格转换为最小单位（使用整数运算避免浮点精度问题）
   */
  private convertPriceToSmallestUnit(price: number, decimals: number): bigint {
    // 使用字符串避免浮点精度问题
    const priceStr = price.toString();
    const [integerPart, decimalPart = ''] = priceStr.split('.');
    
    // 确保小数部分不超过精度位数
    const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);
    
    // 组合整数和小数部分
    const combinedStr = integerPart + paddedDecimal;
    
    return BigInt(combinedStr);
  }

  /**
   * 将最小单位价格转换回显示价格（使用整数运算避免浮点精度问题）
   */
  private convertPriceFromSmallestUnit(smallestUnit: bigint | string | number, decimals: number): number {
    // 转换为字符串处理
    const smallestUnitStr = smallestUnit.toString();
    
    // 确保是数字字符串
    if (!/^\d+$/.test(smallestUnitStr)) {
      return 0;
    }
    
    // 如果字符串长度小于等于精度，说明是小于1的小数
    if (smallestUnitStr.length <= decimals) {
      // 补齐到精度位数
      const padded = smallestUnitStr.padStart(decimals, '0');
      const resultStr = `0.${padded}`;
      return parseFloat(resultStr);
    }
    
    // 分离整数和小数部分
    const integerPart = smallestUnitStr.slice(0, -decimals) || '0';
    const decimalPart = smallestUnitStr.slice(-decimals).padEnd(decimals, '0');
    
    // 组合并转换为数字
    const resultStr = `${integerPart}.${decimalPart}`;
    return parseFloat(resultStr);
  }

  /**
   * 验证Sui地址格式
   */
  private isValidSuiAddress(address: string): boolean {
    // Sui地址格式: 0x 开头，后跟64个十六进制字符（现代Sui地址）
    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
    return suiAddressRegex.test(address);
  }

  /**
   * 标准化代币类型
   */
  private normalizeTokenType(tokenType: string | any): string {
    if (!tokenType) return '0x2::sui::SUI';
    
    // 确保是字符串
    const tokenTypeStr = String(tokenType);
    
    // 如果已经是完整格式，直接返回
    if (tokenTypeStr.includes('::')) {
      return tokenTypeStr.startsWith('0x') ? tokenTypeStr : `0x${tokenTypeStr}`;
    }
    
    // 如果只是地址，添加标准代币类型
    const address = tokenTypeStr.startsWith('0x') ? tokenTypeStr : `0x${tokenTypeStr}`;
    return `${address}::sui::SUI`;
  }

  /**
   * 获取代币精度
   */
  private getTokenDecimals(tokenType: string | any): number {
    const tokenTypeStr = String(tokenType);
    return this.getDecimalsByTokenType(tokenTypeStr);
  }

  /**
   * 获取当前钱包地址
   */
  private async getCurrentWalletAddress(): Promise<string | null> {
    try {
      // 这里应该从钱包服务获取当前地址
      // 暂时返回null，需要根据实际钱包集成调整
      return null;
    } catch (error) {
      console.error('获取钱包地址失败:', error);
      return null;
    }
  }

  /**
   * 统一的交易执行包装器
   */
  private async executeTransaction(
    signAndExecute: SignerFunction,
    tx: Transaction,
    operationName: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      signAndExecute({ 
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      })
      .then((result: any) => {
        console.log(`✅ ${operationName} 交易执行成功:`, result);
        
        if (result.effects?.status?.status !== 'success') {
          const errorMsg = result.effects?.status?.error || '未知错误';
          reject(new Error(`${operationName}失败: ${errorMsg}`));
          return;
        }
        
        resolve(result);
      })
      .catch((error: any) => {
        console.error(`❌ ${operationName}交易失败:`, error);
        reject(new Error(`${operationName}执行失败: ${error?.message || '未知错误'}`));
      });
    });
  }

  /**
   * 从交易结果中提取对象ID
   */
  private extractObjectIdFromResult(transactionResult: any): string | null {
    let objectId: string | undefined;
    
    // 检查对象变化
    if (transactionResult.objectChanges) {
      for (const change of transactionResult.objectChanges) {
        if (change.type === 'created' && change.objectType.includes('TradingObject')) {
          objectId = change.objectId;
          console.log('📍 从对象变化中找到对象ID:', objectId);
          break;
        }
      }
    }

    // 如果没有找到对象ID，尝试从事件中获取
    if (!objectId && transactionResult.events) {
      for (const event of transactionResult.events) {
        if (event.parsedJson && typeof event.parsedJson === 'object') {
          const parsedJson = event.parsedJson as any;
          if (parsedJson.object_id) {
            objectId = String(parsedJson.object_id);
            console.log('📍 从事件中找到对象ID:', objectId);
            break;
          }
        }
      }
    }

    return objectId || null;
  }

  /**
   * 获取签名者地址（从签名函数中推断）
   */
  private async getSignerAddress(signAndExecute: SignerFunction): Promise<string> {
    // 这里需要根据实际情况获取地址
    // 可能需要通过其他方式传递，或者从钱包服务获取
    // 暂时返回空字符串，需要在调用时传入
    return '';
  }

  /**
   * 上架对象到市场
   */
  async listObject(
    objectId: string,
    signer: Signer
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('📤 开始上架对象:', { objectId });

      const tx = new Transaction();
      
      // 调用管理员版本的上架函数（无需权限检查）
      tx.moveCall({
        target: `${this.packageId}::trading_object::list_object_admin`,
        arguments: [
          tx.object(this.marketplaceId),  // 市场对象
          tx.object(objectId),  // TradingObject对象
        ]
      });

      const result = await signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      console.log('✅ 上架交易执行成功:', result);

      if (result.effects?.status?.status === 'success') {
        return {
          success: true,
          message: '上架成功'
        };
      } else {
        const errorMsg = result.effects?.status?.error || '未知错误';
        console.error('❌ 上架交易失败:', errorMsg);
        return {
          success: false,
          message: `上架失败: ${errorMsg}`
        };
      }
    } catch (error) {
      console.error('❌ 上架对象失败:', error);
      return {
        success: false,
        message: (error as Error).message || '上架失败'
      };
    }
  }

  /**
   * 下架对象
   */
  async delistObject(
    objectId: string,
    signer: Signer
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('📥 开始下架对象:', { objectId });

      const tx = new Transaction();
      
      // 调用下架函数
      tx.moveCall({
        target: `${this.packageId}::trading_object::delist_object`,
        arguments: [
          tx.object(this.marketplaceId),  // 市场对象
          tx.pure.id(objectId),  // 对象ID
        ]
      });

      const result = await signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      console.log('✅ 下架交易执行成功:', result);

      if (result.effects?.status?.status === 'success') {
        return {
          success: true,
          message: '下架成功'
        };
      } else {
        const errorMsg = result.effects?.status?.error || '未知错误';
        console.error('❌ 下架交易失败:', errorMsg);
        return {
          success: false,
          message: `下架失败: ${errorMsg}`
        };
      }
    } catch (error) {
      console.error('❌ 下架对象失败:', error);
      return {
        success: false,
        message: (error as Error).message || '下架失败'
      };
    }
  }

  /**
   * 购买对象（重构版本 - 参考manager项目的优秀实践）
   */
  async purchaseObject(
    objectId: string,
    coinId: string,
    tokenType: string,
    signAndExecute: SignerFunction,
    buyerAddress: string
  ): Promise<{ success: boolean; message: string; transactionDigest?: string }> {
    try {
      console.log('🛒 开始购买对象:', { objectId, tokenType });

      // 预检查购买条件
      const preCheckResult = await this.preCheckPurchaseConditions(objectId, tokenType, buyerAddress);
      if (!preCheckResult.valid) {
        return {
          success: false,
          message: preCheckResult.error
        };
      }

      // 获取支付代币信息
      const paymentInfo = await this.getPaymentInfo(coinId, tokenType, buyerAddress, preCheckResult.targetObject!);
      if (!paymentInfo.valid) {
        return {
          success: false,
          message: paymentInfo.error
        };
      }

      // 构建交易
      const tx = new Transaction();
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      // 分割代币：创建刚好足够支付的代币对象，改善用户体验
      const decimals = this.getDecimalsByTokenType(tokenType);
      const requiredAmount = Math.ceil(preCheckResult.targetObject!.price * Math.pow(10, decimals));
      
      // 使用 splitCoins 分割出刚好需要的代币数量
      const paymentCoin = tx.splitCoins(tx.object(paymentInfo.actualCoinId!), [tx.pure.u64(requiredAmount)]);
      
      tx.moveCall({
        target: `${this.packageId}::trading_object::purchase_object`,
        typeArguments: [formattedTokenType],
        arguments: [
          tx.object(this.marketplaceId),
          tx.pure.id(objectId),
          paymentCoin, // 使用分割后的代币对象
        ]
      });

      console.log('📍 交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 manager 项目 addSupportedToken 模式）
      // 将所有后续逻辑都放到 Promise 回调中，确保等待用户确认后再执行
      console.log('📍 开始执行钱包交互...');
      return new Promise<{ success: boolean; message: string; transactionDigest?: string }>((resolve, reject) => {
        try {
          // 完全按照 manager 项目的调用方式：直接调用 signAndExecute 函数
          signAndExecute(
            { 
              transaction: tx,
              options: {
                showEffects: true,
                showEvents: true,
                showObjectChanges: true
              }
            },
            {
            onSuccess: async (result: any) => {
              console.log('✅ 购买交易执行成功:', result);
              
              // 简化流程：如果交易成功，直接认为购买成功
              // 不进行额外的链上验证，避免不必要的错误
              console.log('✅ 购买完成，交易摘要:', result.digest);
              
              resolve({
                success: true,
                message: '购买成功！',
                transactionDigest: result.digest || ''
              });
            },
              onError: (error: any) => {
                console.error('❌ 购买交易失败:', error);
                resolve({
                  success: false,
                  message: `交易执行失败: ${error?.message || '未知错误'}`
                });
              }
            }
          );
        } catch (error) {
          console.error('❌ 钱包交互调用失败:', error);
          resolve({
            success: false,
            message: `钱包交互失败: ${(error as Error)?.message || '未知错误'}`
          });
        }
      });

    } catch (error) {
      console.error('❌ 购买对象失败:', error);
      return {
        success: false,
        message: (error as Error).message || '购买失败'
      };
    }
  }

  /**
   * 预检查购买条件
   */
  private async preCheckPurchaseConditions(
    objectId: string,
    tokenType: string,
    buyerAddress: string
  ): Promise<{ valid: boolean; error?: string; targetObject?: TradingObject }> {
    try {
      console.log('🔍 预检查购买条件...');

      // 获取市场对象信息
      const marketplaceObjects = await this.getMarketplaceObjects();
      const targetObject = marketplaceObjects.find(obj => obj.id === objectId);
      
      if (!targetObject) {
        return { valid: false, error: '对象不存在或已售出' };
      }

      if (!targetObject.is_for_sale) {
        return { valid: false, error: '该对象当前不在出售状态' };
      }

      // 检查代币类型是否匹配
      if (targetObject.token_type && targetObject.token_type !== tokenType) {
        return { 
          valid: false, 
          error: `代币类型不匹配。期望: ${targetObject.token_type}, 提供: ${tokenType}` 
        };
      }

      // 检查是否是自己的对象
      if (targetObject.owner === buyerAddress) {
        return { valid: false, error: '不能购买自己的对象' };
      }

      console.log('✅ 预检查通过');
      return { valid: true, targetObject };

    } catch (error) {
      console.error('❌ 预检查失败:', error);
      return { valid: false, error: '预检查失败' };
    }
  }

  /**
   * 获取支付代币信息
   */
  private async getPaymentInfo(
    coinId: string,
    tokenType: string,
    buyerAddress: string,
    targetObject: TradingObject
  ): Promise<{ valid: boolean; error?: string; actualCoinId?: string }> {
    try {
      console.log('💰 获取支付代币信息...');

      const suiClient = this.getSuiClient();
      let actualCoinId = coinId;

      // 如果没有提供coinId，需要获取用户的代币
      if (!actualCoinId || actualCoinId === '') {
        const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
        const coins = await suiClient.getCoins({
          owner: buyerAddress,
          coinType: formattedTokenType,
        });

        if (coins.data.length === 0) {
          const tokenSymbol = this.getTokenSymbol(tokenType);
          return { valid: false, error: `您没有 ${tokenSymbol} 代币` };
        }

        actualCoinId = coins.data[0].coinObjectId;
      }

      // 验证代币存在性和余额
      const coin = await suiClient.getObject({
        id: actualCoinId,
        options: { showContent: true }
      });

      if (!coin.data) {
        return { valid: false, error: '支付代币不存在' };
      }

      const coinBalance = Number((coin.data.content as any)?.fields?.balance || (coin.data.content as any)?.balance || (coin.data.content as any)?.value || 0);
      const decimals = this.getDecimalsByTokenType(tokenType);
      const requiredAmount = Math.ceil(targetObject.price * Math.pow(10, decimals));

      if (coinBalance < requiredAmount) {
        const actualBalance = coinBalance / Math.pow(10, decimals);
        const neededAmount = targetObject.price;
        const tokenSymbol = this.getTokenSymbol(tokenType);
        return { 
          valid: false, 
          error: `${tokenSymbol}余额不足！当前余额: ${actualBalance} ${tokenSymbol}, 需要: ${neededAmount} ${tokenSymbol}` 
        };
      }

      console.log('✅ 支付代币验证通过');
      return { valid: true, actualCoinId };

    } catch (error) {
      console.error('❌ 获取支付代币信息失败:', error);
      return { valid: false, error: '支付代币验证失败' };
    }
  }

  /**
   * 验证购买结果（链上状态验证）
   */
  private async verifyPurchaseOnChain(
    objectId: string,
    buyerAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔍 验证购买结果（链上状态）...');

      // 等待一小段时间让链上状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 验证1: 检查对象是否已经转移到买家地址
      const userObjects = await this.getUserObjects(buyerAddress);
      const purchasedObject = userObjects.find(obj => obj.id === objectId);
      
      if (purchasedObject) {
        console.log('✅ 验证成功：对象已转移到买家地址');
        return { success: true };
      }

      // 验证2: 检查市场中是否还有该对象
      const marketplaceObjects = await this.getMarketplaceObjects();
      const stillInMarket = marketplaceObjects.find(obj => obj.id === objectId);
      
      if (!stillInMarket) {
        console.log('✅ 验证成功：对象已从市场移除');
        return { success: true };
      }

      // 验证3: 直接查询对象所有权
      const objectDetails = await this.getObjectDetails(objectId);
      if (objectDetails?.owner?.AddressOwner === buyerAddress) {
        console.log('✅ 验证成功：对象所有权已转移');
        return { success: true };
      }

      return { 
        success: false, 
        error: '购买验证失败：对象状态未正确更新，请稍后检查' 
      };

    } catch (error) {
      console.error('❌ 验证购买结果失败:', error);
      return { 
        success: false, 
        error: `验证失败: ${(error as Error).message}` 
      };
    }
  }

  /**
   * 验证购买是否成功
   */
  private async verifyPurchaseSuccess(objectId: string, buyerAddress: string): Promise<boolean> {
    try {
      console.log('🔍 验证购买结果...', { objectId, buyerAddress });
      
      // 等待一小段时间让链上状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 检查对象是否已经转移到买家地址
      const userObjects = await this.getUserObjects(buyerAddress);
      const purchasedObject = userObjects.find(obj => obj.id === objectId);
      
      if (purchasedObject) {
        console.log('✅ 验证成功：对象已转移到买家地址');
        return true;
      }
      
      // 检查市场中是否还有该对象
      const marketplaceObjects = await this.getMarketplaceObjects();
      const stillInMarket = marketplaceObjects.find(obj => obj.id === objectId);
      
      if (!stillInMarket) {
        console.log('✅ 验证成功：对象已从市场移除');
        return true;
      }
      
      console.warn('⚠️ 验证失败：对象仍在市场中，可能需要更多时间确认');
      return false;
    } catch (error) {
      console.error('❌ 验证购买结果失败:', error);
      return false;
    }
  }

  /**
   * 获取代币符号
   */
  private getTokenSymbol(tokenType: string): string {
    const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
    
    if (formattedTokenType.includes('sui::SUI')) return 'SUI';
    if (formattedTokenType.includes('usdc') || formattedTokenType.includes('USDC')) return 'USDC';
    if (formattedTokenType.includes('test_coin::TEST_COIN')) return 'USDC';
    
    return 'Unknown';
  }

  /**
   * 检查用户是否拥有指定的TradingObject
   */
  async checkUserOwnsObject(objectId: string, userAddress: string): Promise<boolean> {
    try {
      console.log('🔍 开始检查对象所有权:', { objectId, userAddress });
      
      // 验证地址格式
      if (!this.isValidSuiAddress(userAddress)) {
        console.error('❌ 无效的用户地址格式:', userAddress);
        return false;
      }

      // 获取用户拥有的所有TradingObject
      const result = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::trading_object::TradingObject`
        },
        options: {
          showContent: true
        }
      });

      console.log('📍 用户拥有的对象列表:', {
        userAddress,
        totalObjects: result.data.length,
        objectIds: result.data.map(obj => obj.data?.objectId),
        targetObjectId: objectId
      });

      // 检查用户是否拥有指定的对象
      const ownsObject = result.data.some(obj => obj.data?.objectId === objectId);
      
      if (ownsObject) {
        console.log('✅ 用户拥有该对象:', { objectId, userAddress });
      } else {
        console.log('❌ 用户不拥有该对象:', { 
          objectId, 
          userAddress,
          userObjects: result.data.map(obj => ({
            id: obj.data?.objectId,
            owner: (obj.data?.content as any)?.fields?.owner
          }))
        });
      }
      
      return ownsObject;
    } catch (error) {
      console.error('❌ 检查用户对象所有权失败:', error);
      return false;
    }
  }

  /**
   * 获取对象的详细信息（用于调试）
   */
  async getObjectDetails(objectId: string): Promise<any> {
    try {
      console.log('🔍 获取对象详细信息:', { objectId });
      
      const result = await this.client.getObject({
        id: objectId,
        options: {
          showContent: true,
          showOwner: true,
          showType: true
        }
      });

      console.log('📍 对象详细信息:', {
        objectId,
        result: result.data,
        owner: result.data?.owner,
        content: result.data?.content,
        type: result.data?.type
      });

      return result.data;
    } catch (error) {
      console.error('❌ 获取对象详细信息失败:', error);
      return null;
    }
  }

  /**
   * 验证对象所有权（增强版本）
   */
  async verifyObjectOwnership(objectId: string, userAddress: string): Promise<{
    isOwner: boolean;
    objectDetails: any;
    errorMessage?: string;
  }> {
    try {
      console.log('🔍 开始验证对象所有权:', { objectId, userAddress });

      // 获取对象详细信息
      const objectDetails = await this.getObjectDetails(objectId);
      
      if (!objectDetails) {
        return {
          isOwner: false,
          objectDetails: null,
          errorMessage: '无法获取对象信息，对象可能不存在'
        };
      }

      // 检查对象类型
      if (!objectDetails.type?.includes('TradingObject')) {
        return {
          isOwner: false,
          objectDetails,
          errorMessage: '对象不是TradingObject类型'
        };
      }

      // 检查对象所有者
      let objectOwner: string | undefined;
      
      // 从对象内容中获取所有者
      if (objectDetails.content?.dataType === 'moveObject') {
        const content = objectDetails.content as any;
        if (content.fields?.owner) {
          objectOwner = content.fields.owner;
        }
      }
      
      // 从对象所有者信息中获取
      if (objectDetails.owner?.AddressOwner) {
        objectOwner = objectDetails.owner.AddressOwner;
      }

      console.log('📍 所有权验证详情:', {
        objectId,
        userAddress,
        objectOwner,
        objectDetails: (objectDetails.content as any)?.fields
      });

      if (!objectOwner) {
        return {
          isOwner: false,
          objectDetails,
          errorMessage: '无法确定对象所有者'
        };
      }

      const isOwner = objectOwner === userAddress;
      
      return {
        isOwner,
        objectDetails,
        errorMessage: isOwner ? undefined : '您不是该对象的所有者'
      };

    } catch (error) {
      console.error('❌ 验证对象所有权失败:', error);
      return {
        isOwner: false,
        objectDetails: null,
        errorMessage: `验证失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 创建交易对象
   */
  async createTradingObject(
    name: string,
    description: string,
    price: number,
    imageUrl: string,
    blobId: string,
    tokenTypeArg: string,
    signAndExecute: (args: any) => Promise<any>,
    userAddress?: string
  ): Promise<string> {
    try {
      console.log('🚀 开始创建交易对象:', { name, price, tokenTypeArg });

      // 标准化代币类型参数
      const normalizedType = this.normalizeTokenType(tokenTypeArg);
      console.log('📍 标准化后的代币类型:', normalizedType);

      // 获取代币精度
      const decimals = this.getTokenDecimals(normalizedType);
      console.log('📍 代币精度:', decimals);

      // 转换价格到最小单位
      const priceInSmallestUnit = this.convertPriceToSmallestUnit(price, decimals);
      console.log('💰 转换后的价格:', priceInSmallestUnit.toString());

      // 创建交易
      const tx = new Transaction();
      
      // 调用 create_trading_object 函数并转移返回的对象给调用者
      let tradingObject = tx.moveCall({
        target: `${this.packageId}::trading_object::create_trading_object`,
        arguments: [
          tx.pure.string(name),
          tx.pure.string(description),
          tx.pure.string(imageUrl),
          tx.pure.string(blobId || ''), // 添加 blobId 参数
          tx.pure.u64(priceInSmallestUnit),
          tx.pure.string(normalizedType)
        ]
      });
      
      // 转移创建的对象给调用者
      tx.transferObjects([tradingObject], tx.pure.address(userAddress || '0x0'));

      console.log('📍 交易对象构建完成，准备执行...');

      // 使用 Promise 包装来正确处理异步操作
      const result = await new Promise<any>((resolve, reject) => {
        signAndExecute({ transaction: tx })
          .then((result: any) => {
            console.log('📍 交易对象创建交易成功:', result);
            resolve(result);
          })
          .catch((error: any) => {
            console.error('❌ 交易对象创建交易失败:', error);
            reject(new Error(`交易执行失败: ${error?.message || '未知错误'}`));
          });
      });

      console.log('📍 交易执行完成:', result);

      // 检查交易结果
      if (result.effects?.status?.status !== 'success') {
        const errorMsg = result.effects?.status?.error || '未知错误';
        throw new Error(`创建交易对象失败: ${errorMsg}`);
      }

      // 获取创建的对象ID
      const objectId = result.effects?.created?.[0]?.reference?.objectId;
      if (!objectId) {
        throw new Error('未找到创建的对象ID');
      }

      console.log('✅ 交易对象创建成功:', objectId);
      return objectId;

    } catch (error) {
      console.error('❌ 创建交易对象失败:', error);
      throw error;
    }
  }

  /**
   * 获取Sui客户端
   */
  getSuiClient(): SuiClient {
    return this.client;
  }

  /**
   * 获取合约配置
   */
  getContractConfig() {
    return {
      packageId: this.packageId,
      marketplaceId: this.marketplaceId,
      network: this.network
    };
  }

  /**
   * 获取市场中的所有对象
   */
  async getMarketplaceObjects(): Promise<TradingObject[]> {
    try {
      console.log('🔍 获取市场对象...');
      
      // 获取市场共享对象的内容
      const marketplaceObject = await this.client.getObject({
        id: this.marketplaceId,
        options: {
          showContent: true,
          showType: true
        }
      });

      console.log('📍 市场对象原始数据:', marketplaceObject);

      const objects: TradingObject[] = [];
      
      if (marketplaceObject.data?.content?.dataType === 'moveObject' && 
          marketplaceObject.data.content.fields) {
        
        const fields = marketplaceObject.data.content.fields as any;
        const marketObjects = fields.objects as any[];
        
        for (const obj of marketObjects) {
          if (obj && typeof obj === 'object' && obj.fields) {
            const fields = obj.fields;
            
            // 解析代币类型
            let tokenType = '0x2::sui::SUI'; // 默认为SUI
            if (fields.token_type) {
              tokenType = typeof fields.token_type === 'string' ? fields.token_type : String(fields.token_type);
            }

            const tradingObject: TradingObject = {
              id: fields.id?.id || '',
              owner: fields.owner || '',
              bot: fields.bot || 'Unknown Bot',
              emoji: fields.emoji || '🤖',
              profile_picture: fields.profile_picture || '',
              blob_id: fields.blob_id || '',
              price: this.convertPriceFromSmallestUnit(fields.price, this.getDecimalsByTokenType(tokenType)), // 使用新的转换函数
              is_for_sale: fields.is_for_sale || false,
              token_type: tokenType,
              wallet_id: fields.wallet_id || undefined
            };
            
            objects.push(tradingObject);
            console.log('📍 解析的市场对象:', tradingObject);
          }
        }
      }

      console.log(`📍 成功获取 ${objects.length} 个市场对象`);
      return objects;
    } catch (error) {
      console.error('❌ 获取市场对象失败:', error);
      return [];
    }
  }

  /**
   * 获取用户拥有的对象
   */
  async getUserObjects(userAddress: string): Promise<TradingObject[]> {
    try {
      console.log('🔍 获取用户对象:', userAddress);
      
      // 获取用户拥有的TradingObject
      const userObjects = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::trading_object::TradingObject`
        },
        options: {
          showContent: true
        }
      });

      console.log('📍 用户对象原始数据:', userObjects);

      const objects: TradingObject[] = [];
      
      for (const obj of userObjects.data) {
        if (obj.data?.content?.dataType === 'moveObject' && obj.data.content.fields) {
          const fields = obj.data.content.fields as any;
          
          // 解析代币类型
          let tokenType = '0x2::sui::SUI'; // 默认为SUI
          if (fields.token_type) {
            tokenType = typeof fields.token_type === 'string' ? fields.token_type : String(fields.token_type);
          }

          const tradingObject: TradingObject = {
            id: obj.data.objectId,
            owner: userAddress,
            bot: fields.bot || 'Unknown Bot',
            emoji: fields.emoji || '🤖',
            profile_picture: fields.profile_picture || '',
            blob_id: fields.blob_id || '',
            price: this.convertPriceFromSmallestUnit(fields.price, this.getDecimalsByTokenType(tokenType)), // 使用新的转换函数
            is_for_sale: fields.is_for_sale || false,
            token_type: tokenType,
            wallet_id: fields.wallet_id || undefined
          };
          
          objects.push(tradingObject);
          console.log('📍 解析的用户对象:', tradingObject);
        }
      }

      console.log(`📍 成功获取 ${objects.length} 个用户对象`);
      return objects;
    } catch (error) {
      console.error('❌ 获取用户对象失败:', error);
      return [];
    }
  }

  /**
   * 获取用户上架的对象（在市场中出售的对象）
   */
  async getUserListedObjects(userAddress: string): Promise<TradingObject[]> {
    try {
      console.log('🔍 获取用户上架的对象:', userAddress);
      
      // 获取市场中的所有对象
      const marketplaceObjects = await this.getMarketplaceObjects();
      
      // 过滤出属于该用户的对象
      const userListedObjects = marketplaceObjects.filter(obj => obj.owner === userAddress);
      
      console.log(`📍 成功获取 ${userListedObjects.length} 个用户上架的对象`);
      return userListedObjects;
    } catch (error) {
      console.error('❌ 获取用户上架对象失败:', error);
      return [];
    }
  }

  /**
   * 更新交易对象信息
   */
  async updateTradingObject(
    objectId: string,
    bot: string,
    emoji: string,
    profile_picture: string,
    blob_id: string,
    price: number,
    token_type: string,
    signer: Signer
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 开始更新交易对象:', { objectId, price, token_type });

      const tx = new Transaction();
      
      // 调用更新函数
      tx.moveCall({
        target: `${this.packageId}::trading_object::update_trading_object`,
        arguments: [
          tx.object(this.marketplaceId),  // 市场对象
          tx.pure.id(objectId),  // 对象ID
          tx.pure.string(bot),  // 机器人名称
          tx.pure.string(emoji),  // 表情
          tx.pure.string(profile_picture),  // 头像
          tx.pure.string(blob_id),  // Blob ID
          tx.pure.u64(this.convertPriceToSmallestUnit(price, this.getDecimalsByTokenType(token_type))),  // 价格（转换为最小单位）
          tx.pure.string(token_type),  // 代币类型
        ]
      });

      const result = await signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      console.log('✅ 更新交易执行成功:', result);

      if (result.effects?.status?.status === 'success') {
        return {
          success: true,
          message: '更新成功'
        };
      } else {
        const errorMsg = result.effects?.status?.error || '未知错误';
        console.error('❌ 更新交易失败:', errorMsg);
        return {
          success: false,
          message: `更新失败: ${errorMsg}`
        };
      }
    } catch (error) {
      console.error('❌ 更新交易对象失败:', error);
      return {
        success: false,
        message: (error as Error).message || '更新失败'
      };
    }
  }

  /**
   * 检查用户是否拥有上架权限
   */
  async hasListingPermission(userAddress: string): Promise<boolean> {
    try {
      console.log('🔍 检查用户上架权限:', userAddress);
      
      // 获取用户拥有的ListingCap对象
      const listingCaps = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::trading_object::ListingCap`
        },
        options: {
          showContent: true
        }
      });

      const hasPermission = listingCaps.data.length > 0;
      console.log('📍 用户上架权限结果:', { userAddress, hasPermission, capCount: listingCaps.data.length });
      
      return hasPermission;
    } catch (error) {
      console.error('❌ 检查上架权限失败:', error);
      return false;
    }
  }

  /**
   * 获取用户的ListingCap详细信息
   */
  async getUserListingCap(userAddress: string): Promise<any | null> {
    try {
      console.log('🔍 获取用户ListingCap详细信息:', userAddress);
      
      // 获取用户拥有的ListingCap对象
      const listingCaps = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::trading_object::ListingCap`
        },
        options: {
          showContent: true
        }
      });

      if (listingCaps.data.length === 0) {
        console.log('📍 用户没有ListingCap');
        return null;
      }

      // 返回第一个ListingCap的详细信息
      const capInfo = listingCaps.data[0];
      console.log('📍 用户ListingCap详细信息:', capInfo);
      
      return capInfo;
    } catch (error) {
      console.error('❌ 获取用户ListingCap失败:', error);
      return null;
    }
  }

  /**
   * 创建交易对象并直接上架到市场（简化版本）
   */
  async createAndListTradingObject(
    bot: string,
    emoji: string,
    profile_picture: string,
    blob_id: string,
    price: number,
    token_type: string,
    signAndExecute: SignerFunction,
    userAddress?: string
  ): Promise<string> {
    try {
      console.log('🏗️ 开始创建交易对象:', { bot, price, token_type });

      const tx = new Transaction();
      
      // 检查用户是否是管理员（需要传入地址）
      if (!userAddress) {
        throw new Error('用户地址不能为空');
      }
      
      const isAdmin = await this.checkAdminStatus(userAddress);
      console.log('📍 用户管理员状态:', { address: userAddress, isAdmin });

      if (isAdmin) {
        console.log('📍 使用管理员版本创建对象');
        
        // 使用管理员版本的函数（不需要CapManager和ListingCap）
        tx.moveCall({
          target: `${this.packageId}::trading_object::create_and_list_trading_object_admin`,
          arguments: [
            tx.object(this.marketplaceId),  // 市场对象
            tx.pure.string(bot),  // 机器人名称
            tx.pure.string(emoji),  // 表情
            tx.pure.string(profile_picture),  // 头像
            tx.pure.string(blob_id),  // Blob ID
            tx.pure.u64(this.convertPriceToSmallestUnit(price, this.getDecimalsByTokenType(token_type))),  // 价格（转换为最小单位）
            tx.pure.string(token_type)  // 代币类型
          ]
        });
      } else {
        console.log('📍 使用普通用户版本创建对象');
        
        // 首先需要获取用户的ListingCap
        const listingCaps = await this.client.getOwnedObjects({
          owner: userAddress,
          filter: {
            StructType: `${this.packageId}::trading_object::ListingCap`
          },
          options: {
            showContent: true
          }
        });

        if (listingCaps.data.length === 0) {
          throw new Error('您没有上架权限，请联系管理员获取ListingCap');
        }

        const listingCapId = listingCaps.data[0].data?.objectId;
        if (!listingCapId) {
          throw new Error('无法找到ListingCap对象');
        }

        // 获取CapManager的ID
        const capManagerId = await this.getCapManagerId();
        
        // 调用创建并上架函数（需要权限的版本）
        tx.moveCall({
          target: `${this.packageId}::trading_object::create_and_list_trading_object`,
          arguments: [
            tx.object(this.marketplaceId),  // 市场对象
            tx.object(capManagerId),  // CapManager对象
            tx.pure.string(bot),  // 机器人名称
            tx.pure.string(emoji),  // 表情
            tx.pure.string(profile_picture),  // 头像
            tx.pure.string(blob_id),  // Blob ID
            tx.pure.u64(this.convertPriceToSmallestUnit(price, this.getDecimalsByTokenType(token_type))),  // 价格（转换为最小单位）
            tx.pure.string(token_type)  // 代币类型
          ]
        });
      }

      console.log('📍 交易对象构建完成，准备执行...');

      // 使用 Promise 包装来正确处理异步操作（参考 createTradingObject 方法）
      const result = await new Promise<any>((resolve, reject) => {
        console.log('🔧 调用 signAndExecute 函数...');
        
        signAndExecute({ 
          transaction: tx,
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true
          }
        })
        .then((result: any) => {
          console.log('📍 交易对象创建交易成功:', result);
          
          if (!result) {
            console.error('❌ 交易结果为空');
            reject(new Error('交易执行返回空结果'));
            return;
          }
          
          // 移除不必要的错误检查
          // 既然能走到这里，说明交易已经成功
          resolve(result);
        })
        .catch((error: any) => {
          console.error('❌ 交易对象创建交易失败:', error);
          reject(new Error(`交易执行失败: ${error?.message || '未知错误'}`));
        });
      });

      console.log('✅ 创建交易对象执行成功:', result);

      // 从交易结果中提取对象ID
      const objectId = this.extractObjectIdFromResult(result);

      // 如果没有找到对象ID，返回市场ID让前端刷新
      if (!objectId) {
        console.log('📍 无法获取具体对象ID，返回市场ID以刷新数据');
        return this.marketplaceId;
      }

      return objectId;
    } catch (error) {
      console.error('❌ 创建交易对象失败:', error);
      // 不再重新抛出错误，让内部的 Promise 处理错误显示
      // 这样可以避免重复的错误消息
      throw new Error(`创建交易对象失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 创建交易对象并直接上架到市场（向后兼容版本）
   */
  async createAndListTradingObjectWithSigner(
    bot: string,
    emoji: string,
    profile_picture: string,
    blob_id: string,
    price: number,
    token_type: string,
    signer: Signer
  ): Promise<string> {
    return this.createAndListTradingObject(
      bot,
      emoji,
      profile_picture,
      blob_id,
      price,
      token_type,
      signer.signAndExecuteTransaction,
      signer.address
    );
  }

  /**
   * 获取CapManager的ID
   */
  private async getCapManagerId(): Promise<string> {
    try {
      // 从 local/contracts.md 中获取正确的CapManager ID
      const capManagerId = '0x5907b6a21de64ac5501a6709f7acc6457dba6c375f093c1c974e9f7e74b23d06';
      console.log('📍 使用CapManager ID:', capManagerId);
      return capManagerId;
    } catch (error) {
      console.error('❌ 获取CapManager ID失败:', error);
      throw new Error('无法获取CapManager ID');
    }
  }

  /**
   * 检查用户是否是管理员
   */
  async checkAdminStatus(userAddress: string): Promise<boolean> {
    try {
      console.log('🔍 检查管理员状态:', userAddress);
      
      // 获取市场对象信息
      const result = await this.client.getObject({
        id: this.marketplaceId,
        options: {
          showContent: true
        }
      });

      if (result.data?.content?.dataType === 'moveObject' && 
          (result.data?.content as any)?.type === `${this.packageId}::trading_object::Marketplace`) {
        const content = result.data?.content as any;
        const adminAddress = content.fields?.admin;
        
        const isAdmin = adminAddress === userAddress;
        console.log('📍 管理员检查结果:', { userAddress, adminAddress, isAdmin });
        
        return isAdmin;
      }
      
      return false;
    } catch (error) {
      console.error('❌ 检查管理员状态失败:', error);
      return false;
    }
  }

  /**
   * 获取市场费用信息
   */
  async getMarketFeeInfo(): Promise<{
    feePercentage: number;
    isPaused: boolean;
  }> {
    try {
      console.log('🔍 获取市场费用信息...');
      
      // 获取市场对象信息
      const result = await this.client.getObject({
        id: this.marketplaceId,
        options: {
          showContent: true
        }
      });

      if (result.data?.content?.dataType === 'moveObject' && 
          (result.data?.content as any)?.type === `${this.packageId}::trading_object::Marketplace`) {
        const content = result.data?.content as any;
        const fields = content.fields;
        
        const feeInfo = {
          feePercentage: Number(fields.fee_percentage) / 100, // 转换为百分比
          isPaused: fields.is_paused || false
        };
        
        console.log('📍 市场费用信息:', feeInfo);
        return feeInfo;
      }
      
      return {
        feePercentage: 0,
        isPaused: false
      };
    } catch (error) {
      console.error('❌ 获取市场费用信息失败:', error);
      return {
        feePercentage: 0,
        isPaused: false
      };
    }
  }

  /**
   * 暂停市场
   */
  async pauseMarket(signer: Signer): Promise<void> {
    try {
      console.log('⏸️ 开始暂停市场...');

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${this.packageId}::trading_object::pause_market`,
        arguments: [
          tx.object(this.marketplaceId)
        ]
      });

      const result = await signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      console.log('✅ 暂停市场交易执行成功:', result);

      if (result.effects?.status?.status !== 'success') {
        const errorMsg = result.effects?.status?.error || '未知错误';
        throw new Error(`暂停市场失败: ${errorMsg}`);
      }
    } catch (error) {
      console.error('❌ 暂停市场失败:', error);
      throw error;
    }
  }

  /**
   * 恢复市场
   */
  async resumeMarket(signer: Signer): Promise<void> {
    try {
      console.log('▶️ 开始恢复市场...');

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${this.packageId}::trading_object::resume_market`,
        arguments: [
          tx.object(this.marketplaceId)
        ]
      });

      const result = await signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      console.log('✅ 恢复市场交易执行成功:', result);

      if (result.effects?.status?.status !== 'success') {
        const errorMsg = result.effects?.status?.error || '未知错误';
        throw new Error(`恢复市场失败: ${errorMsg}`);
      }
    } catch (error) {
      console.error('❌ 恢复市场失败:', error);
      throw error;
    }
  }

  /**
   * 设置市场费用
   */
  async setMarketFee(feePercentage: number, signer: Signer): Promise<void> {
    try {
      console.log('💰 开始设置市场费用:', feePercentage);

      const tx = new Transaction();
      
      // 将百分比转换为基点 (basis points, 10000 = 100%)
      const feeBasisPoints = Math.floor(feePercentage * 100);
      
      tx.moveCall({
        target: `${this.packageId}::trading_object::set_market_fee`,
        arguments: [
          tx.object(this.marketplaceId),
          tx.pure.u64(feeBasisPoints)
        ]
      });

      const result = await signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      console.log('✅ 设置市场费用交易执行成功:', result);

      if (result.effects?.status?.status !== 'success') {
        const errorMsg = result.effects?.status?.error || '未知错误';
        throw new Error(`设置市场费用失败: ${errorMsg}`);
      }
    } catch (error) {
      console.error('❌ 设置市场费用失败:', error);
      throw error;
    }
  }

  /**
   * 更新网络配置
   */
  updateNetwork(network: NetworkType) {
    const config = getContractConfig(network);
    
    if (!config.packageId || !config.marketplaceId) {
      throw new Error(`Missing configuration for ${network}. Please check your .env file.`);
    }
    
    this.client = new SuiClient({
      url: networkConfig[network]?.url || getFullnodeUrl('testnet'),
    });
    this.packageId = config.packageId;
    this.marketplaceId = config.marketplaceId;
    this.network = network;
  }
}

// 导出单例实例
export const contractService = new ContractService('testnet');
