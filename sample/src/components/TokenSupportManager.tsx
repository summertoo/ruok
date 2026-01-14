import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { 
  addUSDCTokenSupport, 
  checkUSDCTokenSupport, 
  getSupportedTokenTypes,
  addMultipleTokenSupport,
  getCommonTokenTypes
} from '../utils/addTokenSupport';
import { useLanguage } from '../contexts/LanguageContext';

interface TokenSupportManagerProps {
  currentAccount?: any;
}

const TokenSupportManager: React.FC<TokenSupportManagerProps> = ({ currentAccount }) => {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const [loading, setLoading] = useState<boolean>(false);
  const [supportedTokens, setSupportedTokens] = useState<string[]>([]);
  const [usdcSupported, setUsdcSupported] = useState<boolean>(false);
  const [customTokenType, setCustomTokenType] = useState<string>('');
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);

  useEffect(() => {
    loadTokenSupportInfo();
  }, []);

  const loadTokenSupportInfo = async () => {
    try {
      setLoading(true);
      
      // 获取支持的代币类型
      const tokens = await getSupportedTokenTypes();
      setSupportedTokens(tokens);
      
      // 检查USDC支持
      const usdcSupport = await checkUSDCTokenSupport();
      setUsdcSupported(usdcSupport);
      
      console.log('📍 代币支持信息:', { tokens, usdcSupport });
    } catch (error) {
      console.error('❌ 加载代币支持信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUSDCSupport = async () => {
    if (!currentAccount) {
      alert(t('token.connectWalletFirst'));
      return;
    }

    try {
      setLoading(true);
      
      // 创建signer对象
      const signer = {
        address: typeof currentAccount === 'string' ? currentAccount : currentAccount.address,
        signAndExecuteTransaction: (params: any) => signAndExecuteTransaction(params)
      };

      const success = await addUSDCTokenSupport(signer);
      
      if (success) {
        alert(t('token.usdcSupportAddSuccess'));
        await loadTokenSupportInfo(); // 重新加载信息
      } else {
        alert(t('token.usdcSupportAddFailed'));
      }
    } catch (error) {
      console.error('❌ 添加USDC支持失败:', error);
      alert(t('token.addUSDCSupportFailed') + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomToken = async () => {
    if (!currentAccount) {
      alert(t('token.connectWalletFirst'));
      return;
    }

    if (!customTokenType.trim()) {
      alert(t('token.enterTokenType'));
      return;
    }

    try {
      setLoading(true);
      
      // 创建signer对象
      const signer = {
        address: typeof currentAccount === 'string' ? currentAccount : currentAccount.address,
        signAndExecuteTransaction: (params: any) => signAndExecuteTransaction(params)
      };

      const success = await addMultipleTokenSupport([customTokenType.trim()], signer);
      
      if (success) {
        alert(t('token.supportAddSuccess'));
        setCustomTokenType('');
        await loadTokenSupportInfo(); // 重新加载信息
      } else {
        alert(t('token.supportAddFailed'));
      }
    } catch (error) {
      console.error('❌ 添加自定义代币支持失败:', error);
      alert(t('token.addCustomTokenSupportFailed') + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMultipleTokens = async () => {
    if (!currentAccount) {
      alert(t('token.connectWalletFirst'));
      return;
    }

    if (selectedTokens.length === 0) {
      alert(t('token.selectTokensToAdd'));
      return;
    }

    try {
      setLoading(true);
      
      // 创建signer对象
      const signer = {
        address: typeof currentAccount === 'string' ? currentAccount : currentAccount.address,
        signAndExecuteTransaction: (params: any) => signAndExecuteTransaction(params)
      };

      const success = await addMultipleTokenSupport(selectedTokens, signer);
      
      if (success) {
        alert(t('token.batchAddSuccess'));
        setSelectedTokens([]);
        await loadTokenSupportInfo(); // 重新加载信息
      } else {
        alert(t('token.batchAddFailed'));
      }
    } catch (error) {
      console.error('❌ 批量添加代币支持失败:', error);
      alert(t('token.batchAddSupportFailed') + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelection = (tokenType: string) => {
    setSelectedTokens(prev => 
      prev.includes(tokenType) 
        ? prev.filter(t => t !== tokenType)
        : [...prev, tokenType]
    );
  };

  const commonTokens = getCommonTokenTypes();

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-gray-600">{t('token.loading')}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-6">{t('token.title')}</h2>
      
      {/* 当前状态 */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-medium mb-3">{t('token.currentStatus')}</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="font-medium mr-2">{t('token.usdcSupportStatus')}</span>
            <span className={`px-2 py-1 rounded text-sm ${usdcSupported ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {usdcSupported ? t('token.supported') : t('token.notSupported')}
            </span>
          </div>
          <div className="flex items-center">
            <span className="font-medium mr-2">{t('token.supportedTokenCount')}</span>
            <span className="text-sm">{supportedTokens.length}</span>
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">{t('token.quickActions')}</h3>
        <div className="flex gap-4">
          <button
            onClick={handleAddUSDCSupport}
            disabled={loading || usdcSupported}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {usdcSupported ? t('token.usdcAlreadySupported') : t('token.addUSDCSupport')}
          </button>
          <button
            onClick={loadTokenSupportInfo}
            disabled={loading}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:bg-gray-400"
          >
            {t('token.refreshStatus')}
          </button>
        </div>
      </div>

      {/* 批量添加常用代币 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">{t('token.batchAddCommonTokens')}</h3>
        <div className="space-y-2">
          {commonTokens.map((token) => (
            <label key={token} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedTokens.includes(token)}
                onChange={() => handleTokenSelection(token)}
                disabled={supportedTokens.includes(token)}
                className="rounded"
              />
              <span className={`text-sm ${supportedTokens.includes(token) ? 'text-green-600' : ''}`}>
                {token}
                {supportedTokens.includes(token) && t('token.alreadySupported')}
              </span>
            </label>
          ))}
        </div>
        <button
          onClick={handleAddMultipleTokens}
          disabled={loading || selectedTokens.length === 0}
          className="mt-3 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {t('token.addSelectedTokens')} ({selectedTokens.length})
        </button>
      </div>

      {/* 自定义代币 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">{t('token.addCustomToken')}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTokenType}
            onChange={(e) => setCustomTokenType(e.target.value)}
            placeholder={t('token.tokenTypePlaceholder')}
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={handleAddCustomToken}
            disabled={loading || !customTokenType.trim()}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('token.addToken')}
          </button>
        </div>
      </div>

      {/* 当前支持的代币列表 */}
      <div>
        <h3 className="text-lg font-medium mb-3">{t('token.currentlySupportedTokens')}</h3>
        {supportedTokens.length === 0 ? (
          <p className="text-gray-500">{t('token.noSupportedTokens')}</p>
        ) : (
          <div className="space-y-1">
            {supportedTokens.map((token, index) => (
              <div key={index} className="text-sm font-mono bg-gray-100 p-2 rounded">
                {token}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenSupportManager;
