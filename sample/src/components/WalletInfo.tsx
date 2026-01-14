import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { getWalletBalances, BalanceInfo, formatSUIBalance, formatUSDCBalance, getCurrentNetwork } from '../services/balanceService';
import { getTokenInfo } from '../config/tokenConfig';
import { NetworkType } from '../config/networkConfig';
import { useLanguage } from '../contexts/LanguageContext';
import './WalletInfo.css';

const WalletInfo: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { t } = useLanguage();
  const [balances, setBalances] = useState<BalanceInfo>({ sui: 0, usdc: 0 });
  const [loading, setLoading] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkType>(getCurrentNetwork());

  const fetchBalances = async () => {
    if (!currentAccount) return;

    try {
      setLoading(true);
      const balanceInfo = await getWalletBalances(currentAccount.address);
      setBalances(balanceInfo);
    } catch (error) {
      console.error(t('wallet.fetchBalanceFailed'), error);
    } finally {
      setLoading(false);
    }
  };

  // 监听账户变化
  useEffect(() => {
    if (currentAccount) {
      fetchBalances();
    }
  }, [currentAccount]);

  // 监听网络变化
  useEffect(() => {
    const checkNetworkChange = () => {
      const newNetwork = getCurrentNetwork();
      if (newNetwork !== networkState) {
        setNetworkState(newNetwork);
        if (currentAccount) {
          fetchBalances();
        }
      }
    };

    // 设置定时检查网络变化
    const interval = setInterval(checkNetworkChange, 1000);
    
    return () => clearInterval(interval);
  }, [currentAccount, networkState]);

  if (!currentAccount) {
    return null;
  }

  const currentNetwork = getCurrentNetwork();
  const tokenInfo = getTokenInfo(currentNetwork);

  return (
    <div className="wallet-info-container">
      {/* 余额卡片容器 */}
      <div className="balance-cards">
        {/* SUI 余额卡片 */}
        <div className="balance-card sui-card">
          <div className="balance-card-inner">
            <div className="token-icon sui-icon">
              {tokenInfo.SUI.icon}
            </div>
            <div className="balance-info">
              <div className="token-name">SUI</div>
              <div className="balance-amount">
                {loading ? (
                  <div className="balance-loading"></div>
                ) : (
                  formatSUIBalance(balances.sui)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* USDC 余额卡片 */}
        <div className="balance-card usdc-card">
          <div className="balance-card-inner">
            <div className="token-icon usdc-icon">
              {tokenInfo.USDC.icon}
            </div>
            <div className="balance-info">
              <div className="token-name">{tokenInfo.USDC.name}</div>
              <div className="balance-amount">
                {loading ? (
                  <div className="balance-loading"></div>
                ) : (
                  formatUSDCBalance(balances.usdc)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletInfo;
