import React, { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { getCurrentConfig } from '../config/tokenConfig';
import { useLanguage } from '../contexts/LanguageContext';

interface TestTokenActionsProps {
  onBalanceUpdate?: () => void;
}

const TestTokenActions: React.FC<TestTokenActionsProps> = ({ onBalanceUpdate }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [mintAmount, setMintAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const config = getCurrentConfig();

  const handleMint = async () => {
    if (!currentAccount) {
      setError(t('testToken.connectWalletFirst'));
      return;
    }

    if (!mintAmount || Number(mintAmount) <= 0) {
      setError(t('testToken.enterValidAmount'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const tx = new Transaction();
      const amountInSmallestUnit = Number(mintAmount) * 1_000_000; // USDC 有 6 位小数

      tx.moveCall({
        target: `${config.PACKAGE_ID}::test_coin::mint_usdc`,
        arguments: [
          tx.object(config.USDC_TREASURY_CAP),
          tx.pure.u64(amountInSmallestUnit),
          tx.pure.address(currentAccount.address),
        ],
      });

      signAndExecuteTransaction(
        {
          transaction: tx as any,
        },
        {
          onSuccess: () => {
            setSuccess(t('testToken.mintSuccess', { amount: mintAmount }));
            setMintAmount('');
            if (onBalanceUpdate) {
              onBalanceUpdate();
            }
          },
          onError: (err: Error) => {
            setError(t('testToken.mintFailed') + ': ' + err.message);
          },
        }
      );
    } catch (err) {
      setError(t('testToken.mintFailed') + ': ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentAccount) {
    return null;
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
      <h3 className="text-white text-lg font-semibold mb-4">{t('testToken.title')}</h3>
      
      {/* 错误和成功消息 */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-3 py-2 rounded mb-3 text-sm">
          {success}
        </div>
      )}

      {/* 铸造操作 */}
      <div className="space-y-3">
        <div>
          <label className="text-white/70 text-sm block mb-1">{t('testToken.mintAmount')}</label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              placeholder={t('testToken.enterMintAmount')}
              className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              disabled={loading}
            />
            <button
              onClick={handleMint}
              disabled={loading || !mintAmount || Number(mintAmount) <= 0}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded transition-colors disabled:cursor-not-allowed"
            >
              {loading ? t('testToken.minting') : t('testToken.mint')}
            </button>
          </div>
        </div>

        <div className="text-white/50 text-xs">
          <p>💡 {t('testToken.testNetWarning')}</p>
          <p>{t('testToken.contractAddress')}: {config.PACKAGE_ID}</p>
        </div>
      </div>
    </div>
  );
};

export default TestTokenActions;
