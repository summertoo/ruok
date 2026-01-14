import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { contractService, TradingObject } from '../services/contractService';
import { marketplaceService, SupportedToken } from '../services/marketplaceService';
import { useLanguage } from '../contexts/LanguageContext';
import ObjectWallet from './ObjectWallet';

interface MyListingsPageProps {
  onBack: () => void;
}

const MyListingsPage: React.FC<MyListingsPageProps> = ({ onBack }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const [userObjects, setUserObjects] = useState<TradingObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<string>('');
  const [newTokenType, setNewTokenType] = useState<string>('0x2::sui::SUI');
  const [processing, setProcessing] = useState<string | null>(null);
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [walletObjectId, setWalletObjectId] = useState<string | null>(null);
  const [showWallet, setShowWallet] = useState(false);

  useEffect(() => {
    if (currentAccount?.address) {
      loadUserObjects();
      loadSupportedTokens();
    }
  }, [currentAccount]);

  // 加载支持的代币列表
  const loadSupportedTokens = async () => {
    try {
      setTokensLoading(true);
      const tokens = await marketplaceService.getSupportedTokens();
      setSupportedTokens(tokens);
      console.log('📍 支持的代币列表:', tokens);
    } catch (err) {
      console.error('Failed to load supported tokens:', err);
    } finally {
      setTokensLoading(false);
    }
  };

  const loadUserObjects = async () => {
    if (!currentAccount?.address) return;
    
    try {
      setLoading(true);
      console.log('🔄 正在加载用户拥有的对象...');
      // 获取用户拥有的所有对象（包括购买的和创建的）
      const userOwnedObjects = await contractService.getUserObjects(currentAccount.address);
      console.log('📍 获取到的用户拥有对象:', userOwnedObjects);
      
      // 获取用户在市场中上架的对象
      const userListedObjects = await contractService.getUserListedObjects(currentAccount.address);
      console.log('📍 获取到的用户上架对象:', userListedObjects);
      
      // 合并两个列表，去重（以对象ID为准）
      const allObjects = [...userOwnedObjects];
      userListedObjects.forEach(listedObj => {
        if (!allObjects.find(obj => obj.id === listedObj.id)) {
          allObjects.push(listedObj);
        }
      });
      
      setUserObjects(allObjects);
    } catch (error) {
      console.error('加载用户对象失败:', error);
      setUserObjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelist = async (objectId: string) => {
    if (!currentAccount) return;
    
    const confirmDelist = window.confirm(t('myListings.confirmDelist'));
    if (!confirmDelist) return;

    try {
      setProcessing(objectId);
      
      // 创建正确的 signer 对象
      const signer = {
        address: currentAccount?.address,
        signAndExecuteTransaction: (params: any) => Promise.resolve(signAndExecuteTransaction(params))
      };
      
      // 使用下架方法
      await contractService.delistObject(objectId, signer);
      
      // 重新加载数据
      await loadUserObjects();
      alert(t('myListings.delistSuccess'));
    } catch (error) {
      console.error('下架失败:', error);
      alert(t('myListings.delistFailed') + (error as Error).message);
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdatePrice = async (objectId: string) => {
    if (!currentAccount || !newPrice) return;

    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      alert(t('myListings.enterValidPrice'));
      return;
    }

    try {
      setProcessing(objectId);
      
      // 创建正确的 signer 对象
      const signer = {
        address: currentAccount?.address,
        signAndExecuteTransaction: (params: any) => Promise.resolve(signAndExecuteTransaction(params))
      };
      
      // 找到要更新的对象
      const objectToUpdate = userObjects.find(obj => obj.id === objectId);
      if (!objectToUpdate) {
        throw new Error(t('error.objectNotFound'));
      }
      
      // 使用 updateTradingObject 而不是 updatePrice，这样可以同时更新价格和代币类型
      await contractService.updateTradingObject(
        objectId,
        objectToUpdate.bot,
        objectToUpdate.emoji,
        objectToUpdate.profile_picture,
        objectToUpdate.blob_id,
        price,
        newTokenType,
        signer
      );
      
      // 重新加载数据
      await loadUserObjects();
      
      // 重置编辑状态
      setEditingId(null);
      setNewPrice('');
      setNewTokenType(supportedTokens.length > 0 ? supportedTokens[0].type : '0x2::sui::SUI');
      
      alert(t('myListings.updatePriceSuccess'));
    } catch (error) {
      console.error('更新价格失败:', error);
      alert(t('myListings.updatePriceFailed') + (error as Error).message);
    } finally {
      setProcessing(null);
    }
  };

  const startEditing = (object: TradingObject) => {
    setEditingId(object.id);
    setNewPrice(object.price.toString());
    setNewTokenType(object.token_type || '0x2::sui::SUI');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewPrice('');
    setNewTokenType('0x2::sui::SUI');
  };

  const getTokenSymbol = (tokenType: string) => {
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

  const getTokenDecimals = (tokenType: string) => {
    if (tokenType.includes('sui::SUI')) return 9;
    if (tokenType.includes('usdc') || tokenType.includes('USDC')) return 6;
    if (tokenType.includes('test_coin::TEST_COIN')) return 6; // 测试网 USDC
    return 9;
  };

  const formatPrice = (price: number, tokenType: string) => {
    const decimals = getTokenDecimals(tokenType);
    return price.toFixed(Math.max(2, decimals));
  };

  const handleWalletManagement = (objectId: string) => {
    setWalletObjectId(objectId);
    setShowWallet(true);
  };

  const handleCloseWallet = () => {
    setShowWallet(false);
    setWalletObjectId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面标题和返回按钮 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="button secondary"
            style={{ padding: '12px 20px', fontSize: '14px' }}
          >
            {t('myListings.back')}
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{t('myListings.title')}</h2>
        </div>
        <div className="text-sm text-gray-600">
          {t('myListings.totalObjects', { count: userObjects.length })}
        </div>
      </div>

      {userObjects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="text-8xl mb-6">📦</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">{t('myListings.noObjects')}</h3>
          <p className="text-gray-600 text-lg">{t('myListings.noObjectsDesc')}</p>
          <button
            onClick={onBack}
            className="button"
            style={{ padding: '16px 24px', fontSize: '16px' }}
          >
            {t('myListings.createObject')}
          </button>
        </div>
      ) : (
      <div className="object-grid">
          {userObjects.map((object) => (
            <div 
              key={object.id} 
              className="object-card"
            >
              {/* 卡片头部 */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {/* <div className="text-3xl">{object.emoji || '🤖'}</div> */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 truncate text-sm">{object.bot}</h3>
                    <p className="text-xs text-gray-500 truncate">ID: {object.id.slice(0, 8)}...</p>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-full font-medium ${
                    object.is_for_sale 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {object.is_for_sale ? t('myListings.forSale') : t('myListings.notForSale')}
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
              {object.is_for_sale && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  {t('myListings.onSale')}
                </div>
              )}
            </div>
          </div>

              {/* 详细信息 */}
              <div className="px-4 pb-2 space-y-3">
                {/* Blob ID */}
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-medium">{t('myListings.blobId')}</span>
                    <span className="font-mono text-xs text-gray-800 truncate max-w-[120px]">
                      {object.blob_id ? (object.blob_id.length > 12 ? `${object.blob_id.substring(0, 12)}...` : object.blob_id) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* 价格信息 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-600 font-medium">{t('myListings.currentPrice')}</span>
                    <div className="text-right">
                      <span className="font-bold text-blue-600 text-base">
                        {formatPrice(object.price, object.token_type || '0x2::sui::SUI')}
                      </span>
                      <div className="text-xs text-gray-500">
                        {getTokenSymbol(object.token_type || '0x2::sui::SUI')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="p-4 pt-2 mt-auto">
                {editingId === object.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('myListings.newPrice')}
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder={t('myListings.newPricePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('myListings.tokenType')}
                      </label>
                      <select
                        value={newTokenType}
                        onChange={(e) => setNewTokenType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        disabled={tokensLoading}
                      >
                        <option value="">{t('myListings.selectToken')}</option>
                        {supportedTokens.map((token) => (
                          <option key={token.type} value={token.type}>
                            {token.symbol} - {token.name}
                          </option>
                        ))}
                      </select>
                      {tokensLoading && <div className="text-sm text-gray-500 mt-1">{t('myListings.loadingTokens')}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdatePrice(object.id)}
                        disabled={processing === object.id}
                        className="button success flex-1"
                        style={{ padding: '8px 12px', fontSize: '14px' }}
                      >
                        {processing === object.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>{t('myListings.processing')}</span>
                          </div>
                        ) : (
                          t('myListings.confirmUpdate')
                        )}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={processing === object.id}
                        className="button secondary flex-1"
                        style={{ padding: '8px 12px', fontSize: '14px' }}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleWalletManagement(object.id)}
                      disabled={processing === object.id}
                      className="button info w-full"
                      style={{ padding: '10px 16px', fontSize: '14px' }}
                    >
                      {t('myListings.walletManagement')}
                    </button>
                    {/* 只有对象所有者且对象在售时才能下架 */}
                    {object.owner === currentAccount?.address && object.is_for_sale && (
                      <button
                        onClick={() => handleDelist(object.id)}
                        disabled={processing === object.id}
                        className="button danger w-full"
                        style={{ padding: '10px 16px', fontSize: '14px' }}
                      >
                        {processing === object.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>{t('myListings.processing')}</span>
                          </div>
                        ) : (
                          t('myListings.delist')
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 钱包管理模态框 */}
      {showWallet && walletObjectId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">{t('myListings.walletTitle')}</h2>
                <button
                  onClick={handleCloseWallet}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <ObjectWallet 
                objectId={walletObjectId} 
                currentAccount={currentAccount?.address}
                onClose={handleCloseWallet}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyListingsPage;
