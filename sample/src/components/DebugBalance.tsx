import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { balanceService } from '../services/balanceService';
import { getTokenInfo } from '../config/tokenConfig';
import { NetworkType } from '../config/networkConfig';

interface DebugBalanceProps {
  currentNetwork: NetworkType;
}

const DebugBalance: React.FC<DebugBalanceProps> = ({ currentNetwork }) => {
  const currentAccount = useCurrentAccount();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchDebugInfo = async () => {
    if (!currentAccount) return;

    try {
      setLoading(true);
      console.log('🔍 开始调试余额信息...');
      
      // 获取所有余额
      const allBalances = await balanceService.getAllBalances(currentAccount.address);
      
      // 获取当前网络信息
      const tokenInfo = getTokenInfo(currentNetwork);
      
      // 手动检查测试USDC代币类型
      const testUSDCType = '0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN';
      const testUSDCBalance = await balanceService.checkTokenBalance(currentAccount.address, testUSDCType, 0);
      
      setDebugInfo({
        address: currentAccount.address,
        network: currentNetwork,
        tokenInfo,
        allBalances,
        testUSDCType,
        testUSDCBalance,
        manualSymbolCheck: balanceService.getTokenSymbol(testUSDCType),
        manualDecimalsCheck: balanceService.getTokenDecimals(testUSDCType)
      });
      
    } catch (error) {
      console.error('调试信息获取失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccount) {
      fetchDebugInfo();
    }
  }, [currentAccount, currentNetwork]);

  if (!currentAccount) {
    return <div>请先连接钱包</div>;
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!debugInfo) {
    return <div>无调试信息</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h2>余额调试信息</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>基本信息</h3>
        <p><strong>地址:</strong> {debugInfo.address}</p>
        <p><strong>网络:</strong> {debugInfo.network}</p>
        <p><strong>测试USDC类型:</strong> {debugInfo.testUSDCType}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>代币配置信息</h3>
        <pre>{JSON.stringify(debugInfo.tokenInfo, null, 2)}</pre>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>所有代币余额</h3>
        <pre>{JSON.stringify(debugInfo.allBalances, null, 2)}</pre>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>测试USDC详细信息</h3>
        <p><strong>符号识别:</strong> {debugInfo.manualSymbolCheck}</p>
        <p><strong>精度识别:</strong> {debugInfo.manualDecimalsCheck}</p>
        <pre>{JSON.stringify(debugInfo.testUSDCBalance, null, 2)}</pre>
      </div>

      <button 
        onClick={fetchDebugInfo}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        刷新调试信息
      </button>
    </div>
  );
};

export default DebugBalance;
