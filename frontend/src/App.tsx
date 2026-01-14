import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { getPackageId, getRegistryId, getSuiClient, getAllUserStatuses, type UserStatusInfo } from './services/contractService';

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

interface TransactionRecord {
  digest: string;
  type: 'create' | 'check_in' | 'update' | 'add_funds' | 'trigger';
  timestamp: number;
  details: string;
}

function App() {
const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [userStatusId, setUserStatusId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [balance, setBalance] = useState<number>(0);
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [allUserStatuses, setAllUserStatuses] = useState<UserStatusInfo[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const [settings, setSettings] = useState({
    timeout_threshold_hours: 24,
    encrypted_message: '',
    transfer_recipient: '',
    transfer_amount: 0,
    add_funds_amount: 0,
  });

  const t = translations[language];

  const MODULE_NAME = 'ruok';
  const CLOCK_ID = '0x6';
  const RegistryID = "0xa2b544f345711c5e662891cc0558832c30d9919e6eaf3ec4958a1a2da0c7cce2";

  useEffect(() => {
    if (currentAccount) {
      fetchBalance();
      fetchUserStatus();
      loadTransactionHistory();
      fetchAllUserStatuses();
    }
  }, [currentAccount]);

  // 倒计时更新逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      let shouldRefresh = false;
      
      // 更新每个 UserStatus 的倒计时
      const newCountdowns: Record<string, number> = {};
      allUserStatuses.forEach(status => {
        const elapsed = currentTime - status.last_check_in_ms;
        const remaining = Math.max(0, status.timeout_threshold_ms - elapsed);
        newCountdowns[status.id] = remaining;
        
        // 如果倒计时结束且之前还有剩余时间，需要刷新页面
        if (remaining === 0 && countdowns[status.id] > 0) {
          shouldRefresh = true;
        }
      });
      
      setCountdowns(newCountdowns);
      
      // 如果有倒计时结束，刷新页面
      if (shouldRefresh) {
        console.log('倒计时结束，刷新页面');
        window.location.reload();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [allUserStatuses, countdowns]);

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

  const loadTransactionHistory = () => {
    if (!currentAccount) return;
    const stored = localStorage.getItem(`transaction_history_${currentAccount.address}`);
    if (stored) {
      setTransactionHistory(JSON.parse(stored));
    }
  };

  const saveTransactionRecord = (type: TransactionRecord['type'], details: string, digest: string) => {
    if (!currentAccount) return;
    const record: TransactionRecord = {
      digest,
      type,
      timestamp: Date.now(),
      details,
    };
    const updated = [record, ...transactionHistory];
    setTransactionHistory(updated);
    localStorage.setItem(`transaction_history_${currentAccount.address}`, JSON.stringify(updated));
  };

  const handleCheckIn = async () => {
    if (!currentAccount || !userStatus || !userStatusId) return;
    setLoading(true);

    try {
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::check_in` as `${string}::${string}::${string}`;
      const clockId = '0x6';

      console.log('=== 调用智能合约: check_in ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - clock_id:', CLOCK_ID);
      console.log('============================');

      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(CLOCK_ID),
        ],
      });

      console.log('=== 调用智能合约: check_in ===');
      const result = await signAndExecuteTransaction({
        transaction: txb,
      });
      
      // 保存交易记录
      if (result && 'digest' in result) {
        saveTransactionRecord('check_in', '签到确认', result.digest);
      }
      
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
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::create_user_status`;
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
      console.log('  - clock_id:', CLOCK_ID);
      console.log('  - registry_id:', getRegistryId());
      console.log('===========================================');

      txb.moveCall({
        target,
        arguments: [
          txb.pure.u64(timeoutMs),
          txb.pure.string(settings.encrypted_message),
          txb.pure.address(settings.transfer_recipient),
          coin,
          txb.object(CLOCK_ID),
          txb.object(getRegistryId()),
        ],
      });

      console.log('=== 调用智能合约: create_user_status ===');
      console.log('准备签名交易...');
      
      const result = await signAndExecuteTransaction({
        transaction: txb,
      });
      
      console.log('交易签名成功:', result);
      
      // 保存交易记录
      if (result && 'digest' in result) {
        saveTransactionRecord(
          'create',
          `创建用户状态: ${settings.transfer_amount} SUI`,
          result.digest
        );
      }

      // 从交易结果中提取 UserStatus ID
      if (result && 'digest' in result) {
        const txResponse = await fetch('https://fullnode.testnet.sui.io', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getTransaction',
            params: [result.digest],
          }),
        });
        const txData = await txResponse.json();
        if (txData.result && txData.result.effects && txData.result.effects.created) {
          const userStatusObj = txData.result.effects.created.find(
            (obj: any) => obj.owner && obj.owner.Shared
          );
          if (userStatusObj) {
            setUserStatusId(userStatusObj.reference.objectId);
          }
        }
      }

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
    if (!currentAccount || !userStatus || !userStatusId) return;
    setLoading(true);

    try {
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::update_settings` as `${string}::${string}::${string}`;
      const timeoutMs = settings.timeout_threshold_hours * 3600000;

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

      console.log('=== 调用智能合约: update_settings ===');
      await signAndExecuteTransaction({
        transaction: txb,
      });
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

  const handleAddFunds = async () => {
    if (!currentAccount || !userStatus || !userStatusId) return;
    if (settings.add_funds_amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setLoading(true);

    try {
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::add_funds`;
      const addFundsMist = Math.floor(settings.add_funds_amount * 1_000_000_000);

      const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(addFundsMist)]);

      console.log('=== 调用智能合约: add_funds ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - payment_coin:', addFundsMist, 'Mist');
      console.log('=====================================');

      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          coin,
        ],
      });

      console.log('=== 调用智能合约: add_funds ===');
      await signAndExecuteTransaction({
        transaction: txb,
      });
      await fetchUserStatus();
      await fetchBalance();
      setSettings({ ...settings, add_funds_amount: 0 });
      alert('Funds added successfully!');
    } catch (error) {
      console.error('Add funds failed:', error);
      alert('Failed to add funds. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStatus = async () => {
    if (!currentAccount) return;
    
    try {
      const client = getSuiClient();
      const registryId = getRegistryId();
      const packageId = getPackageId();
      
      console.log('正在获取 Registry，ID:', registryId);
      console.log('Package ID:', packageId);
      
      // 1. 获取 Registry 对象
      const registryObj = await client.getObject({
        id: registryId,
        options: {
          showType: true,
          showContent: true,
        },
      });
      
      console.log('Registry 响应:', registryObj);
      
      if (!registryObj.data || !registryObj.data.content) {
        console.log('Registry not found');
        setUserStatus(null);
        setUserStatusId(null);
        return;
      }
      
      // 检查 content 的类型
      if (registryObj.data.content.dataType !== 'moveObject') {
        console.log('Registry is not a Move object');
        setUserStatus(null);
        setUserStatusId(null);
        return;
      }
      
      const fields = registryObj.data.content.fields;
      const userStatusIds = fields.user_status_ids || [];
      
      // 2. 遍历所有 UserStatus ID，找到属于当前用户的
      for (const id of userStatusIds) {
        const userStatusObj = await client.getObject({
          id,
          options: {
            showType: true,
            showContent: true,
          },
        });
        
        if (userStatusObj.data && userStatusObj.data.content && userStatusObj.data.content.dataType === 'moveObject') {
          const userStatusFields = userStatusObj.data.content.fields;
          
          // 检查是否属于当前用户
          if (userStatusFields.owner.toLowerCase() === currentAccount.address.toLowerCase()) {
            setUserStatusId(id);
            
            // 安全地获取 stored_balance
            let storedBalance = 0;
            if (userStatusFields.stored_balance) {
              if (typeof userStatusFields.stored_balance === 'number') {
                storedBalance = userStatusFields.stored_balance;
              } else if (userStatusFields.stored_balance.fields?.value) {
                storedBalance = Number(userStatusFields.stored_balance.fields.value);
              } else if (userStatusFields.stored_balance.value) {
                storedBalance = Number(userStatusFields.stored_balance.value);
              }
            }
            
            setUserStatus({
              owner: userStatusFields.owner,
              last_check_in_ms: Number(userStatusFields.last_check_in_ms),
              timeout_threshold_ms: Number(userStatusFields.timeout_threshold_ms),
              encrypted_message: userStatusFields.encrypted_message,
              transfer_recipient: userStatusFields.transfer_recipient,
              stored_balance: storedBalance,
            });
            return;
          }
        }
      }
      
      // 没有找到属于当前用户的 UserStatus
      setUserStatus(null);
      setUserStatusId(null);
      
    } catch (error) {
      console.error('Failed to fetch user status:', error);
    }
  };

  const handleTrigger = async () => {
    if (!currentAccount || !userStatus || !userStatusId) return;
    setLoading(true);

    try {
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::trigger`;

      console.log('=== 调用智能合约: trigger ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - clock_id:', CLOCK_ID);
      console.log('=====================================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(CLOCK_ID),
        ],
      });
      
      await signAndExecuteTransaction({
        transaction: txb,
      });
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

  const fetchAllUserStatuses = async () => {
    try {
      const statuses = await getAllUserStatuses();
      setAllUserStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch all user statuses:', error);
    }
  };

  const handleExternalTrigger = async (userStatusId: string) => {
    if (!currentAccount) return;
    setLoading(true);

    try {
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::trigger`;

      console.log('=== 调用智能合约: trigger (外部) ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - clock_id:', CLOCK_ID);
      console.log('=====================================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(CLOCK_ID),
        ],
      });
      
      await signAndExecuteTransaction({
        transaction: txb,
      });
      await fetchBalance();
      await fetchAllUserStatuses();
      alert('Trigger executed successfully!');
    } catch (error) {
      console.error('Trigger failed:', error);
      alert('Trigger failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTriggerReward = (balance: number): number => {
    return balance / 100;
  };

  const isStatusTimeout = (status: UserStatusInfo): boolean => {
    const currentTime = Date.now();
    const elapsed = currentTime - status.last_check_in_ms;
    return elapsed >= status.timeout_threshold_ms;
  };

  const getRemainingTimeForStatus = (status: UserStatusInfo): number => {
    const currentTime = Date.now();
    const elapsed = currentTime - status.last_check_in_ms;
    const remaining = status.timeout_threshold_ms - elapsed;
    return Math.max(0, remaining);
  };

  const formatRemainingTime = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  };

  const remainingMs = getRemainingTime();
  const remainingHours = getRemainingHours();
  const isTimeout = remainingMs === 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <button className="settings-btn" onClick={() => setShowSettings(true)}>
        ⚙️ {t.settings}
      </button>
      <button className="history-btn" onClick={() => setShowHistory(true)}>
        📜 历史
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
                <span className="font-mono">{t.remainingTime}: {formatRemainingTime(remainingMs)}</span>
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

              {userStatus && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">追加资金 (SUI)</label>
                    <input
                      type="number"
                      step="0.000000001"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={settings.add_funds_amount}
                      onChange={(e) =>
                        setSettings({ ...settings, add_funds_amount: Number(e.target.value) })
                      }
                      placeholder="输入追加金额"
                    />
                  </div>
                  <button
                    className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleAddFunds}
                    disabled={loading}
                  >
                    {loading ? t.processing : '追加资金'}
                  </button>
                </>
              )}
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

      {showHistory && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex justify-between items-center">
              <h5 className="text-white font-semibold text-lg">📜 历史记录</h5>
              <button
                className="text-white hover:text-gray-200 text-2xl leading-none"
                onClick={() => setShowHistory(false)}
              >
                ×
              </button>
            </div>
            
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  className={`flex-1 px-6 py-3 font-medium transition-colors ${
                    true ? 'bg-white text-purple-600 border-b-2 border-purple-600' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  用户状态列表
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[65vh]">
              {allUserStatuses.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  暂无用户状态记录
                </div>
              ) : (
                <div className="space-y-4">
                  {allUserStatuses.map((status, index) => {
                    const isTimeout = isStatusTimeout(status);
                    const remainingTime = countdowns[status.id] ?? getRemainingTimeForStatus(status);
                    const triggerReward = calculateTriggerReward(status.stored_balance);
                    const isOwn = currentAccount && status.owner.toLowerCase() === currentAccount.address.toLowerCase();
                    
                    // 调试日志
                    console.log(`渲染 UserStatus ${index}:`, {
                      id: status.id,
                      stored_balance: status.stored_balance,
                      stored_balance_SUI: (status.stored_balance / 1_000_000_000).toFixed(4),
                      triggerReward: triggerReward,
                      triggerReward_SUI: (triggerReward / 1_000_000_000).toFixed(4),
                      isTimeout,
                      remainingTime,
                    });
                    
                    return (
                      <div
                        key={index}
                        className={`border rounded-lg p-4 transition-colors ${
                          isTimeout ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              {isOwn ? '👤' : '👥'}
                            </span>
                            <div>
                              <div className="font-medium text-gray-900">
                                {isOwn ? '我的状态' : '其他用户'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {status.owner.slice(0, 6)}...{status.owner.slice(-4)}
                              </div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isTimeout 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {isTimeout ? '⚠️ 已到期' : '✅ 正常'}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">余额</div>
                            <div className="font-semibold text-gray-900">
                              {(status.stored_balance / 1_000_000_000).toFixed(4)} SUI
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">触发奖励</div>
                            <div className="font-semibold text-yellow-600">
                              {(triggerReward / 1_000_000_000).toFixed(4)} SUI
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">剩余时间</div>
                            <div className={`font-semibold font-mono ${
                              isTimeout ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {isTimeout ? '已超时' : formatRemainingTime(remainingTime)}
                            </div>
                          </div>
                        </div>

                        {isTimeout && status.stored_balance > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-yellow-800">
                                  🎁 触发奖励
                                </div>
                                <div className="text-xs text-yellow-600">
                                  触发此状态可获得 {(triggerReward / 1_000_000_000).toFixed(4)} SUI
                                </div>
                              </div>
                              <button
                                className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                onClick={() => handleExternalTrigger(status.id)}
                                disabled={loading}
                              >
                                {loading ? '处理中...' : '触发'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 space-y-1">
                          <div>
                            <span className="font-medium">收款人:</span>{' '}
                            {status.transfer_recipient.slice(0, 6)}...{status.transfer_recipient.slice(-4)}
                          </div>
                          <div>
                            <span className="font-medium">最后签到:</span>{' '}
                            {new Date(status.last_check_in_ms).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;