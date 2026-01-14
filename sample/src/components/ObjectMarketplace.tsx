import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { contractService, TradingObject } from '../services/contractService';
import { getCurrentNetwork } from '../services/balanceService';
import { NetworkType } from '../config/networkConfig';
import ObjectForm from './ObjectForm';
import ObjectList from './ObjectList';
import MyListingsPage from './MyListingsPage';
import { useLanguage } from '../contexts/LanguageContext';

interface ObjectMarketplaceProps {
  currentNetwork: NetworkType;
}

const ObjectMarketplace: React.FC<ObjectMarketplaceProps> = ({ currentNetwork }) => {
  const currentAccount = useCurrentAccount();
  const { t } = useLanguage();
  const [objects, setObjects] = useState<TradingObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my-objects' | 'my-listings'>('marketplace');
  const [editingObject, setEditingObject] = useState<TradingObject | null>(null);
  const [hasListingPermission, setHasListingPermission] = useState<boolean | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);

  useEffect(() => {
    loadObjects();
  }, [currentAccount, currentNetwork]);

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
  }, [currentAccount, currentNetwork]);

  const loadObjects = async () => {
    setLoading(true);
    try {
      let allObjects: TradingObject[] = [];
      
      // 获取市场中的对象（新合约设计中，对象直接存储在市场中）
      try {
        const marketplaceObjects = await contractService.getMarketplaceObjects();
        allObjects = [...allObjects, ...marketplaceObjects];
        console.log('📍 从市场获取到的对象:', marketplaceObjects);
      } catch (error) {
        console.warn('Failed to load marketplace objects:', error);
      }

      // 如果有当前账户，获取用户拥有的对象（这些是购买后不在市场中的对象）
      if (currentAccount) {
        try {
          const userObjects = await contractService.getUserObjects(currentAccount.address);
          console.log('📍 用户拥有的对象:', userObjects);
          
          // 合并用户对象，避免重复
          const existingIds = new Set(allObjects.map(obj => obj.id));
          const newUserObjects = userObjects.filter(obj => !existingIds.has(obj.id));
          allObjects = [...allObjects, ...newUserObjects];
        } catch (error) {
          console.warn('Failed to load user objects:', error);
        }
      }

      console.log('📍 所有对象总数:', allObjects.length);
      setObjects(allObjects);
    } catch (error) {
      console.error('Failed to load objects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleObjectCreated = (newObject: TradingObject | null) => {
    // 由于新合约设计，对象直接存储在市场中，我们需要重新加载所有对象
    // 以确保显示最新的市场状态
    
    if (newObject === null) {
      // 如果传入null，表示需要立即刷新（因为无法获取具体对象ID）
      console.log('📍 收到刷新请求，立即加载对象列表');
      loadObjects();
      
      // 延迟再次刷新，确保链上状态完全同步
      setTimeout(() => {
        console.log('🔄 延迟刷新确保状态同步...');
        loadObjects();
      }, 3000);
    } else {
      // 如果传入了具体对象，先添加到本地状态，然后延迟刷新
      console.log('📍 添加新对象到本地状态:', newObject);
      setObjects(prev => [...prev, newObject]);
      
      // 延迟刷新以确保与链上状态同步
      setTimeout(() => {
        loadObjects();
      }, 3000); // 等待3秒让交易被完全确认
    }
  };

  const handleObjectPurchased = (objectId: string) => {
    console.log('🎉 对象购买成功，开始刷新页面状态...', { objectId });
    
    // 立即刷新一次，确保UI快速响应
    loadObjects();
    
    // 延迟再次刷新，确保链上状态完全同步
    setTimeout(() => {
      console.log('🔄 延迟刷新确保状态同步...');
      loadObjects();
    }, 3000); // 等待3秒让交易被完全确认
  };

  const handleObjectEdit = (object: TradingObject) => {
    setEditingObject(object);
  };

  const handleObjectUpdated = (updatedObject: TradingObject) => {
    setObjects(prev => 
      prev.map(obj => 
        obj.id === updatedObject.id ? updatedObject : obj
      )
    );
    setEditingObject(null);
  };

  const handleEditComplete = () => {
    setEditingObject(null);
  };

  const filteredObjects = objects.filter(obj => {
    if (activeTab === 'my-objects') {
      return obj.owner === currentAccount?.address;
    }
    // 市场视图：显示正在出售的对象
    // 对于管理员：显示所有正在出售的对象（包括自己上架的）
    // 对于普通用户：不显示自己已经购买的对象
    if (obj.is_for_sale) {
      // 如果是管理员地址，显示所有市场对象
      if (currentAccount?.address === '0x5c5882d73a615011c4d6d6b0d4b6c7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c') {
        return true;
      }
      // 普通用户不显示自己拥有的对象
      return obj.owner !== currentAccount?.address;
    }
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <button
          className={`tab-button ${
            activeTab === 'marketplace' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('marketplace')}
        >
          {t('marketplace.tabs.market')}
        </button>
        <button
          className={`tab-button ${
            activeTab === 'my-objects' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('my-objects')}
        >
          {t('marketplace.tabs.myObjects')}
        </button>
        {/* 暂时隐藏"我的上架管理"标签栏
        <button
          className={`tab-button ${
            activeTab === 'my-listings' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('my-listings')}
        >
          {t('marketplace.tabs.myListings')}
        </button>
        */}
      </div>

      {activeTab === 'my-objects' && hasListingPermission === true && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            {editingObject ? t('marketplace.editObject') : t('marketplace.createNewObject')}
          </h2>
          <ObjectForm 
            onObjectCreated={handleObjectCreated}
            editingObject={editingObject}
            onEditComplete={handleEditComplete}
            onObjectUpdated={handleObjectUpdated}
          />
        </div>
      )}

      {activeTab === 'my-objects' && hasListingPermission === false && (
        <div className="card">
          <div className="text-center py-8">
            <div className="text-red-600 mb-2">🚫 {t('marketplace.noListingPermission')}</div>
            <p className="text-gray-600 text-sm">{t('marketplace.noListingPermissionDesc')}</p>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
              {/* <div className="font-medium mb-1">{t('marketplace.howToGetPermission')}</div>
              <ul className="text-left space-y-1">
                <li>• {t('marketplace.permissionStep1')}</li>
                <li>• {t('marketplace.permissionStep2')}</li>
                <li>• {t('marketplace.permissionStep3')}</li>
              </ul> */}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-objects' && permissionLoading && (
        <div className="card">
          <div className="text-center py-8">
            <div className="loading inline-block mr-2"></div>
            <span className="text-gray-600">{t('marketplace.checkingPermission')}</span>
          </div>
        </div>
      )}

      {activeTab === 'my-listings' && (
        <MyListingsPage 
          onBack={() => setActiveTab('marketplace')}
        />
      )}

      {activeTab !== 'my-listings' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            {activeTab === 'marketplace' ? t('marketplace.marketObjects') : t('marketplace.myObjects')}
          </h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="loading mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('common.loading')}</p>
            </div>
          ) : (
            <ObjectList 
              objects={filteredObjects} 
              onObjectPurchased={handleObjectPurchased}
              currentAccount={currentAccount?.address}
              onObjectEdit={handleObjectEdit}
              isMarketView={activeTab === 'marketplace'}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ObjectMarketplace;
