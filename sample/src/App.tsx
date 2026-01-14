import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import ObjectMarketplace from './components/ObjectMarketplace';
import AdminPage from './components/AdminPage';
import WalletInfo from './components/WalletInfo';
import DebugBalance from './components/DebugBalance';
import { NetworkSelector } from './components/NetworkSelector';
import LanguageSelector from './components/LanguageSelector';
import { NetworkType, getDefaultNetwork } from './config/networkConfig';
import { updateNetwork } from './services/balanceService';
import { updateContractNetwork } from './services/contractService';
import { contractService } from './services/contractService';
import { useLanguage } from './contexts/LanguageContext';

function App() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const isConnected = !!currentAccount;
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>(getDefaultNetwork());
  const [currentPage, setCurrentPage] = useState<'marketplace' | 'admin' | 'debug'>('marketplace');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  // 网络切换处理
  const handleNetworkChange = async (network: NetworkType) => {
    if (currentAccount) {
      // 如果有钱包连接，提示用户先断开钱包
      const networkName = network === 'mainnet' ? t('network.mainnet') : network === 'testnet' ? t('network.testnet') : t('network.devnet');
      const confirmSwitch = window.confirm(
        t('network.switchConfirm', { network: networkName })
      );
      if (!confirmSwitch) {
        return;
      }
    }
    
    setCurrentNetwork(network);
    
    // 更新 balanceService 的网络配置
    updateNetwork(network);
    
    // 更新 contractService 的网络配置
    updateContractNetwork(network);
    contractService.updateNetwork(network);
    
    // 强制重新渲染页面以获取新的合约配置
    // 使用一个小技巧来触发重新渲染
    setTimeout(() => {
      setCurrentPage(prev => prev); // 触发重新渲染
    }, 100);
  };

  // 检查管理员权限
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentAccount) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      // 管理员地址列表（从环境变量中读取）
      const ADMIN_ADDRESSES = [
        import.meta.env.VITE_TESTNET_ADMIN_ADDRESS || '',
        import.meta.env.VITE_MAINNET_ADMIN_ADDRESS || '',
        import.meta.env.VITE_DEVNET_ADMIN_ADDRESS || '',
      ].filter(address => address && address !== '0x...');

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
      
      setAdminLoading(false);
    };

    checkAdminStatus();
  }, [currentAccount]);

  useEffect(() => {
    // 初始化网络配置
    updateNetwork(currentNetwork);
    updateContractNetwork(currentNetwork);
    contractService.updateNetwork(currentNetwork);
  }, []);

  // 监听网络变化，强制刷新数据
  useEffect(() => {
    // 当网络变化时，强制刷新页面数据
    const handleNetworkChange = () => {
      console.log('🔄 Network changed, forcing data refresh...');
      // 更新所有服务
      updateNetwork(currentNetwork);
      updateContractNetwork(currentNetwork);
      contractService.updateNetwork(currentNetwork);
      
      // 强制重新渲染页面以获取新的合约配置
      setTimeout(() => {
        setCurrentPage(prev => prev); // 触发重新渲染
      }, 100);
    };

    // 监听网络变化
    if (currentNetwork) {
      handleNetworkChange();
    }
  }, [currentNetwork]);

  return (
    <div className="min-h-screen">
      <header className="modern-header">
        <div className="header-container">
          <div className="header-content">
            <div className="header-left">
              <div className="logo-section">
                <div className="logo-icon">🚀</div>
                <h1 className="logo-text">{t('app.title')}</h1>
              </div>
              <NetworkSelector
                currentNetwork={currentNetwork}
                onNetworkChange={handleNetworkChange}
                disabled={false}
              />
            </div>
            <div className="header-right">
              <LanguageSelector />
              {isConnected && (
                <>
                  <div className="nav-buttons">
                    <button
                      onClick={() => setCurrentPage('marketplace')}
                      className={`nav-button ${currentPage === 'marketplace' ? 'active' : ''}`}
                    >
                      🏪 {t('nav.market')}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setCurrentPage('admin')}
                        className={`nav-button ${currentPage === 'admin' ? 'active' : ''}`}
                      >
                        🛡️ {t('nav.admin')}
                      </button>
                    )}
                    {/* <button
                      onClick={() => setCurrentPage('debug')}
                      className={`nav-button ${currentPage === 'debug' ? 'active' : ''}`}
                    >
                      🔍 调试
                    </button> */}
                  </div>
                  <WalletInfo />
                </>
              )}
              <ConnectButton className="connect-button" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="welcome-section">
            <h2 className="welcome-title">
              {t('welcome.title', { appName: 'OC Network' })}
            </h2>
            <p className="welcome-subtitle">
              {t('welcome.subtitle')}
            </p>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                {t('welcome.currentNetwork')}: <strong>{currentNetwork === 'mainnet' ? t('network.mainnet') : currentNetwork === 'testnet' ? t('network.testnet') : t('network.devnet')}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {t('welcome.ensureSameNetwork')}
              </p>
            </div>
            <ConnectButton className="welcome-button" />
          </div>
        ) : (
          <>
            {currentPage === 'marketplace' ? (
              <ObjectMarketplace key={currentNetwork} currentNetwork={currentNetwork} />
            ) : currentPage === 'admin' ? (
              <AdminPage key={currentNetwork} currentNetwork={currentNetwork} />
            ) : currentPage === 'debug' ? (
              <DebugBalance key={currentNetwork} currentNetwork={currentNetwork} />
            ) : (
              <ObjectMarketplace key={currentNetwork} currentNetwork={currentNetwork} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
