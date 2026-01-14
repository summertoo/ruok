import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { contractService } from '../services/contractService';
import { marketplaceService } from '../services/marketplaceService';
import TokenSupportManager from './TokenSupportManager';
import { useLanguage } from '../contexts/LanguageContext';
import { NetworkType } from '../config/networkConfig';

interface MarketStats {
  totalObjects: number;
  activeListings: number;
  totalVolume: number;
  currentFee: number;
  isPaused: boolean;
}

interface AdminPageProps {
  currentNetwork: NetworkType;
}

const AdminPage: React.FC<AdminPageProps> = ({ currentNetwork }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setIsLoading] = useState(true);
  const [marketStats, setMarketStats] = useState<MarketStats>({
    totalObjects: 0,
    activeListings: 0,
    totalVolume: 0,
    currentFee: 0,
    isPaused: false
  });
  
  const [newFeePercentage, setNewFeePercentage] = useState('0');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 管理员地址列表（从环境变量中读取）
  const ADMIN_ADDRESSES = [
    import.meta.env.VITE_TESTNET_ADMIN_ADDRESS || '',
    import.meta.env.VITE_MAINNET_ADMIN_ADDRESS || '',
    import.meta.env.VITE_DEVNET_ADMIN_ADDRESS || '',
  ].filter(address => address && address !== '0x...'); // 过滤掉空值和占位符

  // 检查当前用户是否是管理员
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentAccount) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // 检查是否在管理员列表中
      const isUserAdmin = ADMIN_ADDRESSES.includes(currentAccount.address);
      
      // 或者检查合约中的管理员权限
      try {
        const contractAdmin = await contractService.checkAdminStatus(currentAccount.address);
        setIsAdmin(isUserAdmin || contractAdmin);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(isUserAdmin);
      }
      
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [currentAccount]);

  // 加载市场统计数据
  useEffect(() => {
    const loadMarketStats = async () => {
      if (!isAdmin) return;

      try {
        const stats = await marketplaceService.getMarketStats();
        const feeInfo = await contractService.getMarketFeeInfo();
        
        setMarketStats({
          totalObjects: stats.totalObjects,
          activeListings: stats.activeListings,
          totalVolume: stats.totalVolume,
          currentFee: feeInfo.feePercentage,
          isPaused: feeInfo.isPaused
        });
      } catch (error) {
        console.error('Failed to load market stats:', error);
      }
    };

    if (isAdmin) {
      loadMarketStats();
    }
  }, [isAdmin, currentNetwork]);

  // 暂停市场
  const handlePauseMarket = async () => {
    if (!currentAccount) return;

    setActionLoading('pause');
    try {
      const signer = {
        address: currentAccount.address,
        signAndExecuteTransaction
      };

      await contractService.pauseMarket(signer);
      
      setMarketStats(prev => ({ ...prev, isPaused: true }));
      alert(t('admin.marketPausedSuccess'));
    } catch (error) {
      console.error('Failed to pause market:', error);
      alert(t('admin.pauseMarketFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // 恢复市场
  const handleResumeMarket = async () => {
    if (!currentAccount) return;

    setActionLoading('resume');
    try {
      const signer = {
        address: currentAccount.address,
        signAndExecuteTransaction
      };

      await contractService.resumeMarket(signer);
      
      setMarketStats(prev => ({ ...prev, isPaused: false }));
      alert(t('admin.marketResumedSuccess'));
    } catch (error) {
      console.error('Failed to resume market:', error);
      alert(t('admin.resumeMarketFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // 设置市场费用
  const handleSetFee = async () => {
    if (!currentAccount) return;

    const feePercentage = parseFloat(newFeePercentage);
    if (isNaN(feePercentage) || feePercentage < 0 || feePercentage > 100) {
      alert(t('admin.enterValidFeePercentage'));
      return;
    }

    setActionLoading('setFee');
    try {
      const signer = {
        address: currentAccount.address,
        signAndExecuteTransaction
      };

      await contractService.setMarketFee(feePercentage, signer);
      
      setMarketStats(prev => ({ ...prev, currentFee: feePercentage }));
      alert(t('admin.feeSetSuccess', { fee: feePercentage }));
    } catch (error) {
      console.error('Failed to set market fee:', error);
      alert(t('admin.feeSetFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="loading"></div>
          <p className="mt-4 text-gray-600">{t('admin.verifyingPermission')}</p>
        </div>
      </div>
    );
  }

  // 非管理员用户
  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">{t('admin.accessRestricted')}</h2>
          <p className="text-gray-600">{t('admin.noAdminPermission')}</p>
          <p className="text-sm text-gray-500 mt-2">
            {t('admin.useAdminAccount')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🛡️ {t('admin.adminConsole')}
          </h1>
          <p className="text-gray-600">
            {t('admin.marketManagement')}
          </p>
        </div>

        {/* 市场状态概览 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.totalObjects')}</p>
                <p className="text-2xl font-bold text-gray-800">{marketStats.totalObjects}</p>
              </div>
              <div className="text-3xl">📦</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.activeListings')}</p>
                <p className="text-2xl font-bold text-green-600">{marketStats.activeListings}</p>
              </div>
              <div className="text-3xl">🏪</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.totalVolume')}</p>
                <p className="text-2xl font-bold text-blue-600">{marketStats.totalVolume}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('admin.currentFee')}</p>
                <p className="text-2xl font-bold text-purple-600">{marketStats.currentFee}%</p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
          </div>
        </div>

        {/* 市场控制 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 市场状态控制 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              🎛️ {t('admin.marketControl')}
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">{t('admin.marketStatus')}</p>
                  <p className="text-sm text-gray-600">
                    {marketStats.isPaused ? t('admin.marketPaused') : t('admin.marketRunning')}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  marketStats.isPaused 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-green-100 text-green-600'
                }`}>
                  {marketStats.isPaused ? t('admin.paused') : t('admin.running')}
                </div>
              </div>

              <div className="flex gap-4">
                {marketStats.isPaused ? (
                  <button
                    onClick={handleResumeMarket}
                    disabled={actionLoading === 'resume'}
                    className="button success flex-1"
                  >
                    {actionLoading === 'resume' ? (
                      <span className="loading"></span>
                    ) : (
                      `▶️ ${t('admin.resumeMarket')}`
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handlePauseMarket}
                    disabled={actionLoading === 'pause'}
                    className="button danger flex-1"
                  >
                    {actionLoading === 'pause' ? (
                      <span className="loading"></span>
                    ) : (
                      `⏸️ ${t('admin.pauseMarket')}`
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 费用设置 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              💸 {t('admin.feeSettings')}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.currentFee')}: {marketStats.currentFee}%
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={newFeePercentage}
                    onChange={(e) => setNewFeePercentage(e.target.value)}
                    placeholder={t('admin.enterNewFeePercentage')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="flex items-center text-gray-600">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.feeRangeDescription')}
                </p>
              </div>

              <button
                onClick={handleSetFee}
                disabled={actionLoading === 'setFee'}
                className="button primary w-full"
              >
                {actionLoading === 'setFee' ? (
                  <span className="loading"></span>
                ) : (
                  `🔄 ${t('admin.updateFeeSettings')}`
                )}
              </button>

              {/* 费用说明 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">{t('admin.feeDescription')}</h3>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• {t('admin.feeCollectedFromTransaction')}</li>
                  <li>• {t('admin.feeTransferredToMarketAccount')}</li>
                  <li>• {t('admin.zeroFeeMeansFreeTransaction')}</li>
                  <li>• {t('admin.feeChangeAffectsNewTransactions')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 代币支持管理 */}
        <div className="mt-8">
          <TokenSupportManager currentAccount={currentAccount} />
        </div>

        {/* 管理员信息 */}
        <div className="mt-8 bg-yellow-50 rounded-lg p-6">
          <h3 className="font-medium text-yellow-800 mb-2">📋 {t('admin.adminInfo')}</h3>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>• {t('admin.currentAdmin')}: {currentAccount?.address.slice(0, 6)}...{currentAccount?.address.slice(-4)}</p>
            <p>• {t('admin.marketContract')}: {contractService.getContractConfig().packageId}</p>
            <p>• {t('admin.lastUpdated')}: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
