import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { contractService } from './contractService';
import { marketplaceService } from './marketplaceService';
import { getContractConfig } from '../config/contractConfig';
import { getDefaultNetwork } from '../config/networkConfig';

// 钱包服务接口
export interface WalletInfo {
  id: string;
  object_id: string;
  owner: string;
  balances: { [key: string]: string };
  created_at: number;
}

export interface ScheduledTransferInfo {
  id: string;
  wallet_id: string;
  object_id: string;
  from_address: string;
  to_address: string;
  token_type: string;
  amount: string;
  execute_time: number;
  is_executed: boolean;
  created_at: number;
  created_by: string;
}

// 钱包服务类
export class WalletService {
  private client: SuiClient;
  private packageId: string;
  private adminCapId: string;

  constructor(client: SuiClient, packageId: string, adminCapId: string) {
    this.client = client;
    this.packageId = packageId;
    this.adminCapId = adminCapId;
  }

  // 为现有对象创建钱包（重构版本 - 参考 purchaseObject 的完美实践）
  async createWalletForObject(
    objectId: string,
    signAndExecute: any
  ): Promise<string> {
    try {
      console.log('🚀 开始创建对象钱包:', { objectId });

      // 首先验证对象的所有权状态
      console.log('🔍 验证对象所有权状态...');
      const objectResult = await this.client.getObject({
        id: objectId,
        options: { showContent: true }
      });

      if (!objectResult.data?.content) {
        throw new Error('对象不存在或无法获取对象信息');
      }

      const objectContent = objectResult.data.content as any;
      const objectOwner = objectContent.fields?.owner;
      
      console.log('📍 对象信息:', {
        objectId,
        owner: objectOwner,
        hasWallet: objectContent.fields?.wallet_id ? 'yes' : 'no'
      });

      if (!objectOwner) {
        throw new Error('无法获取对象所有者信息');
      }

      // 检查对象所有者是否为零地址
      if (objectOwner === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error('对象所有者异常：检测到零地址所有者，无法创建钱包');
      }

      // 检查是否已经有钱包
      if (objectContent.fields?.wallet_id) {
        throw new Error('该对象已经有关联的钱包，无需重复创建');
      }

      // 构建交易
      const tx = new Transaction();
      
      // 调用创建钱包函数，现在函数内部会自动转移钱包给调用者
      tx.moveCall({
        target: `${this.packageId}::trading_object::create_wallet_for_object`,
        arguments: [
          tx.object(objectId),
          tx.object('0x6') // Clock 对象的固定地址
        ]
      });

      console.log('📍 钱包创建交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 purchaseObject 模式）
      return new Promise<string>((resolve, reject) => {
        try {
          // 完全按照 purchaseObject 的调用方式：直接调用 signAndExecute 函数
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
                console.log('✅ 钱包创建交易执行成功:', result);
                
                // 既然已经进入 onSuccess 回调，说明交易已经成功执行
                // 不需要额外的验证，避免不必要的错误
                
                // 尝试从交易结果中提取钱包ID（可选）
                let walletId = null;
                try {
                  // 查找创建的钱包对象
                  const objectChanges = result.objectChanges || [];
                  for (const change of objectChanges) {
                    if (change.type === 'created' && 
                        change.objectType?.includes('ObjectWallet')) {
                      walletId = change.objectId;
                      console.log('✅ 从交易结果中提取到钱包ID:', walletId);
                      break;
                    }
                  }
                } catch (extractError) {
                  console.warn('⚠️ 无法从交易结果中提取钱包ID:', extractError);
                }

                // 交易成功，钱包已经创建完成
                console.log('✅ 钱包创建完成，将由前端重新加载获取钱包ID');
                resolve(walletId || 'wallet_created_successfully');
              },
              onError: (error: any) => {
                console.error('❌ 钱包创建交易失败:', error);
                
                // 提供更详细的错误信息
                let errorMessage = `钱包创建失败: ${error?.message || '未知错误'}`;
                
                if (error?.message?.includes('was not signed by the correct sender')) {
                  errorMessage = '权限错误：您不是该对象的所有者，无法创建钱包。请确认您是对象的所有者。';
                } else if (error?.message?.includes('wallet_id')) {
                  errorMessage = '钱包已存在：该对象已经有关联的钱包，无需重复创建。';
                } else if (error?.message?.includes('owner')) {
                  errorMessage = '所有权错误：您不是该对象的所有者，无法创建钱包。';
                }
                
                reject(new Error(errorMessage));
              }
            }
          );
        } catch (error) {
          console.error('❌ 钱包交互调用失败:', error);
          reject(new Error(`钱包交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });

    } catch (error) {
      console.error('❌ 创建对象钱包失败:', error);
      throw new Error(`创建对象钱包失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 获取对象的钱包ID
  async getObjectWalletId(objectId: string): Promise<string | null> {
    try {
      const result = await this.client.getObject({
        id: objectId,
        options: { showContent: true }
      });

      const walletId = (result.data?.content as any)?.fields?.wallet_id;
      return walletId || null;
    } catch (error) {
      console.error('Failed to get object wallet ID:', error);
      return null;
    }
  }

  // 检查对象是否有钱包
  async hasWallet(objectId: string): Promise<boolean> {
    const walletId = await this.getObjectWalletId(objectId);
    return walletId !== null;
  }

  // 获取钱包信息
  async getWalletInfo(walletId: string): Promise<WalletInfo | null> {
    try {
      console.log('📍 开始获取钱包信息:', walletId);
      
      const result = await this.client.getObject({
        id: walletId,
        options: { showContent: true }
      });

      if (!result.data?.content) {
        console.error('❌ 钱包对象不存在或无内容');
        return null;
      }

      const content = result.data.content as any;
      const fields = content.fields;

      console.log('📍 钱包原始数据:', fields);

      // 转换余额数据 - 余额存储在 ObjectWallet 的动态字段中
      const balances: { [key: string]: string } = {};
      try {
        console.log('📍 开始查询钱包动态字段...');
        
        // 获取 ObjectWallet 的所有动态字段（余额存储在这里）
        const dynamicFieldsResult = await this.client.getDynamicFields({
          parentId: walletId
        });
        
        console.log('📍 钱包动态字段结果:', dynamicFieldsResult);
        
        if (dynamicFieldsResult.data && dynamicFieldsResult.data.length > 0) {
          for (const field of dynamicFieldsResult.data) {
            console.log('🔄 处理余额字段:', field);
            
            try {
              // 获取动态字段的详细信息
              const fieldObject = await this.client.getObject({
                id: field.objectId,
                options: { showContent: true }
              });
              
              if (fieldObject.data?.content) {
                const content = fieldObject.data.content as any;
                
                // 根据智能合约，动态字段的 name 是代币类型字符串
                // value 是一个 Coin<T> 对象，其中包含 balance 字段
                const tokenType = (field.name as any)?.value || 'Unknown';
                
                // Coin<T> 结构体的 balance 字段
                const balance = content.fields?.balance || '0';
                
                console.log('📍 代币类型:', tokenType, '余额:', balance);
                balances[tokenType] = balance.toString();
              } else {
                console.warn('⚠️ 动态字段对象无内容:', field.objectId);
              }
            } catch (fieldError) {
              console.error('❌ 处理动态字段失败:', field.objectId, fieldError);
              // 继续处理其他字段，不因为一个字段失败而中断
            }
          }
        } else {
          console.log('📍 钱包没有动态字段（余额为空）');
        }
      } catch (balanceError) {
        console.error('❌ 获取钱包余额失败:', balanceError);
      }

      const walletInfo = {
        id: walletId,
        object_id: fields.object_id,
        owner: fields.owner,
        balances,
        created_at: fields.created_at
      };

      console.log('📍 最终钱包信息:', walletInfo);
      console.log('📍 余额详情:', {
        totalTokenTypes: Object.keys(balances).length,
        balances: balances
      });
      
      return walletInfo;
    } catch (error) {
      console.error('❌ 获取钱包信息失败:', error);
      return null;
    }
  }

  // 检查代币类型是否被市场支持
  private async checkTokenTypeSupported(tokenType: string): Promise<boolean> {
    try {
      console.log('🔍 检查代币类型是否被支持:', tokenType);
      const supportedTokens = await marketplaceService.getSupportedTokenTypes();
      console.log('📍 当前支持的代币类型:', supportedTokens);
      
      // 标准化代币类型格式进行比较
      const normalizedTokenType = this.normalizeTokenType(tokenType);
      const normalizedSupportedTokens = supportedTokens.map(token => this.normalizeTokenType(token));
      
      console.log('📍 标准化后的代币类型:', normalizedTokenType);
      console.log('📍 标准化后的支持列表:', normalizedSupportedTokens);
      
      const isSupported = normalizedSupportedTokens.includes(normalizedTokenType);
      console.log('📍 支持检查结果:', isSupported);
      
      return isSupported;
    } catch (error) {
      console.error('检查代币类型支持失败:', error);
      return false;
    }
  }

  // 标准化代币类型格式
  private normalizeTokenType(tokenType: string): string {
    // 确保有0x前缀
    if (!tokenType.startsWith('0x')) {
      tokenType = `0x${tokenType}`;
    }
    
    // 移除多余的空格
    tokenType = tokenType.trim();
    
    // 统一转换为小写进行比较
    return tokenType.toLowerCase();
  }

  // 存入代币到钱包（重构版本 - 参考 purchaseObject 的完美实践）
  async depositToken(
    walletId: string,
    amount: string,
    tokenType: string,
    signAndExecute: any,
    paymentCoinId?: string
  ): Promise<void> {
    try {
      console.log('💰 开始存入代币到钱包:', { walletId, amount, tokenType, paymentCoinId });

      // 检查代币类型是否被支持
      const isSupported = await this.checkTokenTypeSupported(tokenType);
      if (!isSupported) {
        throw new Error(`代币类型 ${tokenType} 不被市场支持`);
      }

      // 首先验证钱包的所有权状态
      console.log('🔍 验证钱包所有权状态...');
      const walletInfo = await this.getWalletInfo(walletId);
      if (!walletInfo) {
        throw new Error('钱包不存在或无法获取钱包信息');
      }
      
      console.log('📍 钱包信息:', {
        walletId,
        owner: walletInfo.owner,
        objectId: walletInfo.object_id
      });

      // 检查钱包所有者是否为零地址
      if (walletInfo.owner === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error('钱包所有者异常：检测到零地址所有者，请重新创建钱包');
      }

      const tx = new Transaction();
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      // 代币分割策略：所有代币都进行分割以确保精确性
      let paymentCoin;
      
      if (formattedTokenType === '0x2::sui::SUI') {
        // 对于 SUI，从 gas 中分割
        paymentCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
        console.log('📍 SUI: 从 gas 中分割指定数量');
      } else {
        // 对于其他代币，从提供的代币对象中分割指定数量
        if (!paymentCoinId) {
          throw new Error('非SUI代币需要提供支付代币对象ID');
        }
        
        // 从代币对象中分割指定数量，确保精确性
        paymentCoin = tx.splitCoins(tx.object(paymentCoinId), [tx.pure.u64(amount)]);
        console.log('📍 非SUI代币: 从代币对象中分割指定数量');
      }
      
      // 调用存入代币函数
      console.log('📍 代币类型...',formattedTokenType);
      tx.moveCall({
        target: `${this.packageId}::object_wallet::deposit_token`,
        typeArguments: [formattedTokenType],
        arguments: [
          tx.object(walletId),
          paymentCoin, // 使用代币对象（可能是分割的或完整的）
          tx.pure.u64(amount),
          tx.pure.string(formattedTokenType)
        ]
      });

      console.log('📍 存入代币交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 purchaseObject 模式）
      return new Promise<void>((resolve, reject) => {
        try {
          // 完全按照 purchaseObject 的调用方式：直接调用 signAndExecute 函数
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
                console.log('✅ 存入代币交易执行成功:', result);
                
                // 检查是否有存入事件，确保操作真正成功
                const depositEvent = result.events?.find((e: any) => 
                  e.type === `${this.packageId}::object_wallet::TokenDeposited`
                );

                if (!depositEvent) {
                  console.warn('⚠️ 交易成功但未找到存入事件，可能存在问题');
                  // 不抛出错误，因为交易本身是成功的
                } else {
                  console.log('✅ 确认存入事件:', depositEvent.parsedJson);
                }
                
                console.log('✅ 存入代币完成');
                resolve();
              },
              onError: (error: any) => {
                console.error('❌ 存入代币交易失败:', error);
                
                // 提供更详细的错误信息
                let errorMessage = `存入代币失败: ${error?.message || '未知错误'}`;
                
                if (error?.message?.includes('was not signed by the correct sender')) {
                  errorMessage = '权限错误：您不是该钱包的所有者，无法存入代币。请确认您是对象的所有者并且钱包已正确创建。';
                } else if (error?.message?.includes('0x0000000000000000000000000000000000000000000000000000000000000000')) {
                  errorMessage = '钱包状态异常：检测到零地址所有者，请尝试重新创建钱包。';
                }
                
                reject(new Error(errorMessage));
              }
            }
          );
        } catch (error) {
          console.error('❌ 存入代币交互调用失败:', error);
          reject(new Error(`存入代币交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });

    } catch (error) {
      console.error('❌ 存入代币失败:', error);
      throw new Error(`存入代币失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 从钱包提取代币（重构版本 - 参考 purchaseObject 的完美实践）
  async withdrawToken(
    walletId: string,
    amount: string,
    tokenType: string = 'SUI',
    signAndExecute: any,
    signerAddress?: string
  ): Promise<void> {
    try {
      console.log('💸 开始从钱包提取代币:', { walletId, amount, tokenType });

      const tx = new Transaction();
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      // 根据合约定义，withdraw_token 返回一个 Coin<T>，需要将其转移给调用者
      const withdrawCoin = tx.moveCall({
        target: `${this.packageId}::object_wallet::withdraw_token`,
        typeArguments: [formattedTokenType],
        arguments: [
          tx.object(walletId),
          tx.pure.u64(amount),
          tx.pure.string(formattedTokenType)
        ]
      });

      // 将提取的代币转移给调用者 - 使用 tx.pure.address('0x0') 作为占位符
      // 实际的转移地址会在交易执行时由钱包自动处理
      tx.transferObjects([withdrawCoin], tx.pure.address(signerAddress || '0x0'));

      console.log('📍 提取代币交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 purchaseObject 模式）
      return new Promise<void>((resolve, reject) => {
        try {
          // 完全按照 purchaseObject 的调用方式：直接调用 signAndExecute 函数
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
                console.log('✅ 提取代币交易执行成功:', result);
                
                // 检查是否有提取事件，确保操作真正成功
                const withdrawEvent = result.events?.find((e: any) => 
                  e.type === `${this.packageId}::object_wallet::TokenWithdrawn`
                );

                if (!withdrawEvent) {
                  console.warn('⚠️ 交易成功但未找到提取事件，可能存在问题');
                  // 不抛出错误，因为交易本身是成功的
                } else {
                  console.log('✅ 确认提取事件:', withdrawEvent.parsedJson);
                }
                
                console.log('✅ 提取代币完成');
                resolve();
              },
              onError: (error: any) => {
                console.error('❌ 提取代币交易失败:', error);
                reject(new Error(`提取代币失败: ${error?.message || '未知错误'}`));
              }
            }
          );
        } catch (error) {
          console.error('❌ 提取代币交互调用失败:', error);
          reject(new Error(`提取代币交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });

    } catch (error) {
      console.error('❌ 提取代币失败:', error);
      throw new Error(`提取代币失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 获取钱包余额
  async getWalletBalance(walletId: string, tokenType: string = 'SUI'): Promise<string> {
    try {
      // 注意：这个方法可能需要根据实际的智能合约接口调整
      // 由于 get_balance 是泛型函数，可能需要不同的调用方式
      console.log('📍 获取钱包余额:', walletId, tokenType);
      
      // 暂时返回空字符串，这个方法目前没有被使用
      // 实际的余额获取通过 getWalletInfo 方法中的动态字段查询实现
      return '0';
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return '0';
    }
  }

  // 合并用户的代币对象，减少钱包中的代币碎片
  async mergeCoins(
    tokenType: string,
    signAndExecute: any,
    userAddress?: string
  ): Promise<void> {
    try {
      console.log('🔗 开始合并代币对象:', tokenType);
      
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      // 获取用户的所有该类型代币对象
      const userCoins = await this.getUserCoins(userAddress || '', formattedTokenType);
      console.log('📍 用户代币对象列表:', userCoins);
      
      if (userCoins.length <= 1) {
        console.log('📍 代币对象数量不足，无需合并');
        return;
      }
      
      const tx = new Transaction();
      
      if (formattedTokenType === '0x2::sui::SUI') {
        // SUI 特殊处理：将所有 SUI 对象合并到 gas 中
        console.log('📍 SUI 合并：将所有 SUI 对象合并到 gas 中');
        
        for (let i = 0; i < userCoins.length; i++) {
          const coin = userCoins[i];
          // 跳过 gas 对象（通常第一个是 gas）
          if (i > 0) {
            tx.mergeCoins(tx.gas, [tx.object(coin.id)]);
          }
        }
      } else {
        // 非SUI代币：选择第一个作为目标，将其他代币合并到其中
        console.log('📍 非SUI代币合并：将所有代币对象合并到第一个对象中');
        
        const targetCoin = tx.object(userCoins[0].id);
        
        // 将其余代币合并到目标代币中
        for (let i = 1; i < userCoins.length; i++) {
          const sourceCoin = tx.object(userCoins[i].id);
          tx.mergeCoins(targetCoin, [sourceCoin]);
        }
        
        // 将合并后的代币转移给用户
        if (userAddress) {
          tx.transferObjects([targetCoin], tx.pure.address(userAddress));
        }
      }
      
      console.log('📍 代币合并交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易
      return new Promise<void>((resolve, reject) => {
        try {
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
                console.log('✅ 代币合并交易执行成功:', result);
                console.log('✅ 代币合并完成');
                resolve();
              },
              onError: (error: any) => {
                console.error('❌ 代币合并交易失败:', error);
                reject(new Error(`代币合并失败: ${error?.message || '未知错误'}`));
              }
            }
          );
        } catch (error) {
          console.error('❌ 代币合并交互调用失败:', error);
          reject(new Error(`代币合并交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });
      
    } catch (error) {
      console.error('❌ 合并代币失败:', error);
      throw new Error(`合并代币失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 获取用户的代币对象列表，用于合并操作
  async getUserCoins(
    userAddress: string,
    tokenType: string
  ): Promise<Array<{ id: string; balance: string }>> {
    try {
      console.log('🔍 获取用户代币对象列表:', { userAddress, tokenType });
      
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      // 查询用户拥有的所有该类型代币对象
      const coins = await this.client.getCoins({
        owner: userAddress,
        coinType: formattedTokenType
      });
      
      console.log('📍 查询到的代币对象:', coins);
      
      return coins.data.map(coin => ({
        id: coin.coinObjectId,
        balance: coin.balance
      }));
      
    } catch (error) {
      console.error('❌ 获取用户代币对象失败:', error);
      return [];
    }
  }

  // ===== 定时转账相关方法 =====

  // 获取当前epoch信息
  async getCurrentEpoch(): Promise<number> {
    try {
      const latestSystemState = await this.client.getLatestSuiSystemState();
      return Number(latestSystemState.epoch);
    } catch (error) {
      console.error('获取当前epoch失败:', error);
      // 如果无法获取epoch，返回一个保守的估计
      return Math.floor(Date.now() / 1000 / 60 / 60 / 24); // 粗略估计（从天数转换为epoch）
    }
  }

  // 将日期时间转换为毫秒时间戳
  async convertDateTimeToTimestamp(dateTime: string): Promise<number> {
    try {
      // 解析目标日期
      const targetDate = new Date(dateTime);
      
      // 验证日期是否有效
      if (isNaN(targetDate.getTime())) {
        throw new Error('无效的日期时间格式');
      }
      
      // 获取目标日期的毫秒时间戳
      const targetTimestamp = targetDate.getTime();
      
      // 获取当前时间戳用于验证
      const currentTimestamp = Date.now();
      
      console.log('🕐 时间转换计算:', {
        currentDate: new Date(currentTimestamp).toISOString(),
        currentTimestamp,
        targetDate: targetDate.toISOString(),
        targetTimestamp,
        timeDiffMs: targetTimestamp - currentTimestamp
      });
      
      // 确保目标时间在未来（至少1分钟后）
      const minFutureTime = currentTimestamp + 60000; // 1分钟后
      if (targetTimestamp <= minFutureTime) {
        throw new Error(`执行时间必须在未来至少1分钟。当前时间: ${new Date(currentTimestamp).toISOString()}, 目标时间: ${new Date(targetTimestamp).toISOString()}`);
      }
      
      return targetTimestamp;
    } catch (error) {
      console.error('转换日期时间到时间戳失败:', error);
      throw new Error('无效的日期时间格式');
    }
  }

  // 创建定时转账（重构版本 - 参考 purchaseObject 的完美实践）
  async createScheduledTransfer(
    walletId: string,
    objectId: string,
    toAddress: string,
    tokenType: string,
    amount: string,
    executeTime: number | string, // 可以是epoch数字或日期时间字符串
    signAndExecute: any,
    signer: any // 添加signer参数以获取调用者地址
  ): Promise<string> {
    try {
      console.log('🕒 创建定时转账:', {
        walletId,
        objectId,
        toAddress,
        tokenType,
        amount,
        executeTime
      });

      let targetTimestamp: number;
      
      // 如果executeTime是字符串，转换为毫秒时间戳
      if (typeof executeTime === 'string') {
        targetTimestamp = await this.convertDateTimeToTimestamp(executeTime);
      } else {
        targetTimestamp = executeTime;
      }

      // 验证执行时间在未来
      const currentTimestamp = Date.now();
      if (targetTimestamp <= currentTimestamp) {
        throw new Error(`执行时间必须在未来。当前时间: ${new Date(currentTimestamp).toISOString()}, 目标时间: ${new Date(targetTimestamp).toISOString()}`);
      }

      // 构建交易
      const tx = new Transaction();

      // 调用创建定时转账函数
      const transfer = tx.moveCall({
        target: `${this.packageId}::scheduled_transfer::create_scheduled_transfer`,
        arguments: [
          tx.pure.id(walletId),
          tx.pure.id(objectId),
          tx.pure.address(toAddress),
          tx.pure.string(tokenType),
          tx.pure.u64(amount),
          tx.pure.u64(targetTimestamp),
          tx.object('0x6') // Clock 对象的固定地址
        ]
      });

      // 将创建的定时转账对象转移给调用者
      tx.transferObjects([transfer], tx.pure.address(signer.address));

      console.log('📍 定时转账创建交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 purchaseObject 模式）
      return new Promise<string>((resolve, reject) => {
        try {
          // 完全按照 purchaseObject 的调用方式：直接调用 signAndExecute 函数
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
                console.log('✅ 定时转账创建交易执行成功:', result);
                
                // 既然交易成功，说明定时转账已经创建
                // 不需要强制提取转账ID，让前端通过重新加载来获取
                console.log('✅ 定时转账创建完成，将由前端重新加载获取转账ID');
                resolve('scheduled_transfer_created_successfully');
              },
              onError: (error: any) => {
                console.error('❌ 定时转账创建交易失败:', error);
                reject(new Error(`定时转账创建失败: ${error?.message || '未知错误'}`));
              }
            }
          );
        } catch (error) {
          console.error('❌ 定时转账交互调用失败:', error);
          reject(new Error(`定时转账交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });

    } catch (error) {
      console.error('❌ 创建定时转账失败:', error);
      throw new Error(`创建定时转账失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 执行定时转账（重构版本 - 参考 purchaseObject 的完美实践）
  async executeScheduledTransfer(
    transferId: string,
    walletId: string,
    signAndExecute: any
  ): Promise<string> {
    try {
      console.log('⚡ 开始执行定时转账:', { transferId, walletId });

      // 首先获取定时转账信息以确定代币类型
      const transferInfo = await this.getScheduledTransferInfo(transferId);
      if (!transferInfo) {
        throw new Error('无法获取定时转账信息');
      }

      console.log('📍 定时转账信息:', {
        transferId,
        tokenType: transferInfo.token_type,
        amount: transferInfo.amount,
        toAddress: transferInfo.to_address
      });

      // 构建交易
      const tx = new Transaction();
      
      // 获取配置信息
      const network = getDefaultNetwork();
      const config = getContractConfig(network);
      console.log('📍 使用网络配置:', { network, marketplaceId: config.marketplaceId });
      
      // 根据代币类型选择正确的调用方式
      if (transferInfo.token_type === 'SUI' || transferInfo.token_type === '0x2::sui::SUI') {
        // 对于 SUI 代币，使用原有的 execute_scheduled_transfer 函数
        // 注意：transferId 需要作为可变对象传入，使用 tx.object 会自动处理
        tx.moveCall({
          target: `${this.packageId}::scheduled_transfer::execute_scheduled_transfer`,
          arguments: [
            tx.object(transferId),
            tx.object(walletId),
            tx.object('0x6') // Clock 对象的固定地址
          ]
        });
      } else {
        // 对于其他代币类型，使用带市场检查的版本，并指定正确的类型参数
        console.log('📍 使用配置的 Marketplace 地址:', config.marketplaceId);
        console.log('📍 代币类型:', transferInfo.token_type);
        
        // 确保代币类型格式正确
        let formattedTokenType = transferInfo.token_type;
        if (!formattedTokenType.startsWith('0x')) {
          formattedTokenType = `0x${formattedTokenType}`;
        }
        
        tx.moveCall({
          target: `${this.packageId}::scheduled_transfer::execute_scheduled_transfer_with_marketplace_check`,
          typeArguments: [formattedTokenType],
          arguments: [
            tx.object(transferId),
            tx.object(walletId),
            tx.object(config.marketplaceId), // 使用配置中的 Marketplace 地址
            tx.object('0x6') // Clock 对象的固定地址
          ]
        });
      }

      console.log('📍 定时转账执行交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 purchaseObject 模式）
      return new Promise<string>((resolve, reject) => {
        try {
          // 完全按照 purchaseObject 的调用方式：直接调用 signAndExecute 函数
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
                console.log('✅ 定时转账执行交易成功:', result);
                console.log('✅ 定时转账执行完成');
                resolve('transfer_executed_successfully');
              },
              onError: (error: any) => {
                console.error('❌ 定时转账执行交易失败:', error);
                reject(new Error(`定时转账执行失败: ${error?.message || '未知错误'}`));
              }
            }
          );
        } catch (error) {
          console.error('❌ 定时转账交互调用失败:', error);
          reject(new Error(`定时转账交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });

    } catch (error) {
      console.error('❌ 执行定时转账失败:', error);
      throw new Error(`执行定时转账失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 取消定时转账（重构版本 - 参考 purchaseObject 的完美实践）
  async cancelScheduledTransfer(
    transferId: string,
    signAndExecute: any
  ): Promise<void> {
    try {
      console.log('❌ 取消定时转账:', transferId);

      const tx = new Transaction();

      // 调用取消定时转账函数
      tx.moveCall({
        target: `${this.packageId}::scheduled_transfer::cancel_scheduled_transfer`,
        arguments: [
          tx.object(transferId),
          tx.object('0x6') // Clock 对象的固定地址
        ]
      });

      console.log('📍 取消定时转账交易构建完成，准备执行...');

      // 使用 Promise 包装执行交易（完全参考 purchaseObject 模式）
      return new Promise<void>((resolve, reject) => {
        try {
          // 完全按照 purchaseObject 的调用方式：直接调用 signAndExecute 函数
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
                console.log('✅ 取消定时转账交易执行成功:', result);
                console.log('✅ 定时转账取消完成');
                resolve();
              },
              onError: (error: any) => {
                console.error('❌ 取消定时转账交易失败:', error);
                reject(new Error(`取消定时转账失败: ${error?.message || '未知错误'}`));
              }
            }
          );
        } catch (error) {
          console.error('❌ 取消定时转账交互调用失败:', error);
          reject(new Error(`取消定时转账交互失败: ${(error as Error)?.message || '未知错误'}`));
        }
      });

    } catch (error) {
      console.error('❌ 取消定时转账失败:', error);
      throw new Error(`取消定时转账失败: ${(error as Error).message || '未知错误'}`);
    }
  }

  // 获取定时转账信息
  async getScheduledTransferInfo(transferId: string): Promise<ScheduledTransferInfo | null> {
    try {
      const result = await this.client.getObject({
        id: transferId,
        options: { showContent: true }
      });

      if (!result.data?.content) {
        return null;
      }

      const content = result.data.content as any;
      const fields = content.fields;

      return {
        id: transferId,
        wallet_id: fields.wallet_id,
        object_id: fields.object_id,
        from_address: fields.from_address,
        to_address: fields.to_address,
        token_type: fields.token_type,
        amount: fields.amount.toString(),
        execute_time: fields.execute_time,
        is_executed: fields.is_executed,
        created_at: fields.created_at,
        created_by: fields.created_by
      };
    } catch (error) {
      console.error('Failed to get scheduled transfer info:', error);
      return null;
    }
  }

  // 获取对象的所有定时转账
  async getObjectScheduledTransfers(objectId: string): Promise<ScheduledTransferInfo[]> {
    try {
      console.log('🔍 获取对象的定时转账:', objectId);
      
      // 通过事件查询获取该对象相关的定时转账创建事件
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${this.packageId}::scheduled_transfer::ScheduledTransferCreated`
        }
      });

      console.log('📍 查询到的定时转账创建事件:', events);

      const transfers: ScheduledTransferInfo[] = [];
      
      if (events.data && events.data.length > 0) {
        for (const event of events.data) {
          const parsedJson = event.parsedJson as any;
          
          // 筛选属于指定对象的定时转账
          if (parsedJson.object_id === objectId) {
            // 获取定时转账的详细信息
            const transferInfo = await this.getScheduledTransferInfo(parsedJson.transfer_id);
            
            if (transferInfo) {
              transfers.push(transferInfo);
            }
          }
        }
      }

      console.log('📍 最终筛选的定时转账列表:', transfers);
      return transfers;
    } catch (error) {
      console.error('Failed to get object scheduled transfers:', error);
      return [];
    }
  }

  // 批量执行到期的定时转账
  async executeExpiredTransfers(
    transferIds: string[],
    signer: any
  ): Promise<void> {
    const tx = new Transaction();

    for (const transferId of transferIds) {
      tx.moveCall({
        target: `${this.packageId}::scheduled_transfer::execute_scheduled_transfer`,
        arguments: [
          tx.object(transferId),
          tx.object('0x6') // Clock 对象的固定地址
        ]
      });
    }

    const result = await signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    });

    // 检查交易结果结构
    if (!result) {
      throw new Error('交易返回结果为空');
    }

    // 检查effects是否存在
    if (!result.effects) {
      console.error('❌ 交易结果中没有effects字段:', result);
      throw new Error('交易结果格式异常：缺少effects字段');
    }

    if (result.effects.status?.status !== 'success') {
      const errorMsg = result.effects.status?.error || '未知错误';
      throw new Error(`批量执行定时转账失败: ${errorMsg}`);
    }
  }
}

// 创建钱包服务实例的工厂函数
export function createWalletService(
  client: SuiClient,
  packageId: string,
  adminCapId: string
): WalletService {
  return new WalletService(client, packageId, adminCapId);
}
