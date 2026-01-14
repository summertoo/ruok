import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { contractService } from '../services/contractService';
import { useLanguage } from '../contexts/LanguageContext';

const PermissionDebug: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { t } = useLanguage();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runDebugCheck = async () => {
    if (!currentAccount) {
      setError(t('debug.connectWallet'));
      return;
    }

    setLoading(true);
    setError('');
    setDebugInfo(null);

    try {
      console.log('🔍 开始权限调试检查...');
      
      // 获取合约配置
      const config = contractService.getContractConfig();
      console.log('📍 合约配置:', config);
      
      // 检查权限
      const hasPermission = await contractService.hasListingPermission(currentAccount.address);
      console.log('📍 权限检查结果:', hasPermission);
      
      // 获取用户的 ListingCap 对象
      const listingCapId = await contractService.getUserListingCap(currentAccount.address);
      console.log('📍 ListingCap 对象ID:', listingCapId);
      
      // 直接查询用户拥有的所有对象
      const client = contractService.getSuiClient();
      const allObjects = await client.getOwnedObjects({
        owner: currentAccount.address,
        options: {
          showContent: true,
          showType: true
        },
        limit: 50
      });
      
      // 查找相关的对象
      const relatedObjects = allObjects.data.filter(obj => 
        obj.data?.type?.includes(config.packageId.split('::')[0])
      );
      
      const debugData = {
        userAddress: currentAccount.address,
        contractConfig: config,
        hasPermission,
        listingCapId,
        totalObjects: allObjects.data.length,
        relatedObjects: relatedObjects.map(obj => ({
          objectId: obj.data?.objectId,
          type: obj.data?.type,
          content: obj.data?.content
        })),
        allListingCaps: allObjects.data.filter(obj => 
          obj.data?.type?.includes('ListingCap')
        ).map(obj => ({
          objectId: obj.data?.objectId,
          type: obj.data?.type,
          content: obj.data?.content
        }))
      };
      
      setDebugInfo(debugData);
      console.log('📍 调试信息:', debugData);
      
    } catch (err) {
      console.error('权限调试检查失败:', err);
      setError(err instanceof Error ? err.message : t('debug.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg mb-4">
      <h3 className="text-lg font-semibold mb-3">{t('debug.title')}</h3>
      
      <button
        onClick={runDebugCheck}
        disabled={loading || !currentAccount}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 mb-3"
      >
        {loading ? t('debug.checking') : t('debug.runCheck')}
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded mb-3">
          <p className="text-red-600">{t('debug.error')} {error}</p>
        </div>
      )}

      {debugInfo && (
        <div className="space-y-3">
          <div className="p-3 bg-white border rounded">
            <h4 className="font-semibold mb-2">{t('debug.basicInfo')}</h4>
            <p><strong>{t('debug.userAddress')}</strong> {debugInfo.userAddress}</p>
            <p><strong>{t('debug.packageId')}</strong> {debugInfo.contractConfig.packageId}</p>
            <p><strong>{t('debug.marketplaceId')}</strong> {debugInfo.contractConfig.marketplaceId}</p>
            <p><strong>{t('debug.network')}</strong> {debugInfo.contractConfig.network}</p>
            <p><strong>{t('debug.permissionStatus')}</strong> {debugInfo.hasPermission ? t('debug.hasPermission') : t('debug.noPermission')}</p>
            <p><strong>{t('debug.listingCapId')}</strong> {debugInfo.listingCapId || t('debug.notFound')}</p>
          </div>

          <div className="p-3 bg-white border rounded">
            <h4 className="font-semibold mb-2">{t('debug.objectStats')}</h4>
            <p><strong>{t('debug.totalObjects')}</strong> {debugInfo.totalObjects}</p>
            <p><strong>{t('debug.relatedObjects')}</strong> {debugInfo.relatedObjects.length}</p>
            <p><strong>{t('debug.listingCapObjects')}</strong> {debugInfo.allListingCaps.length}</p>
          </div>

          {debugInfo.allListingCaps.length > 0 && (
            <div className="p-3 bg-white border rounded">
              <h4 className="font-semibold mb-2">{t('debug.listingCapDetails')}</h4>
              {debugInfo.allListingCaps.map((cap: any, index: number) => (
                <div key={index} className="mb-2 p-2 bg-gray-50 rounded">
                  <p><strong>{t('debug.objectId')}</strong> {cap.objectId}</p>
                  <p><strong>{t('debug.type')}</strong> {cap.type}</p>
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1">
                    {JSON.stringify(cap.content, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {debugInfo.relatedObjects.length > 0 && (
            <div className="p-3 bg-white border rounded">
              <h4 className="font-semibold mb-2">{t('debug.relatedObjectsTitle')}</h4>
              {debugInfo.relatedObjects.map((obj: any, index: number) => (
                <div key={index} className="mb-2 p-2 bg-gray-50 rounded">
                  <p><strong>{t('debug.objectId')}</strong> {obj.objectId}</p>
                  <p><strong>{t('debug.type')}</strong> {obj.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PermissionDebug;
