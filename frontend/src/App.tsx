import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { getPackageId, getRegistryId, getSuiClient, getAllUserStatuses, getCurrentNetwork, type UserStatusInfo, type RegistryFields, type UserStatusFields } from './services/contractService';
import { networkConfig } from './config/networkConfig';


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
    history: '历史',
    historyTitle: '历史记录',
    userList: '用户状态列表',
    noRecords: '暂无用户状态记录',
    myStatus: '我的状态',
    otherUsers: '其他用户',
    expired: '已到期',
    normal: '正常',
    balanceLabel: '余额',
    triggerReward: '触发奖励',
    remainingTimeLabel: '剩余时间',
    timeoutExpired: '已超时',
    triggerRewardText: '触发奖励',
    triggerRewardDesc: '触发此状态可获得 {amount} SUI',
    triggering: '触发中...',
    triggerButton: '触发',
    recipient: '收款人',
    lastCheckIn: '最后签到',
    currentSettings: '当前设置',
    timeoutTime: '超时时间',
    recipientAddressLabel: '收款地址',
    encryptedMessageLabel: '加密消息',
    userStatusSet: 'UserStatus 已设置，无法修改',
    year: '年',
    month: '月',
    day: '日',
    hour: '小时',
    total: '总计',
    checkInRecord: '签到确认',
    createUserStatusRecord: '创建用户状态: {amount} SUI',
    updateSettingsRecord: '更新设置: {hours}小时超时',
    addFundsRecord: '追加资金: {amount} SUI',
    triggerRecord: '触发预设事务',
    triggerExternalRecord: '触发预设事务（外部）',
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
    history: 'History',
    historyTitle: 'History',
    userList: 'User Status List',
    noRecords: 'No user status records',
    myStatus: 'My Status',
    otherUsers: 'Other Users',
    expired: 'Expired',
    normal: 'Normal',
    balanceLabel: 'Balance',
    triggerReward: 'Trigger Reward',
    remainingTimeLabel: 'Remaining Time',
    timeoutExpired: 'Timeout',
    triggerRewardText: 'Trigger Reward',
    triggerRewardDesc: 'Trigger this status to get {amount} SUI',
    triggering: 'Triggering...',
    triggerButton: 'Trigger',
    recipient: 'Recipient',
    lastCheckIn: 'Last Check-in',
    currentSettings: 'Current Settings',
    timeoutTime: 'Timeout Time',
    recipientAddressLabel: 'Recipient Address',
    encryptedMessageLabel: 'Encrypted Message',
    userStatusSet: 'UserStatus is set and cannot be modified',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    hour: 'Hour',
    total: 'Total',
    checkInRecord: 'Check-in confirmed',
    createUserStatusRecord: 'Create user status: {amount} SUI',
    updateSettingsRecord: 'Update settings: {hours} hours timeout',
    addFundsRecord: 'Add funds: {amount} SUI',
    triggerRecord: 'Trigger preset transaction',
    triggerExternalRecord: 'Trigger preset transaction (external)',
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
  const [triggeringIds, setTriggeringIds] = useState<Set<string>>(new Set());

  const [settings, setSettings] = useState({
    timeout_threshold_hours: 24,
    timeout_years: 0,
    timeout_months: 0,
    timeout_days: 0,
    timeout_hours: 24,
    encrypted_message: '',
    transfer_recipient: '',
    transfer_amount: 0,
    add_funds_amount: 0,
  });

  const t = translations[language];

  const MODULE_NAME = 'ruok';
  const CLOCK_ID = '0x6';

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
        transaction: txb as any,
      });
      
      // 保存交易记录
      if (result && 'digest' in result) {
        saveTransactionRecord('check_in', t.checkInRecord, result.digest);
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
        transaction: txb as any,
      });
      
      console.log('交易签名成功:', result);
      
      // 保存交易记录
      if (result && 'digest' in result) {
        saveTransactionRecord(
          'create',
          t.createUserStatusRecord.replace('{amount}', settings.transfer_amount.toString()),
          result.digest
        );
      }

      // 从交易结果中提取 UserStatus ID
      if (result && 'digest' in result) {
        const network = getCurrentNetwork();
        const networkUrl = networkConfig[network]?.url || networkConfig.testnet.url;
        const txResponse = await fetch(networkUrl, {
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
      // 刷新页面以显示最新内容
      window.location.reload();
    } catch (error) {
      console.error('Create user status failed:', error);
      alert('Failed to create user status. Please try again.');
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
      
      const fields = registryObj.data.content.fields as unknown as RegistryFields;
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
          const userStatusFields = userStatusObj.data.content.fields as unknown as UserStatusFields;
          
          // 检查是否属于当前用户
          if (userStatusFields.owner.toLowerCase() === currentAccount.address.toLowerCase()) {
            setUserStatusId(id);
            
            // 安全地获取 stored_balance
            let storedBalance = 0;
            if (userStatusFields.stored_balance) {
              // 优先处理字符串类型（Sui API 返回的 Balance 可能是字符串）
              if (typeof userStatusFields.stored_balance === 'string') {
                storedBalance = Number(userStatusFields.stored_balance);
              } else if (typeof userStatusFields.stored_balance === 'number') {
                storedBalance = userStatusFields.stored_balance;
              } else if (userStatusFields.stored_balance.fields?.value) {
                storedBalance = Number(userStatusFields.stored_balance.fields.value);
              } else if (userStatusFields.stored_balance.value) {
                storedBalance = Number(userStatusFields.stored_balance.value);
              }
            }
            
            console.log('fetchUserStatus 解析后的 storedBalance:', storedBalance, `(${(storedBalance / 1_000_000_000).toFixed(4)} SUI)`);
            
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
      console.log('  - registry_id:', getRegistryId());
      console.log('  - clock_id:', CLOCK_ID);
      console.log('=====================================');
      
      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(getRegistryId()),
          txb.object(CLOCK_ID),
        ],
      });
      
      const result = await signAndExecuteTransaction({
        transaction: txb as any,
      });
      
      // 保存交易记录
      if (result && 'digest' in result) {
        saveTransactionRecord(
          'trigger',
          t.triggerRecord,
          result.digest
        );
      }
      
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
    setTriggeringIds(prev => new Set(prev).add(userStatusId));

    try {
      const txb = new Transaction();
      txb.setSender(currentAccount.address);
      const target = `${getPackageId()}::${MODULE_NAME}::trigger`;

      console.log('=== 调用智能合约: trigger (外部) ===');
      console.log('Target:', target);
      console.log('Arguments:');
      console.log('  - user_status_id:', userStatusId);
      console.log('  - registry_id:', getRegistryId());
      console.log('  - clock_id:', CLOCK_ID);
      console.log('=====================================');

      txb.moveCall({
        target,
        arguments: [
          txb.object(userStatusId),
          txb.object(getRegistryId()),
          txb.object(CLOCK_ID),
        ],
      });

      const result = await signAndExecuteTransaction({
        transaction: txb as any,
      });
      
      // 保存交易记录
      if (result && 'digest' in result) {
        saveTransactionRecord(
          'trigger',
          t.triggerExternalRecord,
          result.digest
        );
      }
      
      await fetchBalance();
      await fetchAllUserStatuses();
      alert('Trigger executed successfully!');
    } catch (error) {
      console.error('Trigger failed:', error);
      alert('Trigger failed. Please try again.');
    } finally {
      setLoading(false);
      setTriggeringIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userStatusId);
        return newSet;
      });
    }
  };

  const calculateTriggerReward = (balance: number): number => {
    return balance / 1000;
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
  const isTimeout = remainingMs === 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <button className="settings-btn" onClick={() => setShowSettings(true)}>
        ⚙️ {t.settings}
      </button>
      <button className="history-btn" onClick={() => setShowHistory(true)}>
        📜 {t.history}
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
              <div className="flex items-center gap-3">
                <h5 className="text-white font-semibold text-lg">{t.settings}</h5>
                <span className="text-white text-xs bg-white bg-opacity-20 px-2 py-1 rounded">v0.0.2</span>
              </div>
              <button
                className="text-white hover:text-gray-200 text-2xl leading-none"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              {userStatus ? (
                // 已设置过 UserStatus，只显示信息
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-3">{t.currentSettings}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t.timeoutTime}:</span>
                        <span className="font-medium">{(userStatus.timeout_threshold_ms / 3600000).toFixed(1)} {t.hours}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t.recipientAddressLabel}:</span>
                        <span className="font-medium text-right max-w-[200px] truncate" title={userStatus.transfer_recipient}>
                          {userStatus.transfer_recipient.slice(0, 10)}...{userStatus.transfer_recipient.slice(-8)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t.balance}:</span>
                        <span className="font-medium">{(userStatus.stored_balance / 1_000_000_000).toFixed(4)} SUI</span>
                      </div>
                      {userStatus.encrypted_message && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t.encryptedMessageLabel}:</span>
                          <span className="font-medium text-right max-w-[200px] truncate" title={userStatus.encrypted_message}>
                            {userStatus.encrypted_message.slice(0, 15)}...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center text-sm text-gray-500">
                    ⚠️ {t.userStatusSet}
                  </div>
                </div>
              ) : (
                // 未设置过 UserStatus，显示创建表单
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t.timeoutHours}</label>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t.year}</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                          value={settings.timeout_years}
                          onChange={(e) => {
                            const years = Number(e.target.value) || 0;
                            setSettings({ 
                              ...settings, 
                              timeout_years: years,
                              timeout_threshold_hours: years * 8760 + settings.timeout_months * 730 + settings.timeout_days * 24 + settings.timeout_hours
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t.month}</label>
                        <input
                          type="number"
                          min="0"
                          max="11"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                          value={settings.timeout_months}
                          onChange={(e) => {
                            const months = Math.min(11, Math.max(0, Number(e.target.value) || 0));
                            setSettings({ 
                              ...settings, 
                              timeout_months: months,
                              timeout_threshold_hours: settings.timeout_years * 8760 + months * 730 + settings.timeout_days * 24 + settings.timeout_hours
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t.day}</label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                          value={settings.timeout_days}
                          onChange={(e) => {
                            const days = Math.min(30, Math.max(0, Number(e.target.value) || 0));
                            setSettings({ 
                              ...settings, 
                              timeout_days: days,
                              timeout_threshold_hours: settings.timeout_years * 8760 + settings.timeout_months * 730 + days * 24 + settings.timeout_hours
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t.hour}</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                          value={settings.timeout_hours}
                          onChange={(e) => {
                            const hours = Math.min(23, Math.max(0, Number(e.target.value) || 0));
                            setSettings({ 
                              ...settings, 
                              timeout_hours: hours,
                              timeout_threshold_hours: settings.timeout_years * 8760 + settings.timeout_months * 730 + settings.timeout_days * 24 + hours
                            });
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {t.total}: {settings.timeout_threshold_hours} {t.hours}
                    </div>
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
              {!userStatus && (
                <button
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCreateUserStatus}
                  disabled={loading}
                >
                  {loading ? t.processing : t.createStatus}
                </button>
              )}
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
              <h5 className="text-white font-semibold text-lg">📜 {t.historyTitle}</h5>
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
                  {t.userList}
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[65vh]">
              {allUserStatuses.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {t.noRecords}
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
                                {isOwn ? t.myStatus : t.otherUsers}
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
                            {isTimeout ? '⚠️ ' + t.expired : '✅ ' + t.normal}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">{t.balanceLabel}</div>
                            <div className="font-semibold text-gray-900">
                              {(status.stored_balance / 1_000_000_000).toFixed(4)} SUI
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">{t.triggerReward}</div>
                            <div className="font-semibold text-yellow-600">
                              {(triggerReward / 1_000_000_000).toFixed(4)} SUI
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">{t.remainingTimeLabel}</div>
                            <div className={`font-semibold font-mono ${
                              isTimeout ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {isTimeout ? t.timeoutExpired : formatRemainingTime(remainingTime)}
                            </div>
                          </div>
                        </div>

                        {isTimeout && status.stored_balance > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-yellow-800">
                                  🎁 {t.triggerRewardText}
                                </div>
                                <div className="text-xs text-yellow-600">
                                  {t.triggerRewardDesc.replace('{amount}', (triggerReward / 1_000_000_000).toFixed(4))}
                                </div>
                              </div>
                              <button
                                className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                onClick={() => handleExternalTrigger(status.id)}
                                disabled={loading || triggeringIds.has(status.id)}
                              >
                                {triggeringIds.has(status.id) ? t.triggering : t.triggerButton}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 space-y-1">
                          <div>
                            <span className="font-medium">{t.recipient}:</span>{' '}
                            {status.transfer_recipient.slice(0, 6)}...{status.transfer_recipient.slice(-4)}
                          </div>
                          <div>
                            <span className="font-medium">{t.lastCheckIn}:</span>{' '}
                            {new Date(status.last_check_in_ms).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
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