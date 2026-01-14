import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { NetworkType, networkConfig } from '../config/networkConfig';
import { getContractConfig } from '../config/contractConfig';

// 代币类型接口
export interface SupportedToken {
  type: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

// 市场信息接口
export interface MarketplaceInfo {
  id: string;
  admin: string;
  treasury: string;
  supportedTokensCount: number;
}

// 市场服务类
export class MarketplaceService {
  private client: SuiClient;
  private packageId: string;
  private marketplaceId: string;

  constructor(network: NetworkType = 'testnet') {
    // 使用contractConfig获取配置
    const config = getContractConfig(network);
    
    if (!config.packageId || !config.marketplaceId) {
      throw new Error(`Missing configuration for ${network}. Please check your .env file.`);
    }
    
    this.client = new SuiClient({
      url: getFullnodeUrl(network),
    });
    this.packageId = config.packageId;
    this.marketplaceId = config.marketplaceId;
  }

  /**
   * 获取支持的代币类型列表
   */
  async getSupportedTokenTypes(): Promise<string[]> {
    try {
      console.log('🔍 获取支持的代币类型列表...');
      console.log('📍 Marketplace ID:', this.marketplaceId);
      console.log('📍 Package ID:', this.packageId);
      
      const result = await this.client.getObject({
        id: this.marketplaceId,
        options: {
          showContent: true,
          showDisplay: true,
          showType: true
        }
      });

      console.log('📍 Marketplace 查询结果:', JSON.stringify(result, null, 2));

      if ((result.data?.content as any)?.type === `${this.packageId}::trading_object::Marketplace`) {
        const content = result.data?.content as any;
        console.log('📍 Marketplace 内容:', JSON.stringify(content, null, 2));
        
        const supportedTokens = content.fields.supported_tokens;
        console.log('📍 supported_tokens 字段:', JSON.stringify(supportedTokens, null, 2));
        
        if (supportedTokens && supportedTokens.fields && supportedTokens.fields.id) {
          // 获取 Table 的内容
          const tableId = supportedTokens.fields.id.id;
          console.log('📍 Table ID:', tableId);
          console.log('📍 Table size:', supportedTokens.fields.size);
          
          try {
            // 获取 Table 中的所有条目
            const tableResult = await this.client.getDynamicFields({
              parentId: tableId
            });
            
            console.log('📍 Table 动态字段结果:', JSON.stringify(tableResult, null, 2));
            console.log('📍 Table 数据数量:', tableResult.data?.length || 0);
            
            if (tableResult.data && tableResult.data.length > 0) {
              const tokenTypes = tableResult.data.map((field: any) => {
                console.log('🔄 处理字段:', JSON.stringify(field, null, 2));
                // field.name.value 包含代币类型字符串
                const tokenType = field.name.value;
                console.log('📍 提取的代币类型:', tokenType);
                return tokenType;
              });
              
              console.log('📍 解析出的代币类型:', tokenTypes);
              return tokenTypes;
            } else {
              console.log('📍 Table 中没有数据');
              return [];
            }
          } catch (tableError) {
            console.error('❌ 获取 Table 内容失败:', tableError);
            return [];
          }
        } else {
          console.log('❌ supported_tokens 结构不符合预期');
          return [];
        }
      } else {
        console.log('❌ 对象类型不匹配，期望 Marketplace');
        return [];
      }
    } catch (error) {
      console.error('❌ 获取支持的代币类型失败:', error);
      return [];
    }
  }

  /**
   * 获取支持的代币详细信息
   */
  async getSupportedTokens(): Promise<SupportedToken[]> {
    try {
      const tokenTypes = await this.getSupportedTokenTypes();
      const tokens: SupportedToken[] = [];
      
      // 如果没有获取到代币类型，返回默认的SUI代币
      if (tokenTypes.length === 0) {
        tokens.push({
          type: '0x2::sui::SUI',
          symbol: 'SUI',
          name: 'Sui',
          decimals: 9,
          icon: undefined
        });
      } else {
        for (const tokenType of tokenTypes) {
          try {
            // 提取代币符号和名称
            const symbol = this.extractTokenSymbol(tokenType);
            const name = this.extractTokenName(tokenType);
            
            // 获取代币元数据
            let decimals = 9; // 默认精度
            let icon = undefined;
            
            try {
              // 尝试获取代币元数据
              const metadata = await this.client.getCoinMetadata({ coinType: tokenType });
              if (metadata) {
                decimals = metadata.decimals || decimals;
              }
            } catch (metadataError) {
              // 静默处理元数据获取失败
            }
            
            tokens.push({
              type: tokenType,
              symbol,
              name,
              decimals,
              icon
            });
          } catch (tokenError) {
            // 静默处理代币处理失败
          }
        }
      }
      
      return tokens;
    } catch (error) {
      // 即使失败也返回默认的SUI代币
      return [{
        type: '0x2::sui::SUI',
        symbol: 'SUI',
        name: 'Sui',
        decimals: 9,
        icon: undefined
      }];
    }
  }

