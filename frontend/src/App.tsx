import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const translations = {
  zh: {
    title: '你还好吗？',
    connectWallet: '请先连接 Sui 钱包',
    setupStatus: '请先设置您的状态信息',
    startSetup: '开始设置',
    remainingTime: '剩余时间',
    hours: '小时',
    timeout: '已超时！',
    ok: 'OK',
    trigger: '触发预设事务',
    settings: '设置',
    cancel: '取消',
    processing: '处理中...',
    updateSettings: '更新设置',
    createStatus: '创建',
    timeoutHours: '超时时间（小时）',
    recipientAddress: '收款地址',
    transferAmount: '转账金额（SUI）',
    encryptedMessage: '加密提示语',
    messagePlaceholder: '输入您的提示语（可以是加密后的内容），触发时将发送给收款人',
    addressPlaceholder: '输入 Sui 地址',
    amountPlaceholder: '输入转账金额',
    balance: '余额',
  },
  en: {
    title: 'Are You OK?',
    connectWallet: 'Please connect your Sui wallet',
    setupStatus: 'Please setup your status first',
    startSetup: 'Start Setup',
    remainingTime: 'Remaining time',
    hours: 'hours',
    timeout: 'Timeout!',
    ok: 'OK',
    trigger: 'Trigger Preset Transaction',
    settings: 'Settings',
    cancel: 'Cancel',
    processing: 'Processing...',
    updateSettings: 'Update Settings',
    createStatus: 'Create',
    timeoutHours: 'Timeout (hours)',
    recipientAddress: 'Recipient Address',
    transferAmount: 'Transfer Amount (SUI)',
    encryptedMessage: 'Encrypted Message',
    messagePlaceholder: 'Enter your message (can be encrypted), will be sent to recipient on trigger',
    addressPlaceholder: 'Enter Sui address',
    amountPlaceholder: 'Enter transfer amount',
    balance: 'Balance',
  },
};

interface UserStatus {
  owner: string;
  last_check_in_ms: number;
  timeout_threshold_ms: number;
  encrypted_message: string;
  transfer_recipient: string;
  stored_balance: number;
}

