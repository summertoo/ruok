import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletService, WalletInfo, ScheduledTransferInfo } from '../services/walletService';
import { contractService } from '../services/contractService';
import { getSuiClient } from '../services/contractService';
import { marketplaceService, SupportedToken } from '../services/marketplaceService';
import { balanceService } from '../services/balanceService';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';
import { ensureUSDCTokenSupport, getTokenDisplayName } from '../utils/tokenSupportChecker';

interface ObjectWalletProps {
  objectId: string;
  currentAccount?: any; // 可能是字符串地址或完整的账户对象
  onClose?: () => void;
}

const ObjectWallet: React.FC<ObjectWalletProps> = ({ objectId, currentAccount }) => {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [scheduledTransfers, setScheduledTransfers] = useState<ScheduledTransferInfo[]>([]);
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  const [selectedDepositToken, setSelectedDepositToken] = useState<string>('');
  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<string>('');
  const [newTransfer, setNewTransfer] = useState({
    toAddress: '',
    tokenType: '0x2::sui::SUI',
    amount: '',
    executeTime: ''
  });

  const walletService = createWalletService(
    getSuiClient(),
    contractService.getContractConfig().packageId,
    '0xfcfa70b217d961b037839075883a1a742139b5782856029a45df3c036e0c8f79' // AdminCap ID
  );

  useEffect(() => {
    loadWalletInfo();
    loadSupportedTokens();
  }, [objectId]);

  const loadSupportedTokens = async () => {
    try {
      const tokens = await marketplaceService.getSupportedTokens();
      console.log('📍 支持的代币:', tokens);
      setSupportedTokens(tokens);
      
      // 设置默认选择的代币为第一个支持的代币
      if (tokens.length > 0) {
        const firstToken = tokens[0].type;
        setSelectedDepositToken(firstToken);
        setSelectedWithdrawToken(firstToken);
        setNewTransfer(prev => ({ ...prev, tokenType: firstToken }));
        console.log('📍 设置默认代币:', firstToken);
      } else {
        // 如果没有找到支持的代币，至少添加SUI
        const defaultSUI = {
          type: '0x2::sui::SUI',
          symbol: 'SUI',
          name: 'Sui',
          decimals: 9,
          icon: '💧'
        };
        setSupportedTokens([defaultSUI]);
        setSelectedDepositToken(defaultSUI.type);
        setSelectedWithdrawToken(defaultSUI.type);
        setNewTransfer(prev => ({ ...prev, tokenType: defaultSUI.type }));
        console.log('📍 使用默认SUI代币:', defaultSUI.type);
      }
    } catch (error) {
      console.error('Failed to load supported tokens:', error);
      // 设置默认的SUI代币
      const defaultSUI = {
        type: '0x2::sui::SUI',
        symbol: 'SUI',
        name: 'Sui',
        decimals: 9,
        icon: '💧'
      };
      setSupportedTokens([defaultSUI]);
      setSelectedDepositToken(defaultSUI.type);
      setSelectedWithdrawToken(defaultSUI.type);
      setNewTransfer(prev => ({ ...prev, tokenType: defaultSUI.type }));
      console.log('📍 出错时使用默认SUI代币:', defaultSUI.type);
    }
  };

  const loadWalletInfo = async () => {
    try {
      setLoading(true);
      const hasWalletResult = await walletService.hasWallet(objectId);
      setHasWallet(hasWalletResult);

      if (hasWalletResult) {
        const walletId = await walletService.getObjectWalletId(objectId);
        if (walletId) {
          const info = await walletService.getWalletInfo(walletId);
          setWalletInfo(info);
          
          // 获取定时转账列表
          await loadScheduledTransfers();
        }
      }
    } catch (error) {
      console.error('Failed to load wallet info:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    if (!currentAccount) {
      alert(t('common.connect.wallet'));
      return;
    }

    try {
      setLoading(true);
      
      // 获取用户地址 - 处理两种情况：字符串地址或完整账户对象
      let userAddress: string;
      if (typeof currentAccount === 'string') {
        userAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        userAddress = currentAccount.address;
      } else {
        console.error('❌ currentAccount 结构异常:', currentAccount);
        throw new Error(t('error.invalidWalletAddress'));
      }

      // 验证地址格式（Sui地址应该是0x开头的66位字符）
      const addressRegex = /^0x[a-fA-F0-9]{64}$/;
      if (!addressRegex.test(userAddress)) {
        throw new Error(`地址格式错误: ${userAddress} (期望: 0x + 64位十六进制字符)`);
      }

      console.log('🔍 开始创建钱包，验证信息:', {
        objectId,
        signerAddress: userAddress,
        addressType: typeof userAddress,
        currentAccountType: typeof currentAccount
      });

      // 使用增强的验证方法检查对象所有权
      console.log('🔍 使用增强验证方法检查对象所有权...');
      const ownershipResult = await contractService.verifyObjectOwnership(objectId, userAddress);
      
      if (!ownershipResult.isOwner) {
        console.error('❌ 所有权验证失败:', ownershipResult.errorMessage);
        throw new Error(ownershipResult.errorMessage || '您不是该对象的所有者');
      }
      
      console.log('✅ 所有权验证通过:', {
        objectId,
        userAddress,
        objectOwner: (ownershipResult.objectDetails?.content as any)?.fields?.owner
      });
      
      console.log('🚀 调用钱包服务创建钱包...');
      
      // 使用新的调用方式，直接传递 signAndExecuteTransaction 函数（参考 purchaseObject 模式）
      const result = await walletService.createWalletForObject(
        objectId,
        signAndExecuteTransaction
      );
      
      console.log('✅ 钱包创建成功，结果:', result);
      
      // 等待一小段时间让区块链状态更新
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('🔄 重新加载钱包信息...');
      await loadWalletInfo();
      
      console.log('✅ 所有操作完成，显示成功消息');
      alert(t('wallet.create.success'));
    } catch (error) {
      console.error('❌ 创建钱包失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '创建钱包失败';
      if (error instanceof Error) {
        if (error.message.includes('Invalid Sui address')) {
          errorMessage = `无效的Sui地址格式: ${typeof currentAccount === 'string' ? currentAccount : currentAccount?.address}`;
        } else if (error.message.includes('地址格式错误')) {
          errorMessage = error.message;
        } else if (error.message.includes('您不拥有此对象')) {
          errorMessage = '您不是该对象的所有者，无法创建钱包';
        } else if (error.message.includes('钱包已存在')) {
          errorMessage = '该对象已经有关联的钱包';
        } else {
          errorMessage = `创建钱包失败: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const depositToken = async () => {
    if (!currentAccount || !walletInfo || !depositAmount) {
      alert(t('wallet.complete.info'));
      return;
    }

    try {
      setLoading(true);
      
      // 获取用户地址 - 处理两种情况：字符串地址或完整账户对象
      let userAddress: string;
      if (typeof currentAccount === 'string') {
        userAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        userAddress = currentAccount.address;
      } else {
        throw new Error('钱包地址无效，请重新连接钱包');
      }
      
      // 创建正确的 signer 对象
      const signer = {
        address: userAddress,
        signAndExecuteTransaction: (params: any) => signAndExecuteTransaction(params)
      };

      // 处理非SUI代币的情况
      let paymentCoinId: string | undefined;
      if (selectedDepositToken !== '0x2::sui::SUI') {
        console.log('🔍 检查非SUI代币余额:', selectedDepositToken);
        
        // 获取代币精度并转换数量
        const decimals = balanceService.getTokenDecimals(selectedDepositToken);
        const amountInSmallestUnit = Math.ceil(parseFloat(depositAmount) * Math.pow(10, decimals));
        
        // 检查用户是否有足够的代币余额
        const balanceCheck = await balanceService.checkTokenBalance(
          userAddress,
          selectedDepositToken,
          amountInSmallestUnit
        );
        
        if (!balanceCheck.hasBalance) {
          throw new Error(
            `余额不足：需要 ${balanceCheck.requiredFormatted} ${balanceCheck.symbol}，当前只有 ${balanceCheck.balanceFormatted}`
          );
        }
        
        paymentCoinId = balanceCheck.coinId;
        console.log('✅ 找到代币对象ID:', paymentCoinId);
      }
      
      // 确保金额是正数
      const depositAmountNum = Math.abs(parseFloat(depositAmount) || 0);
      const amountInSmallestUnit = selectedDepositToken === '0x2::sui::SUI' 
        ? Math.ceil(depositAmountNum * Math.pow(10, 9)).toString()
        : Math.ceil(depositAmountNum * Math.pow(10, balanceService.getTokenDecimals(selectedDepositToken))).toString();
      
      await walletService.depositToken(
        walletInfo.id,
        amountInSmallestUnit,
        selectedDepositToken,
        signAndExecuteTransaction, // 直接传递 signAndExecuteTransaction 函数（参考 purchaseObject 模式）
        paymentCoinId
      );
      setDepositAmount('');
      
      // 立即刷新余额显示
      await refreshWalletBalance();
      
      alert(t('wallet.deposit.success'));
    } catch (error) {
      console.error('Deposit failed:', error);
      const errorMessage = (error as Error).message;
      // 检查是否是真正的错误，还是只是警告信息
      if (errorMessage.includes('存入代币失败') || errorMessage.includes('交易失败')) {
        alert(t('wallet.deposit.failed') + ': ' + errorMessage);
      } else {
        // 如果不是真正的错误，可能是成功后的警告信息
        console.log('存入操作完成，可能有警告信息:', errorMessage);
        alert(t('wallet.deposit.success'));
        setDepositAmount('');
        await loadWalletInfo();
      }
    } finally {
      setLoading(false);
    }
  };

  const withdrawToken = async () => {
    if (!currentAccount || !walletInfo || !withdrawAmount) {
      alert(t('wallet.complete.info'));
      return;
    }

    try {
      setLoading(true);
      
      // 获取用户地址 - 处理两种情况：字符串地址或完整账户对象
      let userAddress: string;
      if (typeof currentAccount === 'string') {
        userAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        userAddress = currentAccount.address;
      } else {
        throw new Error('钱包地址无效，请重新连接钱包');
      }
      
      // 创建正确的 signer 对象
      const signer = {
        address: userAddress,
        signAndExecuteTransaction: (params: any) => signAndExecuteTransaction(params)
      };

      // 获取代币精度并转换数量，确保金额是正数
      const decimals = balanceService.getTokenDecimals(selectedWithdrawToken);
      const withdrawAmountNum = Math.abs(parseFloat(withdrawAmount) || 0);
      const amountInSmallestUnit = Math.ceil(withdrawAmountNum * Math.pow(10, decimals)).toString();
      
      console.log('🔍 提取代币参数:', {
        walletId: walletInfo.id,
        amount: amountInSmallestUnit,
        tokenType: selectedWithdrawToken,
        decimals
      });
      
      await walletService.withdrawToken(
        walletInfo.id,
        amountInSmallestUnit,
        selectedWithdrawToken,
        signAndExecuteTransaction, // 直接传递 signAndExecuteTransaction 函数（参考 purchaseObject 模式）
        userAddress // 传递用户地址用于代币转移
      );
      setWithdrawAmount('');
      
      // 立即刷新余额显示
      await refreshWalletBalance();
      
      alert(t('wallet.withdraw.success'));
    } catch (error) {
      console.error('Withdraw failed:', error);
      alert(t('wallet.withdraw.failed') + ': ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createScheduledTransfer = async () => {
    if (!currentAccount || !walletInfo) {
      alert(t('wallet.create.first'));
      return;
    }

    if (!newTransfer.toAddress || !newTransfer.amount || !newTransfer.executeTime) {
      alert(t('wallet.transfer.complete.info'));
      return;
    }

    // 验证接收地址格式
    const addressRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!addressRegex.test(newTransfer.toAddress)) {
      alert(t('wallet.transfer.address.error'));
      return;
    }

    // 验证金额
    const transferAmountNum = parseFloat(newTransfer.amount);
    if (isNaN(transferAmountNum) || transferAmountNum <= 0) {
      alert(t('wallet.transfer.amount.error'));
      return;
    }

    // 验证执行时间
    const executeDate = new Date(newTransfer.executeTime);
    const now = new Date();
    const minFutureTime = new Date(now.getTime() + 60000); // 至少1分钟后
    
    if (executeDate <= minFutureTime) {
      alert(t('wallet.transfer.time.error'));
      return;
    }

    try {
      setLoading(true);
      
      // 获取用户地址
      let userAddress: string;
      if (typeof currentAccount === 'string') {
        userAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        userAddress = currentAccount.address;
      } else {
        throw new Error('钱包地址无效，请重新连接钱包');
      }
      
      // 创建signer对象
      const signer = {
        address: userAddress,
        signAndExecuteTransaction: (params: any) => signAndExecuteTransaction(params)
      };

      // 获取代币精度并转换数量，确保金额是正数
      const decimals = balanceService.getTokenDecimals(newTransfer.tokenType);
      const amountInSmallestUnit = Math.ceil(transferAmountNum * Math.pow(10, decimals)).toString();
      const tokenType = newTransfer.tokenType;
      const formattedTokenType = tokenType.startsWith('0x') ? tokenType : `0x${tokenType}`;
      
      console.log('🕒 创建定时转账参数:', {
        walletId: walletInfo.id,
        objectId: objectId,
        toAddress: newTransfer.toAddress,
        tokenType: formattedTokenType,
        amount: amountInSmallestUnit,
        executeTime: newTransfer.executeTime
      });

      const transferId = await walletService.createScheduledTransfer(
        walletInfo.id,
        objectId,
        newTransfer.toAddress,
        formattedTokenType,
        amountInSmallestUnit,
        newTransfer.executeTime, // 直接传递日期时间字符串，让服务层处理转换
        signAndExecuteTransaction, // 直接传递 signAndExecuteTransaction 函数（参考 executeScheduledTransfer 模式）
        signer // 添加signer参数以获取调用者地址
      );

      console.log('✅ 定时转账创建成功:', transferId);
      
      // 重置表单
      setNewTransfer({
        toAddress: '',
        tokenType: selectedDepositToken,
        amount: '',
        executeTime: ''
      });

      // 重新加载定时转账列表
      console.log('🔄 重新加载定时转账列表...');
      await loadScheduledTransfers();
      
      // 立即刷新余额显示
      console.log('🔄 刷新钱包余额...');
      await refreshWalletBalance();
      
      // 只有在transferId存在时才显示成功消息
      if (transferId) {
        console.log('✅ 定时转账创建成功，显示成功消息');
        alert(t('wallet.transfer.create.success'));
      }
    } catch (error) {
      console.error('❌ 创建定时转账失败:', error);
      
      // 提供更详细的错误信息
      const errorMessage = (error as Error).message;
      let userFriendlyMessage = '创建定时转账失败';
      
      if (errorMessage.includes('Invalid Sui address') || errorMessage.includes('地址格式错误')) {
        userFriendlyMessage = '📍 接收地址无效\n\n请检查接收地址是否为有效的Sui地址格式（0x开头的64位十六进制字符）。';
      } else if (errorMessage.includes('余额不足') || errorMessage.includes('insufficient')) {
        userFriendlyMessage = '💰 余额不足\n\n钱包中没有足够的代币来创建此定时转账，请先存入足够的代币。';
      } else if (errorMessage.includes('transaction') || errorMessage.includes('Transaction')) {
        userFriendlyMessage = '🔄 交易执行失败\n\n网络或交易出现问题，请检查网络连接后重试。\n\n详细错误: ' + errorMessage;
      } else if (errorMessage.includes('时间') || errorMessage.includes('time')) {
        userFriendlyMessage = '⏰ 时间设置错误\n\n请检查执行时间是否正确设置，确保选择未来的时间。';
      } else {
        userFriendlyMessage = '❌ 创建失败\n\n' + errorMessage;
      }
      
      alert(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const executeTransfer = async (transferId: string) => {
    if (!currentAccount || !walletInfo) {
      alert(t('wallet.create.first'));
      return;
    }

    try {
      setLoading(true);
      
      console.log('⚡ 开始执行定时转账:', { transferId, walletId: walletInfo.id });
      
      // 在执行前打印钱包当前余额
      console.log('🔍 检查钱包当前余额状态...');
      console.log('📍 钱包信息:', {
        walletId: walletInfo.id,
        balances: walletInfo.balances,
        supportedTokens: supportedTokens.map(t => ({ type: t.type, symbol: t.symbol, decimals: t.decimals }))
      });
      
      // 获取要执行的定时转账详情
      const transferDetails = scheduledTransfers.find(t => t.id === transferId);
      if (transferDetails) {
        console.log('📍 定时转账详情:', {
          transferId: transferDetails.id,
          toAddress: transferDetails.to_address,
          tokenType: transferDetails.token_type,
          amount: transferDetails.amount,
          executeTime: transferDetails.execute_time,
          isExecuted: transferDetails.is_executed
        });
        
        // 查找对应代币的精度
        const token = supportedTokens.find(t => t.type === transferDetails.token_type);
        let decimals = 9; // 默认SUI精度
        if (transferDetails.token_type.includes('USDC') || transferDetails.token_type.includes('test_coin')) {
          decimals = 6; // USDC是6位小数
        } else if (token?.decimals) {
          decimals = token.decimals;
        }
        
        // 计算转账金额（转换为人类可读格式）
        const transferAmountNum = parseFloat(transferDetails.amount) || 0;
        const formattedTransferAmount = (transferAmountNum / Math.pow(10, decimals)).toFixed(6).replace(/\.?0+$/, '');
        
        // 标准化 token_type 格式以匹配合约存储格式（移除 0x 前缀）
        const normalizeTokenType = (tokenType: string) => {
          return tokenType.startsWith('0x') ? tokenType.slice(2) : tokenType;
        };
        
        const normalizedTokenType = normalizeTokenType(transferDetails.token_type);
        
        console.log('🔍 Token类型格式调试:');
        console.log('📍 原始 token_type:', transferDetails.token_type);
        console.log('📍 标准化后:', normalizedTokenType);
        console.log('📍 钱包余额 keys:', Object.keys(walletInfo.balances));
        
        // 检查钱包中该代币的余额
        const currentBalance = walletInfo.balances[normalizedTokenType] || '0';
        const currentBalanceNum = parseFloat(currentBalance) || 0;
        const formattedCurrentBalance = (currentBalanceNum / Math.pow(10, decimals)).toFixed(6).replace(/\.?0+$/, '');
        
        console.log('📍 余额查询结果:', {
          normalizedTokenType,
          rawBalance: currentBalance,
          formattedBalance: formattedCurrentBalance
        });
        
        console.log('💰 余额检查:', {
          tokenType: transferDetails.token_type,
          tokenSymbol: token?.symbol || getTokenDisplayName(transferDetails.token_type),
          decimals,
          rawTransferAmount: transferDetails.amount,
          formattedTransferAmount,
          rawCurrentBalance: currentBalance,
          formattedCurrentBalance,
          isSufficient: currentBalanceNum >= transferAmountNum
        });
        
        // 如果余额不足，提前警告
        console.log(currentBalanceNum,transferAmountNum);
        if (currentBalanceNum < transferAmountNum) {
          console.warn('⚠️ 余额不足警告:', {
            required: formattedTransferAmount,
            available: formattedCurrentBalance,
            shortage: (formattedTransferAmount + ' - ' + formattedCurrentBalance)
          });
        } else {
          console.log('✅ 余额充足，可以执行转账');
        }
      } else {
        console.warn('⚠️ 未找到定时转账详情:', transferId);
      }
      
      // 使用新的调用方式，直接传递 signAndExecuteTransaction 函数（参考 purchaseObject 模式）
      const result = await walletService.executeScheduledTransfer(
        transferId,
        walletInfo.id,
        signAndExecuteTransaction
      );
      
      console.log('✅ 定时转账执行成功，结果:', result);
      
      // 等待一小段时间让区块链状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🔄 重新加载定时转账列表...');
      await loadScheduledTransfers();
      
      // 重新加载钱包信息以更新余额显示
      await loadWalletInfo();
      
      console.log('✅ 定时转账执行操作完成，显示成功消息');
      alert(t('wallet.transfer.execute.success'));
    } catch (error) {
      console.error('❌ 执行定时转账失败:', error);
      
      // 提供更详细的错误信息
      const errorMessage = (error as Error).message;
      let userFriendlyMessage = '执行定时转账失败';
      
      if (errorMessage.includes('5') || errorMessage.includes('E_NOT_YET_TIME')) {
        userFriendlyMessage = '⏰ 还未到执行时间\n\n请等待到预定时间后再执行转账。\n\n如果时间已过但仍显示此错误，可能是区块链时间同步延迟，请稍后重试。';
      } else if (errorMessage.includes('4') || errorMessage.includes('E_ALREADY_EXECUTED')) {
        userFriendlyMessage = '✅ 该转账已经执行过了\n\n此定时转账已完成，无需重复执行。';
      } else if (errorMessage.includes('3') || errorMessage.includes('E_TRANSFER_NOT_FOUND')) {
        userFriendlyMessage = '❌ 未找到转账记录\n\n该定时转账可能已被删除或不存在，请刷新页面后重试。';
      } else if (errorMessage.includes('2') || errorMessage.includes('E_INSUFFICIENT_BALANCE')) {
        userFriendlyMessage = '💰 余额不足\n\n钱包中没有足够的代币来执行此转账，请先存入足够的代币。';
      } else if (errorMessage.includes('1') || errorMessage.includes('E_UNAUTHORIZED')) {
        userFriendlyMessage = '🔒 权限不足\n\n您没有权限执行此转账，请确认您是钱包的所有者。';
      } else if (errorMessage.includes('transaction') || errorMessage.includes('Transaction')) {
        userFriendlyMessage = '🔄 交易执行失败\n\n网络或交易出现问题，请检查网络连接后重试。\n\n详细错误: ' + errorMessage;
      } else {
        userFriendlyMessage = '❌ 执行失败\n\n' + errorMessage;
      }
      
      alert(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const cancelTransfer = async (transferId: string) => {
    if (!currentAccount || !walletInfo) {
      alert(t('wallet.create.first'));
      return;
    }

    // 确认取消操作
    const confirmed = window.confirm(
      t('wallet.transfer.cancel.confirm')
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      
      // 获取用户地址
      let userAddress: string;
      if (typeof currentAccount === 'string') {
        userAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        userAddress = currentAccount.address;
      } else {
        throw new Error('钱包地址无效，请重新连接钱包');
      }
      
      console.log('❌ 取消定时转账:', { transferId });

      await walletService.cancelScheduledTransfer(
        transferId,
        signAndExecuteTransaction // 直接传递 signAndExecuteTransaction 函数（参考其他方法模式）
      );

      console.log('✅ 定时转账取消成功');
      
      // 重新加载定时转账列表
      await loadScheduledTransfers();
      
      // 重新加载钱包信息以更新余额显示（如果转账被取消，资金应该被释放）
      await loadWalletInfo();
      
      alert(t('wallet.transfer.cancel.success'));
    } catch (error) {
      console.error('❌ 取消定时转账失败:', error);
      
      // 提供更详细的错误信息
      const errorMessage = (error as Error).message;
      let userFriendlyMessage = '取消定时转账失败';
      
      if (errorMessage.includes('8') || errorMessage.includes('E_UNAUTHORIZED')) {
        userFriendlyMessage = '🔒 权限不足\n\n只有定时转账的创建者才能取消转账。\n\n请确认您是此转账的创建者。';
      } else if (errorMessage.includes('9') || errorMessage.includes('E_ALREADY_EXECUTED')) {
        userFriendlyMessage = '✅ 该转账已经执行\n\n已执行的转账无法取消，因为转账已经完成。';
      } else if (errorMessage.includes('3') || errorMessage.includes('E_TRANSFER_NOT_FOUND')) {
        userFriendlyMessage = '❌ 未找到转账记录\n\n该定时转账可能已被删除或不存在，请刷新页面后重试。';
      } else if (errorMessage.includes('transaction') || errorMessage.includes('Transaction')) {
        userFriendlyMessage = '🔄 交易执行失败\n\n网络或交易出现问题，请检查网络连接后重试。\n\n详细错误: ' + errorMessage;
      } else {
        userFriendlyMessage = '❌ 取消失败\n\n' + errorMessage;
      }
      
      alert(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshWalletBalance = async () => {
    if (!walletInfo) return;
    
    try {
      console.log('🔄 刷新钱包余额...');
      
      // 等待一小段时间让区块链状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 尝试多次获取最新的钱包信息，确保余额更新
      let updatedInfo = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries && !updatedInfo) {
        try {
          console.log(`🔄 尝试获取钱包信息 (第 ${retryCount + 1} 次)...`);
          updatedInfo = await walletService.getWalletInfo(walletInfo.id);
          
          if (updatedInfo) {
            console.log('✅ 钱包余额刷新成功:', updatedInfo.balances);
            setWalletInfo(updatedInfo);
            break;
          }
        } catch (retryError) {
          console.warn(`⚠️ 第 ${retryCount + 1} 次尝试失败:`, retryError);
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          // 等待更长时间再重试
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!updatedInfo) {
        console.warn('⚠️ 多次尝试后仍无法获取最新的钱包信息');
        // 最后一次尝试，使用完整的 loadWalletInfo
        await loadWalletInfo();
      }
    } catch (error) {
      console.error('❌ 刷新钱包余额失败:', error);
      // 如果刷新失败，尝试完整的重新加载
      try {
        console.log('🔄 回退到完整的钱包信息重新加载...');
        await loadWalletInfo();
      } catch (fallbackError) {
        console.error('❌ 回退加载也失败:', fallbackError);
      }
    }
  };

  const loadScheduledTransfers = async () => {
    try {
      console.log('🔍 加载定时转账列表...');
      const transfers = await walletService.getObjectScheduledTransfers(objectId);
      console.log('📍 定时转账列表:', transfers);
      setScheduledTransfers(transfers);
    } catch (error) {
      console.error('Failed to load scheduled transfers:', error);
    }
  };

  const mergeUserCoins = async (tokenType: string) => {
    if (!currentAccount) {
      alert(t('common.connect.wallet'));
      return;
    }

    try {
      setLoading(true);
      
      // 获取用户地址
      let userAddress: string;
      if (typeof currentAccount === 'string') {
        userAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        userAddress = currentAccount.address;
      } else {
        throw new Error('钱包地址无效，请重新连接钱包');
      }

      console.log('🔗 开始整理代币:', { tokenType, userAddress });

      // 获取用户的代币对象列表
      const userCoins = await walletService.getUserCoins(userAddress, tokenType);
      console.log('📍 用户代币对象列表:', userCoins);

      if (userCoins.length <= 1) {
        alert(t('wallet.merge.no.fragments'));
        return;
      }

      // 调用完整的合并代币功能，传递用户地址
      await walletService.mergeCoins(tokenType, signAndExecuteTransaction, userAddress);
      
      alert(t('wallet.merge.success'));
      
      // 刷新钱包信息以显示更新后的状态
      setTimeout(() => {
        loadWalletInfo();
      }, 2000);
      
    } catch (error) {
      console.error('❌ 整理代币失败:', error);
      alert(t('wallet.merge.failed') + ': ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number | string) => {
    console.log('🕐 格式化时间戳:', { timestamp, type: typeof timestamp });
    
    // 处理字符串类型的时间戳
    let numTimestamp: number;
    if (typeof timestamp === 'string') {
      numTimestamp = parseInt(timestamp, 10);
      if (isNaN(numTimestamp)) {
        console.error('❌ 无效的时间戳字符串:', timestamp);
        return '无效时间戳';
      }
    } else {
      numTimestamp = timestamp;
    }
    
    // 如果时间戳为0或无效，返回默认值
    if (numTimestamp === 0) {
      console.log('🕐 时间戳为0，可能是新创建的对象');
      return '刚刚创建';
    }
    
    // 如果时间戳看起来像秒级（小于10^12），转换为毫秒
    // 但要排除一些特殊情况
    let msTimestamp: number;
    if (numTimestamp < 1000000000000 && numTimestamp > 1000000000) {
      // 看起来像秒级时间戳（2021年左右到现在）
      msTimestamp = numTimestamp * 1000;
    } else if (numTimestamp >= 1000000000000) {
      // 已经是毫秒级时间戳
      msTimestamp = numTimestamp;
    } else {
      // 太小的时间戳，可能是其他单位
      console.warn('⚠️ 时间戳异常小:', numTimestamp);
      return '时间戳异常';
    }
    
    console.log('🕐 转换后的毫秒时间戳:', msTimestamp);
    
    const date = new Date(msTimestamp);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.error('❌ 无效的日期:', { msTimestamp, date });
      return '无效日期';
    }
    
    // 检查日期是否合理（不能是1970年）
    if (date.getFullYear() < 2000) {
      console.warn('⚠️ 日期过于久远:', date);
      return '时间戳异常';
    }
    
    const formatted = date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    console.log('🕐 格式化后的日期:', formatted);
    
    return formatted;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  // 诊断钱包状态
  const diagnoseWalletStatus = async () => {
    if (!objectId) {
      alert('对象ID无效');
      return;
    }

    try {
      console.log('🔍 开始诊断钱包状态...');
      
      // 获取对象信息
      const objectResult = await getSuiClient().getObject({
        id: objectId,
        options: { showContent: true }
      });

      if (!objectResult.data?.content) {
        alert('对象不存在或无法获取对象信息');
        return;
      }

      const objectContent = objectResult.data.content as any;
      const objectOwner = objectContent.fields?.owner;
      const walletId = objectContent.fields?.wallet_id;

      console.log('📍 对象诊断信息:', {
        objectId,
        objectOwner,
        walletId,
        hasWallet: !!walletId
      });

      let diagnosisInfo = `=== 钱包状态诊断 ===\n\n`;
      diagnosisInfo += `对象ID: ${objectId}\n`;
      diagnosisInfo += `对象所有者: ${objectOwner || '未知'}\n`;
      diagnosisInfo += `钱包ID: ${walletId || '无'}\n`;
      diagnosisInfo += `钱包状态: ${walletId ? '已创建' : '未创建'}\n\n`;

      if (walletId) {
        // 获取钱包详细信息
        try {
          const walletInfo = await walletService.getWalletInfo(walletId);
          if (walletInfo) {
            diagnosisInfo += `=== 钱包详细信息 ===\n`;
            diagnosisInfo += `钱包ID: ${walletInfo.id}\n`;
            diagnosisInfo += `关联对象ID: ${walletInfo.object_id}\n`;
            diagnosisInfo += `钱包所有者: ${walletInfo.owner}\n`;
            diagnosisInfo += `创建时间: ${new Date(walletInfo.created_at).toLocaleString()}\n`;
            diagnosisInfo += `余额类型数: ${Object.keys(walletInfo.balances).length}\n\n`;

            // 检查所有权一致性
            if (objectOwner === walletInfo.owner) {
              diagnosisInfo += `✅ 所有权一致: 对象所有者与钱包所有者匹配\n`;
            } else {
              diagnosisInfo += `❌ 所有权不一致: 对象所有者(${objectOwner}) ≠ 钱包所有者(${walletInfo.owner})\n`;
            }

            // 检查零地址
            if (walletInfo.owner === '0x0000000000000000000000000000000000000000000000000000000000000000') {
              diagnosisInfo += `❌ 钱包所有者异常: 检测到零地址所有者\n`;
              diagnosisInfo += `建议: 重新创建钱包\n`;
            } else {
              diagnosisInfo += `✅ 钱包所有者正常\n`;
            }

            // 显示余额信息
            if (Object.keys(walletInfo.balances).length > 0) {
              diagnosisInfo += `\n=== 余额信息 ===\n`;
              Object.entries(walletInfo.balances).forEach(([tokenType, balance]) => {
                diagnosisInfo += `${tokenType}: ${balance}\n`;
              });
            } else {
              diagnosisInfo += `\n钱包余额为空\n`;
            }
          } else {
            diagnosisInfo += `❌ 无法获取钱包信息\n`;
          }
        } catch (walletError) {
          diagnosisInfo += `❌ 获取钱包信息失败: ${(walletError as Error).message}\n`;
        }
      } else {
        diagnosisInfo += `建议: 点击"创建钱包"按钮为对象创建钱包\n`;
      }

      // 检查当前用户权限
      let currentUserAddress = '';
      if (typeof currentAccount === 'string') {
        currentUserAddress = currentAccount;
      } else if (currentAccount && typeof currentAccount.address === 'string') {
        currentUserAddress = currentAccount.address;
      }

      if (currentUserAddress) {
        diagnosisInfo += `\n=== 用户权限检查 ===\n`;
        diagnosisInfo += `当前用户地址: ${currentUserAddress}\n`;
        
        if (objectOwner === currentUserAddress) {
          diagnosisInfo += `✅ 权限正常: 您是对象的所有者\n`;
        } else {
          diagnosisInfo += `❌ 权限不足: 您不是对象的所有者\n`;
          diagnosisInfo += `对象所有者: ${objectOwner}\n`;
          diagnosisInfo += `您的地址: ${currentUserAddress}\n`;
        }
      } else {
        diagnosisInfo += `\n❌ 未检测到用户钱包连接\n`;
      }

      console.log('📍 诊断完成:', diagnosisInfo);
      alert(diagnosisInfo);

    } catch (error) {
      console.error('❌ 诊断失败:', error);
      alert(`诊断失败: ${(error as Error).message}`);
    }
  };

  if (!hasWallet) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{t('wallet.title')}</h3>
          <button
            onClick={diagnoseWalletStatus}
            disabled={loading}
            className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm"
          >
            🔍 诊断状态
          </button>
        </div>
        <p className="text-gray-600 mb-4">{t('wallet.no.wallet')}</p>
        
        <button
          onClick={createWallet}
          disabled={loading}
          className="bg-blue-500 text-black px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{t('wallet.creating')}</span>
            </div>
          ) : (
            t('wallet.create.button')
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">{t('wallet.title')}</h3>
      
      {walletInfo && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-gray-600">{t('wallet.id')}</span>
              <p className="text-sm font-mono break-all">{walletInfo.id}</p>
            </div>
            <div>
              <span className="text-gray-600">{t('wallet.created.at')}</span>
              <p>{formatDate(walletInfo.created_at)}</p>
            </div>
          </div>
          
          <div className="mb-4">
            <span className="text-gray-600 font-medium">{t('wallet.balance')}</span>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {Object.entries(walletInfo.balances).map(([tokenType, balance]) => {
                const token = supportedTokens.find(t => t.type === tokenType);
                const symbol = token?.symbol || getTokenDisplayName(tokenType);
                
                // 获取正确的代币精度
                let decimals = 9; // 默认SUI精度
                if (tokenType.includes('USDC') || tokenType.includes('test_coin')) {
                  decimals = 6; // USDC是6位小数
                } else if (token?.decimals) {
                  decimals = token.decimals;
                }
                
                console.log('🔢 计算余额:', {
                  tokenType,
                  rawBalance: balance,
                  decimals,
                  symbol
                });
                
                // 确保余额是正数并且正确计算
                const balanceNum = parseFloat(balance) || 0;
                const formattedBalance = Math.abs(balanceNum / Math.pow(10, decimals)).toFixed(6).replace(/\.?0+$/, '');
                
                return (
                  <div key={tokenType} className="bg-gray-50 rounded p-2 border border-gray-200 group relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {token?.icon && (
                          <span className="text-xl">{token.icon}</span>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-base text-gray-900">
                          {formattedBalance}
                        </div>
                        <div className="text-xs text-gray-500">
                          {symbol}
                        </div>
                      </div>
                    </div>
                    
                    {/* Tooltip - 鼠标悬停时显示代币类型 */}
                    <div className="absolute left-0 right-0 -bottom-2 transform translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 mb-2">
                      <div className="bg-gray-900 text-white text-xs rounded p-2 mx-auto max-w-xs">
                        <div className="font-mono break-all">
                          {tokenType}
                        </div>
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(walletInfo.balances).length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-4xl mb-2">💰</div>
                  <div className="font-medium">{t('wallet.no.balance')}</div>
                  <div className="text-sm mt-1">{t('wallet.no.balance.desc')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 代币操作 */}
      <div className="border-t pt-4 mb-6">
        <h4 className="font-semibold mb-3">{t('wallet.token.operations')}</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 存入 */}
          <div>
            <h5 className="text-sm font-medium mb-2">{t('wallet.deposit')}</h5>
            <div className="space-y-2">
              <select
                value={selectedDepositToken}
                onChange={(e) => setSelectedDepositToken(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                {supportedTokens.map((token) => (
                  <option key={token.type} value={token.type}>
                    {token.icon} {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={t('wallet.amount')}
                  className="flex-1 px-3 py-2 border rounded"
                />
                <button
                  onClick={depositToken}
                  className="bg-green-500 text-black px-4 py-2 rounded hover:bg-green-600"
                >
                  {t('wallet.deposit.button')}
                </button>
              </div>
            </div>
          </div>

          {/* 提取 */}
          <div>
            <h5 className="text-sm font-medium mb-2">{t('wallet.withdraw')}</h5>
            <div className="space-y-2">
              <select
                value={selectedWithdrawToken}
                onChange={(e) => setSelectedWithdrawToken(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                {supportedTokens.map((token) => (
                  <option key={token.type} value={token.type}>
                    {token.icon} {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={t('wallet.amount')}
                  className="flex-1 px-3 py-2 border rounded"
                />
                <button
                  onClick={withdrawToken}
                  className="bg-red-500 text-black px-4 py-2 rounded hover:bg-red-600"
                >
                  {t('wallet.withdraw.button')}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 定时转账 */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold">{t('wallet.scheduled.transfers')}</h4>
          <button
            onClick={async () => {
              console.log('🔄 手动刷新定时转账和余额...');
              setLoading(true);
              try {
                await loadScheduledTransfers();
                await refreshWalletBalance();
                console.log('✅ 手动刷新完成');
              } catch (error) {
                console.error('❌ 手动刷新失败:', error);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-gray-500 text-blace px-3 py-1 rounded hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            🔄 {t('wallet.transfer.refresh')}
          </button>
        </div>
        
        {/* 创建新转账 */}
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <h5 className="text-sm font-medium mb-2">{t('wallet.create.transfer')}</h5>
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="text"
                value={newTransfer.toAddress}
                onChange={(e) => setNewTransfer({...newTransfer, toAddress: e.target.value})}
                placeholder={t('wallet.to.address')}
                className="px-3 py-2 border rounded"
              />
              <select
                value={newTransfer.tokenType}
                onChange={(e) => setNewTransfer({...newTransfer, tokenType: e.target.value})}
                className="px-3 py-2 border rounded"
              >
                {supportedTokens.map((token) => (
                  <option key={token.type} value={token.type}>
                    {token.icon} {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="number"
                value={newTransfer.amount}
                onChange={(e) => setNewTransfer({...newTransfer, amount: e.target.value})}
                placeholder={t('wallet.amount')}
                className="px-3 py-2 border rounded"
              />
              <input
                type="datetime-local"
                value={newTransfer.executeTime}
                onChange={(e) => setNewTransfer({...newTransfer, executeTime: e.target.value})}
                className="px-3 py-2 border rounded"
              />
              <button
                onClick={createScheduledTransfer}
                className="bg-blue-500 text-black px-4 py-2 rounded hover:bg-blue-600"
              >
                {t('wallet.create.transfer.button')}
              </button>
            </div>
          </div>
        </div>

        {/* 转账列表 */}
        <div>
          {scheduledTransfers.length === 0 ? (
            <p className="text-gray-500">{t('wallet.no.transfers')}</p>
          ) : (
            <div className="space-y-2">
              {scheduledTransfers.map((transfer) => (
                <div key={transfer.id} className="border rounded p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{t('wallet.transfer.to')}</span> {transfer.to_address}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{t('wallet.transfer.amount')}</span> {
                          (() => {
                            const token = supportedTokens.find(t => t.type === transfer.token_type);
                            let decimals = 9; // 默认SUI精度
                            if (transfer.token_type.includes('USDC') || transfer.token_type.includes('test_coin')) {
                              decimals = 6; // USDC是6位小数
                            } else if (token?.decimals) {
                              decimals = token.decimals;
                            }
                            
                            const amountNum = parseFloat(transfer.amount) || 0;
                            const formattedAmount = (amountNum / Math.pow(10, decimals)).toFixed(6).replace(/\.?0+$/, '');
                            const symbol = token?.symbol || getTokenDisplayName(transfer.token_type);
                            
                            return `${formattedAmount} ${symbol}`;
                          })()
                        }
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{t('wallet.transfer.execute.time')}</span> {formatDate(transfer.execute_time)}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{t('wallet.transfer.status')}</span> 
                        <span className={`ml-1 ${transfer.is_executed ? 'text-green-600' : 'text-orange-600'}`}>
                          {transfer.is_executed ? t('wallet.transfer.executed') : t('wallet.transfer.pending')}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">代币类型:</span> 
                        <span className="ml-1 text-blue-600 font-mono text-xs">
                          {transfer.token_type}
                        </span>
                      </div>
                    </div>
                  {!transfer.is_executed && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => executeTransfer(transfer.id)}
                        className="px-3 py-1 bg-green-500 text-black rounded hover:bg-green-600 transition-colors text-sm"
                      >
                        {t('wallet.execute')}
                      </button>
                      <button
                        onClick={() => cancelTransfer(transfer.id)}
                        className="px-3 py-1 bg-red-500 text-black rounded hover:bg-red-600 transition-colors text-sm"
                      >
                        {t('wallet.cancel')}
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObjectWallet;
