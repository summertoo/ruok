import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { contractService } from '../services/contractService';
import { marketplaceService, SupportedToken } from '../services/marketplaceService';
import { useLanguage } from '../contexts/LanguageContext';
import ObjectWallet from './ObjectWallet';
import PurchaseProgress from './PurchaseProgress';

interface TradingObject {
  id: string;
  owner: string;
  bot: string;
  emoji: string;
  profile_picture: string;
  blob_id: string;
  price: number;
  is_for_sale: boolean;
  token_type?: string; // 新增字段，表示定价代币类型
}

interface ObjectListProps {
  objects: TradingObject[];
  onObjectPurchased: (objectId: string) => void;
  currentAccount?: string;
  onObjectEdit?: (object: TradingObject) => void;
  isMarketView?: boolean; // 新增属性，区分市场视图和管理视图
}

const ObjectList: React.FC<ObjectListProps> = ({ 
  objects, 
  onObjectPurchased, 
  currentAccount,
  onObjectEdit,
  isMarketView = true // 默认为市场视图
}) => {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  
  // 钱包相关状态
  const [walletObjectId, setWalletObjectId] = useState<string | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  
  // 购买流程相关状态
  const [selectedObject, setSelectedObject] = useState<TradingObject | null>(null);
  const [purchaseStep, setPurchaseStep] = useState(1);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseProgress, setPurchaseProgress] = useState(0);

  // 加载支持的代币列表
  useEffect(() => {
    const loadSupportedTokens = async () => {
      try {
        const tokens = await marketplaceService.getSupportedTokens();
        setSupportedTokens(tokens);
      } catch (error) {
        console.error('Failed to load supported tokens:', error);
      }
    };

    loadSupportedTokens();
  }, []);

  // 获取代币符号
  const getTokenSymbol = (tokenType: string): string => {
    // 确保代币类型有 0x 前缀进行匹配
    const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
    
    // 首先尝试从链上获取的代币列表中匹配
    let token = supportedTokens.find(t => t.type === formattedTokenType);
    
    // 如果链上列表中没有匹配，使用已知的代币映射作为后备
    if (!token) {
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
      
      const symbol = knownTokens[formattedTokenType];
      if (symbol) {
        return symbol;
      }
    }
    
    return token?.symbol || 'Unknown';
  };

  // 检查用户是否有足够的代币余额
  const checkTokenBalance = async (address: string, tokenType: string, requiredAmount: number): Promise<{ hasBalance: boolean; coinId?: string; balance?: number }> => {
    try {
      console.log('🔍 检查用户代币余额...');
      console.log('📍 用户地址:', address);
      console.log('📍 原始代币类型:', tokenType);
      console.log('📍 需要金额:', requiredAmount);
      
      // 确保代币类型有 0x 前缀
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      console.log('📍 格式化后代币类型:', formattedTokenType);
      
      const suiClient = contractService.getSuiClient();
      const coins = await suiClient.getCoins({
        owner: address,
        coinType: formattedTokenType,
      });

      console.log('📍 查询到的代币数量:', coins.data.length);
      console.log('📍 代币详情:', coins.data);

      if (coins.data.length === 0) {
        const tokenSymbol = getTokenSymbol(tokenType);
        console.log(`❌ 用户没有 ${tokenSymbol} (${tokenType}) 代币`);
        
        // 尝试获取用户的所有代币来调试
        try {
          const allCoins = await suiClient.getAllCoins({
            owner: address,
          });
          console.log('📍 用户所有代币:', allCoins.data.map(coin => ({
            type: coin.coinType,
            balance: coin.balance,
            symbol: getTokenSymbol(coin.coinType)
          })));
        } catch (allCoinsError) {
          console.error('获取用户所有代币失败:', allCoinsError);
        }
        
        return { hasBalance: false };
      }

      // 计算总余额 - 添加安全检查
      if (!coins.data || !Array.isArray(coins.data)) {
        console.error('❌ coins.data 不是有效的数组:', coins.data);
        return { hasBalance: false };
      }
      
      const totalBalance = coins.data.reduce((sum, coin) => sum + Number(coin.balance), 0);
      console.log('📍 总余额:', totalBalance, '需要余额:', requiredAmount);

      if (totalBalance < requiredAmount) {
        const tokenSymbol = getTokenSymbol(tokenType);
        const decimals = getTokenDecimals(tokenType);
        const actualBalance = totalBalance / Math.pow(10, decimals);
        const neededAmount = requiredAmount / Math.pow(10, decimals);
        
        console.log(`❌ ${tokenSymbol} 余额不足: 实际 ${actualBalance}, 需要 ${neededAmount}`);
        return { hasBalance: false, balance: totalBalance };
      }

      // 返回第一个代币的 ID
      const coinId = coins.data[0].coinObjectId;
      console.log('✅ 余额充足，找到代币 ID:', coinId);
      return { hasBalance: true, coinId, balance: totalBalance };
    } catch (error) {
      console.error('❌ 检查代币余额失败:', error);
      return { hasBalance: false };
    }
  };

  // 获取代币精度
  const getTokenDecimals = (tokenType: string): number => {
    const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
    
    if (formattedTokenType.includes('sui::SUI')) return 9;
    if (formattedTokenType.includes('usdc') || formattedTokenType.includes('USDC')) return 6;
    // 特殊处理测试USDC
    if (formattedTokenType.includes('test_coin::TEST_COIN')) return 6;
    return 9; // 默认精度
  };

  // 获取用户的指定代币 ID (保留原方法以兼容)
  const getCoinId = async (address: string, tokenType: string): Promise<string | null> => {
    const result = await checkTokenBalance(address, tokenType, 0);
    return result.coinId || null;
  };

  // 处理购买按钮点击 - 直接执行购买
  const handlePurchaseClick = async (object: TradingObject) => {
    console.log('🔘 购买按钮被点击:', object);
    
    if (!currentAccount) {
      console.log('❌ 未连接钱包');
      alert(t('object.connectWalletFirst'));
      return;
    }

    console.log('📍 当前账户:', currentAccount);
    console.log('📍 对象拥有者:', object.owner);

    // 检查是否是自己的对象
    if (object.owner === currentAccount) {
      console.log('❌ 尝试购买自己的对象');
      alert(t('object.cannotBuyOwnObject'));
      return;
    }

    // 获取代币信息
    const tokenType = object.token_type || (supportedTokens.length > 0 ? supportedTokens[0].type : '');
    console.log('📍 代币类型:', tokenType);
    
    if (!tokenType) {
      console.log('❌ 没有可用的支付代币');
      alert(t('object.noAvailablePaymentToken'));
      return;
    }

    // 直接执行购买
    await executePurchase(object);
  };

  // 执行实际购买流程 - 简化版本
  const executePurchase = async (object: TradingObject) => {
    if (!currentAccount) return;

    setPurchasing(object.id);
    setSelectedObject(object);
    setPurchaseError(null);
    
    try {
      console.log('🔧 开始购买流程...');
      console.log('📍 对象ID:', object.id);
      console.log('📍 价格:', object.price);

      // 创建适配器函数 - 完全参考 manager 项目的模式
      // 直接传递 signAndExecuteTransaction 函数，让它处理所有的钱包交互
      const signerAdapter = (
        params: { transaction: any; options?: any },
        callbacks?: { onSuccess?: (result: any) => void; onError?: (error: any) => void }
      ) => {
        console.log('🔧 钱包适配器被调用:', { params, callbacks });
        
        // 直接调用 dapp-kit 的 signAndExecuteTransaction
        // 它会返回一个 Promise，但我们不等待它，让回调函数处理结果
        signAndExecuteTransaction(
          {
            transaction: params.transaction,
            ...(params.options && { options: params.options })
          },
          {
            onSuccess: (result: any) => {
              console.log('✅ 钱包交易成功:', result);
              if (callbacks?.onSuccess) {
                callbacks.onSuccess(result);
              }
            },
            onError: (error: any) => {
              console.error('❌ 钱包交易失败:', error);
              if (callbacks?.onError) {
                callbacks.onError(error);
              }
            }
          }
        );
      };

      // 简化调用 - contractService内部处理所有复杂逻辑
      const result = await contractService.purchaseObject(
        object.id,
        '', // coinId 将在服务内部获取
        object.token_type || '',
        signerAdapter, // 使用适配器函数
        currentAccount
      );
      
      if (result.success) {
        // 购买成功
        onObjectPurchased(object.id);
        alert(t('object.purchaseSuccess'));
      } else {
        alert(`${t('object.purchaseFailed')}: ${result.message}`);
      }
      
    } catch (error) {
      console.error('Purchase failed:', error);
      alert(`${t('object.purchaseFailed')}: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setPurchasing(null);
      setSelectedObject(null);
    }
  };

  // 获取步骤名称
  const getStepName = (step: number): string => {
    const steps = [
      '验证购买条件',
      '检查代币余额',
      '构建交易',
      '执行交易',
      '确认交易'
    ];
    return steps[step - 1] || '未知步骤';
  };


  // 保留原有的 handlePurchase 函数以兼容现有调用
  const handlePurchase = async (objectId: string, price: number, tokenType?: string, owner?: string) => {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
      handlePurchaseClick(object);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 钱包查看处理函数
  const handleWalletView = (objectId: string) => {
    setWalletObjectId(objectId);
    setShowWallet(true);
  };

  const handleCloseWallet = () => {
    setShowWallet(false);
    setWalletObjectId(null);
  };

  if (objects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('object.noObjects')}
      </div>
    );
  }

  return (
    <>
      <div className="object-grid">
        {objects.map((object) => (
          <div 
            key={object.id} 
            className="object-card"
          >
          {/* 卡片头部 - 显示emoji和基本信息 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {/* <div className="text-3xl">{object.emoji || '🤖'}</div> */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 truncate text-sm">{object.bot}</h3>
                <p className="text-xs text-gray-500 truncate">{t('object.owner')}: {formatAddress(object.owner)}</p>
              </div>
            </div>
          </div>
          
          {/* 头像区域 - 固定尺寸容器 */}
          <div className="p-4 flex-shrink-0">
            <div className="object-avatar-container">
              <img 
                src={object.profile_picture} 
                alt={object.bot}
                className="object-avatar-img"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/200x300?text=No+Image';
                }}
              />
              {isMarketView && object.is_for_sale && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  {t('object.forSale')}
                </div>
              )}
            </div>
          </div>

          {/* 详细信息 */}
          <div className="px-4 pb-2 space-y-3">
            {/* Blob ID */}
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600 font-medium">Blob ID:</span>
                <span className="font-mono text-xs text-gray-800 truncate max-w-[120px]">
                  {object.blob_id.length > 12 ? `${object.blob_id.substring(0, 12)}...` : object.blob_id}
                </span>
              </div>
            </div>

            {/* 价格信息 */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-600 font-medium">{t('object.price')}:</span>
                <div className="text-right">
                  <span className="font-bold text-green-600 text-base">
                    {object.price} {object.token_type ? getTokenSymbol(object.token_type) : 'Unknown'}
                  </span>
                  {isMarketView && (
                    <>
                      <div className="text-xs text-red-500 font-medium animate-pulse mt-1">
                        🎉 {t('object.zeroFeePromotion')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('object.noFee')}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 状态 */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600 font-medium">{t('object.status')}:</span>
              <span className={`font-medium text-xs px-2 py-1 rounded-full ${
                isMarketView 
                  ? (
                      object.is_for_sale 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    )
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {isMarketView 
                  ? (object.is_for_sale ? t('object.forSale') : t('object.sold'))
                  : t('object.owned')
                }
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="p-4 pt-2 mt-auto">
            {isMarketView ? (
              // 市场视图：所有对象都显示购买按钮
              object.is_for_sale && (
                <button
                  onClick={() => handlePurchaseClick(object)}
                  disabled={purchasing === object.id}
                  className="button w-full flex items-center justify-center gap-2"
                  style={{ padding: '10px 16px', fontSize: '14px' }}
                >
                  {purchasing === object.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('object.buying')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('object.buy')}</span>
                      <span className="font-bold">
                        {object.price} {object.token_type ? getTokenSymbol(object.token_type) : 'Unknown'}
                      </span>
                    </>
                  )}
                </button>
              )
            ) : (
              // 管理视图：显示编辑功能
              object.owner === currentAccount && (
                <div className="space-y-2">
                  {/* {onObjectEdit && (
                    <button
                      onClick={() => onObjectEdit(object)}
                      className="button warning w-full"
                      style={{ padding: '10px 16px', fontSize: '14px' }}
                    >
                      编辑价格
                    </button>
                  )} */}
                  <button
                    onClick={() => handleWalletView(object.id)}
                    className="button info w-full"
                    style={{ padding: '10px 16px', fontSize: '14px' }}
                  >
                    💰 {t('object.viewWallet')}
                  </button>
                  <div className="p-2 bg-blue-50 rounded-lg text-center text-xs text-blue-600 font-medium border border-blue-200">
                    {t('object.thisIsYourObject')}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>

      {/* 钱包查看模态框 */}
      {showWallet && walletObjectId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t('object.walletManagement')}</h2>
              <button
                onClick={handleCloseWallet}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ObjectWallet 
              objectId={walletObjectId} 
              currentAccount={currentAccount}
              onClose={handleCloseWallet}
            />
          </div>
        </div>
      )}

      {/* 购买进度组件 */}
      {purchasing && selectedObject && (
        <PurchaseProgress
          currentStep={purchaseStep}
          totalSteps={5}
          stepName={getStepName(purchaseStep)}
          isComplete={purchaseStep === 5}
          error={purchaseError || undefined}
        />
      )}
    </>
  );
};

export default ObjectList;