  /**
   * 从代币类型中提取符号
   */
  private extractTokenSymbol(tokenType: string): string {
    try {
      // 确保代币类型有 0x 前缀
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      // 处理标准代币格式: 0x2::sui::SUI
      if (formattedTokenType === '0x2::sui::SUI') {
        return 'SUI';
      }
      
      // 处理常见的标准代币
      const knownTokens: { [key: string]: string } = {
        // 主网 USDC
        '0x5d4b302506645c37ff133b98c4b50a5ae1484165973826b7b787a233ac7f3a17::usdc::USDC': 'USDC',
        // 测试网 USDC (从 coinmanager 项目)
        '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN': 'USDC',
        // SUI
        '0x2::sui::SUI': 'SUI',
        // USDT (示例)
        '0x6f9bae4d1e3c42d3b5ae5e1a9c2c9e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d::usdt::USDT': 'USDT',
      };
      
      // 检查已知代币
      if (knownTokens[formattedTokenType]) {
        return knownTokens[formattedTokenType];
      }
      
      // 从类型字符串中提取最后部分作为符号
      const parts = formattedTokenType.split('::');
      if (parts.length >= 3) {
        return parts[2];
      }
      
      return 'UNKNOWN';
    } catch (error) {
      console.warn('提取代币符号失败:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * 从代币类型中提取名称
   */
  private extractTokenName(tokenType: string): string {
    try {
      const symbol = this.extractTokenSymbol(tokenType);
      
      // 常见代币的完整名称
      const knownNames: { [key: string]: string } = {
        'SUI': 'Sui',
        'USDC': 'USD Coin',
        'USDT': 'Tether USD',
      };
      
      return knownNames[symbol] || symbol;
    } catch (error) {
      console.warn('提取代币名称失败:', error);
      return 'Unknown Token';
    }
  }

  /**
   * 获取市场信息
   */
  async getMarketplaceInfo(): Promise<MarketplaceInfo | null> {
    try {
      const result = await this.client.getObject({
        id: this.marketplaceId,
        options: {
          showContent: true
        }
      });

      if ((result.data?.content as any)?.type === `${this.packageId}::trading_object::Marketplace`) {
        const content = result.data?.content as any;
        
        return {
          id: this.marketplaceId,
          admin: content.fields.admin,
          treasury: content.fields.treasury,
          supportedTokensCount: content.fields.supported_tokens.fields.size
        };
      }
      
      return null;
    } catch (error) {
      console.error('获取市场信息失败:', error);
      return null;
    }
  }

  /**
   * 更新网络配置
   */
  updateNetwork(network: NetworkType): void {
    const config = getContractConfig(network);
    
    if (!config.packageId || !config.marketplaceId) {
      throw new Error(`Missing configuration for ${network}. Please check your .env file.`);
    }
    
    this.client = new SuiClient({
      url: getFullnodeUrl(network),
    });
    this.packageId = config.packageId;
    this.marketplaceId = config.marketplaceId;
  }

  /**
   * 获取市场统计数据
   */
  async getMarketStats(): Promise<{
    totalObjects: number;
    activeListings: number;
    totalVolume: number;
  }> {
    try {
      console.log('🔍 获取市场统计数据...');
      
      // 获取市场对象信息
      const result = await this.client.getObject({
        id: this.marketplaceId,
        options: {
          showContent: true
        }
      });

      if ((result.data?.content as any)?.type === `${this.packageId}::trading_object::Marketplace`) {
        const content = result.data?.content as any;
        const objects = content.fields.objects as any[];
        
        // 计算统计数据
        const totalObjects = objects.length;
        const activeListings = objects.filter((obj: any) => obj.fields.is_for_sale).length;
        
        // 这里可以添加交易量的计算逻辑
        // 目前返回模拟数据，实际实现需要从交易历史中计算
        const totalVolume = 0; // 需要从交易历史中计算
        
        console.log('📍 市场统计:', { totalObjects, activeListings, totalVolume });
        
        return {
          totalObjects,
          activeListings,
          totalVolume
        };
      }
      
      return {
        totalObjects: 0,
        activeListings: 0,
        totalVolume: 0
      };
    } catch (error) {
      console.error('❌ 获取市场统计数据失败:', error);
      return {
        totalObjects: 0,
        activeListings: 0,
        totalVolume: 0
      };
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      packageId: this.packageId,
      marketplaceId: this.marketplaceId
    };
  }
}

// 导出单例实例
export const marketplaceService = new MarketplaceService();