function App() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const [userStatus] = useState<UserStatus | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [balance, setBalance] = useState<number>(0);

  const [settings, setSettings] = useState({
    timeout_threshold_hours: 24,
    encrypted_message: '',
    transfer_recipient: '',
    transfer_amount: 0,
  });

  const t = translations[language];

  const PACKAGE_ID = '0x0';
  const MODULE_NAME = 'ruok';

  useEffect(() => {
    if (currentAccount) {
      fetchBalance();
    }
  }, [currentAccount]);

  const fetchBalance = async () => {
    if (!currentAccount) return;
    try {
      const response = await fetch('https://fullnode.testnet.sui.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getBalance',
          params: [currentAccount.address, '0x2::sui::SUI'],
        }),
      });
      const data = await response.json();
      setBalance(Number(data.result.totalBalance) / 1_000_000_000);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handleCheckIn = async () => {
    if (!currentAccount || !userStatus) return;
    setLoading(true);

    try {
      const txb = new TransactionBlock();
      const target = `${PACKAGE_ID}::${MODULE_NAME}::check_in`;
      const userStatusId = 'user_status_id';
      const clockId = '0x6';
      
      console.log('=== 调用智能合约: check_in ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - clock_id:', clockId);
      console.log('============================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(clockId),
        ],
      });

      const transactionBytes = await txb.build();
      const transaction = btoa(String.fromCharCode(...transactionBytes));
      console.log('Transaction bytes:', transaction);
      await signAndExecuteTransactionBlock({ transaction });
      await fetchUserStatus();
      await fetchBalance();
    } catch (error) {
      console.error('Check-in failed:', error);
      alert('Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUserStatus = async () => {
    if (!currentAccount) return;
    setLoading(true);

    try {
      const txb = new TransactionBlock();
      const target = `${PACKAGE_ID}::${MODULE_NAME}::create_user_status`;
      const timeoutMs = settings.timeout_threshold_hours * 3600000;
      const transferAmountMist = Math.floor(settings.transfer_amount * 1_000_000_000);
      const clockId = '0x6';
      
      const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(transferAmountMist)]);
      
      console.log('=== 调用智能合约: create_user_status ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - timeout_threshold_ms:', timeoutMs);
      console.log('  - encrypted_message:', settings.encrypted_message);
      console.log('  - transfer_recipient:', settings.transfer_recipient);
      console.log('  - payment_coin:', transferAmountMist, 'Mist');
      console.log('  - clock_id:', clockId);
      console.log('===========================================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.pure.u64(timeoutMs),
          txb.pure.string(settings.encrypted_message),
          txb.pure.address(settings.transfer_recipient),
          coin,
          txb.object(clockId),
        ],
      });

      const transactionBytes = await txb.build();
      const transaction = btoa(String.fromCharCode(...transactionBytes));
      console.log('Transaction bytes:', transaction);
      await signAndExecuteTransactionBlock({ transaction });
      await fetchUserStatus();
      await fetchBalance();
      setShowSettings(false);
    } catch (error) {
      console.error('Create user status failed:', error);
      alert('Failed to create user status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!currentAccount || !userStatus) return;
    setLoading(true);

    try {
      const txb = new TransactionBlock();
      const target = `${PACKAGE_ID}::${MODULE_NAME}::update_settings`;
      const timeoutMs = settings.timeout_threshold_hours * 3600000;
      const userStatusId = 'user_status_id';
      
      console.log('=== 调用智能合约: update_settings ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - timeout_threshold_ms:', timeoutMs);
      console.log('  - encrypted_message:', settings.encrypted_message);
      console.log('  - transfer_recipient:', settings.transfer_recipient);
      console.log('===========================================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.pure.u64(timeoutMs),
          txb.pure.string(settings.encrypted_message),
          txb.pure.address(settings.transfer_recipient),
        ],
      });

      const transactionBytes = await txb.build();
      const transaction = btoa(String.fromCharCode(...transactionBytes));
      console.log('Transaction bytes:', transaction);
      await signAndExecuteTransactionBlock({ transaction });
      await fetchUserStatus();
      await fetchBalance();
      setShowSettings(false);
    } catch (error) {
      console.error('Update settings failed:', error);
      alert('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStatus = async () => {
    if (!currentAccount) return;
  };

  const handleTrigger = async () => {
    if (!currentAccount || !userStatus) return;
    setLoading(true);

    try {
      const txb = new TransactionBlock();
      const target = `${PACKAGE_ID}::${MODULE_NAME}::trigger`;
      const userStatusId = 'user_status_id';
      const clockId = '0x6';
      
      console.log('=== 调用智能合约: trigger ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - clock_id:', clockId);
      console.log('=====================================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(clockId),
        ],
      });

      const transactionBytes = await txb.build();
      const transaction = btoa(String.fromCharCode(...transactionBytes));
      console.log('Transaction bytes:', transaction);
      await signAndExecuteTransactionBlock({ transaction });
      await fetchBalance();
      alert('Trigger executed successfully!');
    } catch (error) {
      console.error('Trigger failed:', error);
      alert('Trigger failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = () => {
    if (!userStatus) return 0;
    const currentTime = Date.now();
    const elapsed = currentTime - userStatus.last_check_in_ms;
    const remaining = userStatus.timeout_threshold_ms - elapsed;
    return Math.max(0, remaining);
  };

  const getRemainingHours = () => {
    const remainingMs = getRemainingTime();
    return Math.floor(remainingMs / 3600000);
  };

  const remainingMs = getRemainingTime();
  const remainingHours = getRemainingHours();
  const isTimeout = remainingMs === 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <button className="settings-btn" onClick={() => setShowSettings(true)}>
        ⚙️ {t.settings}
      </button>

      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '12px' }}>
        {currentAccount && (
          <div className="text-sm text-gray-600">
            {t.balance}: {balance.toFixed(4)} SUI
          </div>
        )}
        <button
          className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
          onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
        >
          {language === 'zh' ? 'EN' : '中文'}
        </button>
        <ConnectButton />
      </div>

      <div className="max-w-2xl mx-auto pt-32 text-center">
        <h1 className="text-5xl font-bold mb-8">
          {t.title}
        </h1>

        {!currentAccount && (
          <div className="mt-8">
            <p className="text-xl text-gray-600">
              {t.connectWallet}
            </p>
          </div>
        )}

        {currentAccount && !userStatus && (
          <div className="mt-8">
            <p className="text-xl text-gray-600 mb-8">
              {t.setupStatus}
            </p>
            <button className="ok-button" onClick={() => setShowSettings(true)}>
              {t.startSetup}
            </button>
          </div>
        )}

        {currentAccount && userStatus && (
          <div className="mt-8">
            <div className="countdown">
              {isTimeout ? (
                <span className="text-red-500">{t.timeout}</span>
              ) : (
                <span>{t.remainingTime}: {remainingHours} {t.hours}</span>
              )}
            </div>

            <button
              className="ok-button"
              onClick={handleCheckIn}
              disabled={loading || isTimeout}
            >
              {t.ok}
            </button>

            {isTimeout && (
              <div className="mt-8">
                <button
                  className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleTrigger}
                  disabled={loading}
                >
                  {t.trigger}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-green-500 to-blue-500 p-4 flex justify-between items-center">
              <h5 className="text-white font-semibold text-lg">{t.settings}</h5>
              <button
                className="text-white hover:text-gray-200 text-2xl leading-none"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.timeoutHours}</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={settings.timeout_threshold_hours}
                  onChange={(e) =>
                    setSettings({ ...settings, timeout_threshold_hours: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.recipientAddress}</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={settings.transfer_recipient}
                  onChange={(e) =>
                    setSettings({ ...settings, transfer_recipient: e.target.value })
                  }
                  placeholder={t.addressPlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.transferAmount}</label>
                <input
                  type="number"
                  step="0.000000001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={settings.transfer_amount}
                  onChange={(e) =>
                    setSettings({ ...settings, transfer_amount: Number(e.target.value) })
                  }
                  placeholder={t.amountPlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.encryptedMessage}</label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={4}
                  value={settings.encrypted_message}
                  onChange={(e) =>
                    setSettings({ ...settings, encrypted_message: e.target.value })
                  }
                  placeholder={t.messagePlaceholder}
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                onClick={() => setShowSettings(false)}
              >
                {t.cancel}
              </button>
              <button
                className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={userStatus ? handleUpdateSettings : handleCreateUserStatus}
                disabled={loading}
              >
                {loading ? t.processing : userStatus ? t.updateSettings : t.createStatus}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;