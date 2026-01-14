import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { contractService, TradingObject } from '../services/contractService';
import { marketplaceService, SupportedToken } from '../services/marketplaceService';
import PermissionDebug from './PermissionDebug';
import { useLanguage } from '../contexts/LanguageContext';

interface ObjectFormProps {
  onObjectCreated: (object: TradingObject | null) => void;
  editingObject?: TradingObject | null;
  onEditComplete?: () => void;
  onObjectUpdated?: (object: TradingObject) => void;
}

const ObjectForm: React.FC<ObjectFormProps> = ({ onObjectCreated, editingObject, onEditComplete, onObjectUpdated }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    bot: '',
    emoji: '',
    profile_picture: '',
    blobId: '',
    price: '',
    tokenType: '',
    createWallet: true // 默认创建钱包
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [hasListingPermission, setHasListingPermission] = useState<boolean | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);

  // 检查用户上架权限
  useEffect(() => {
    const checkListingPermission = async () => {
      if (!currentAccount) {
        setHasListingPermission(false);
        return;
      }

      try {
        setPermissionLoading(true);
        const hasPermission = await contractService.hasListingPermission(currentAccount.address);
        setHasListingPermission(hasPermission);
        console.log('📍 用户上架权限状态:', hasPermission);
      } catch (err) {
        console.error('检查上架权限失败:', err);
        setHasListingPermission(false);
      } finally {
        setPermissionLoading(false);
      }
    };

    checkListingPermission();
  }, [currentAccount]);

  // 加载支持的代币列表
  useEffect(() => {
    const loadSupportedTokens = async () => {
      try {
        setTokensLoading(true);
        const tokens = await marketplaceService.getSupportedTokens();
        setSupportedTokens(tokens);
        
        // 如果没有选中的代币且有支持的代币，默认选择第一个
        if (!formData.tokenType && tokens.length > 0) {
          setFormData(prev => ({
            ...prev,
            tokenType: tokens[0].type
          }));
        }
      } catch (err) {
        console.error('Failed to load supported tokens:', err);
        setError(t('form.loadingTokens'));
      } finally {
        setTokensLoading(false);
      }
    };

    loadSupportedTokens();
  }, []);

  // 当编辑对象变化时，预填充表单
  useEffect(() => {
    if (editingObject) {
      setFormData({
        bot: editingObject.bot,
        emoji: editingObject.emoji,
        profile_picture: editingObject.profile_picture,
        blobId: editingObject.blob_id,
        price: editingObject.price.toString(),
        tokenType: '', // 编辑时保持为空，让用户重新选择
        createWallet: true // 编辑时默认创建钱包
      });
    } else {
      // 重置表单为空
      setFormData({
        bot: '',
        emoji: '',
        profile_picture: '',
        blobId: '',
        price: '',
        tokenType: '',
        createWallet: true
      });
    }
  }, [editingObject]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      tokenType: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentAccount) {
      setError(t('form.connectWallet'));
      return;
    }

    if (!formData.bot || !formData.emoji || !formData.profile_picture || !formData.blobId || !formData.price || !formData.tokenType) {
      setError(t('form.fillAllFields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editingObject) {
        // 编辑现有对象 - 使用正确的回调方式
        const signer = {
          address: currentAccount.address,
          signAndExecuteTransaction: async (params: any) => {
            console.log('🔧 编辑模式调用 signAndExecuteTransaction:', params);
            
            return new Promise((resolve, reject) => {
              signAndExecuteTransaction(params, {
                onSuccess: (result) => {
                  console.log('✅ 编辑模式 signAndExecuteTransaction 成功:', result);
                  resolve(result);
                },
                onError: (error) => {
                  console.error('❌ 编辑模式 signAndExecuteTransaction 失败:', error);
                  reject(error);
                }
              });
            });
          }
        };

        await contractService.updateTradingObject(
          editingObject.id,
          formData.bot,
          formData.emoji,
          formData.profile_picture,
          formData.blobId,
          parseFloat(formData.price),
          formData.tokenType,
          signer
        );
        
        // 创建更新后的对象数据
        const updatedObject: TradingObject = {
          id: editingObject.id,
          owner: editingObject.owner,
          bot: formData.bot,
          emoji: formData.emoji,
          profile_picture: formData.profile_picture,
          blob_id: formData.blobId,
          price: parseFloat(formData.price),
          is_for_sale: editingObject.is_for_sale
        };

        if (onObjectUpdated) {
          onObjectUpdated(updatedObject);
        }
        
        if (onEditComplete) {
          onEditComplete();
        }
        
        // 显示成功消息
        setError('');
        alert(t('form.objectUpdateSuccess'));
      } else {
        // 创建新对象并直接上架到市场 - 使用简化的 Promise 包装方式
        console.log('🔧 准备创建交易对象，使用简化的异步处理...');
        
        const result = await contractService.createAndListTradingObject(
          formData.bot,
          formData.emoji,
          formData.profile_picture,
          formData.blobId,
          parseFloat(formData.price),
          formData.tokenType,
          async (params: any) => {
            console.log('🔧 调用 signAndExecuteTransaction:', params);
            
            return new Promise((resolve, reject) => {
              signAndExecuteTransaction(params, {
                onSuccess: (result) => {
                  console.log('✅ signAndExecuteTransaction 成功:', result);
                  resolve(result);
                },
                onError: (error) => {
                  console.error('❌ signAndExecuteTransaction 失败:', error);
                  reject(error);
                }
              });
            });
          },
          currentAccount.address
        );

        console.log('✅ 创建对象成功，交易结果:', result);
        
        // 清除错误状态
        setError('');
        
        // 直接处理成功情况，不需要判断是否为 marketplaceId
        // 创建临时对象并通知父组件
        const tempObject: TradingObject = {
          id: result, // 使用实际返回的结果
          owner: currentAccount.address,
          bot: formData.bot,
          emoji: formData.emoji,
          profile_picture: formData.profile_picture,
          blob_id: formData.blobId,
          price: parseFloat(formData.price),
          is_for_sale: true,
          token_type: formData.tokenType
        };

        // 立即通知父组件
        onObjectCreated(tempObject);
        
        // 显示成功消息
        alert(t('form.objectCreateSuccess'));
        
        // 重置表单
        setFormData({
          bot: '',
          emoji: '',
          profile_picture: '',
          blobId: '',
          price: '',
          tokenType: supportedTokens.length > 0 ? supportedTokens[0].type : '',
          createWallet: true
        });
      }
    } catch (err) {
      console.error('创建/更新对象失败:', err);
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(`${editingObject ? t('form.updateFailed') : t('form.createFailed')}${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 权限检查显示逻辑
  if (permissionLoading) {
    return (
      <div className="text-center py-8">
        <div className="loading inline-block mr-2"></div>
        <span className="text-gray-600">{t('form.checkingPermission')}</span>
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="text-center py-8">
        <div className="text-yellow-600 mb-2">🔒 {t('form.needConnectWallet')}</div>
        <p className="text-gray-600 text-sm">{t('form.connectWalletDesc')}</p>
      </div>
    );
  }

  if (hasListingPermission === false) {
    return (
      <div>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">🚫 {t('form.noListingPermission')}</div>
          <p className="text-gray-600 text-sm">{t('form.noListingPermissionDesc')}</p>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
            <div className="font-medium mb-1">{t('form.howToGetPermission')}</div>
            <ul className="text-left space-y-1">
              <li>• {t('form.permissionStep1')}</li>
              <li>• {t('form.permissionStep2')}</li>
              <li>• {t('form.permissionStep3')}</li>
            </ul>
          </div>
        </div>
        
        {/* 添加调试工具 */}
        <PermissionDebug />
      </div>
    );
  }

  return (
    <div>
      {/* 权限状态指示器 */}
      {hasListingPermission === true && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-green-600 mr-2">✅</div>
            <div className="text-sm text-green-800">{t('form.hasListingPermission')}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="form-label">{t('form.botName')}</label>
          <input
            type="text"
            name="bot"
            value={formData.bot}
            onChange={handleInputChange}
            className="input"
            placeholder={t('form.botName.placeholder')}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('form.emoji')}</label>
          <input
            type="text"
            name="emoji"
            value={formData.emoji}
            onChange={handleInputChange}
            className="input"
            placeholder={t('form.emoji.placeholder')}
            maxLength={2}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('form.avatarUrl')}</label>
          <input
            type="url"
            name="profile_picture"
            value={formData.profile_picture}
            onChange={handleInputChange}
            className="input"
            placeholder={t('form.avatarUrl.placeholder')}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('form.blobId')}</label>
          <input
            type="text"
            name="blobId"
            value={formData.blobId}
            onChange={handleInputChange}
            className="input"
            placeholder={t('form.blobId.placeholder')}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('form.pricingToken')}</label>
          <select
            name="tokenType"
            value={formData.tokenType}
            onChange={handleTokenChange}
            className="input"
            disabled={loading || tokensLoading}
          >
            <option value="">{t('form.selectToken')}</option>
            {supportedTokens.map((token) => (
              <option key={token.type} value={token.type}>
                {token.symbol} - {token.name}
              </option>
            ))}
          </select>
          {tokensLoading && <div className="text-sm text-gray-500 mt-1">{t('form.loadingTokens')}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">
            {t('form.priceWithSymbol', { 
              symbol: formData.tokenType && supportedTokens.find(t => t.type === formData.tokenType) 
                ? supportedTokens.find(t => t.type === formData.tokenType)?.symbol || ''
                : ''
            })}
          </label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            className="input"
            placeholder={t('form.price.placeholder')}
            min="0"
            step="0.01"
            disabled={loading}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button
          type="submit"
          className="button w-full"
          disabled={loading}
        >
          {loading ? <span className="loading"></span> : (editingObject ? t('form.updateObject') : t('form.createAndList'))}
        </button>
      </form>
    </div>
  );
};

export default ObjectForm;
