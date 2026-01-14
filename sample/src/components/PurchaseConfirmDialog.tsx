import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface TradingObject {
  id: string;
  owner: string;
  bot: string;
  emoji: string;
  profile_picture: string;
  blob_id: string;
  price: number;
  is_for_sale: boolean;
  token_type?: string;
}

interface SupportedToken {
  type: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PurchaseConfirmDialogProps {
  isOpen: boolean;
  object: TradingObject | null;
  token: SupportedToken | null;
  userBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

const PurchaseConfirmDialog: React.FC<PurchaseConfirmDialogProps> = ({
  isOpen,
  object,
  token,
  userBalance,
  onConfirm,
  onCancel,
  isConfirming = false
}) => {
  const { t } = useLanguage();
  
  if (!isOpen || !object || !token) {
    return null;
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const hasEnoughBalance = userBalance >= object.price;
  const balanceShortage = object.price - userBalance;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('confirm.title')}</h2>
          <p className="text-sm text-gray-600">{t('confirm.subtitle')}</p>
        </div>

        {/* 对象信息 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <img 
              src={object.profile_picture} 
              alt={object.bot}
              className="w-12 h-12 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/48x48?text=No+Image';
              }}
            />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{object.bot}</h3>
              <p className="text-sm text-gray-500">{t('confirm.owner')} {formatAddress(object.owner)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  {t('confirm.forSale')}
                </span>
                <span className="text-xs text-gray-500">
                  {t('confirm.blobId')} {object.blob_id.length > 12 ? `${object.blob_id.substring(0, 12)}...` : object.blob_id}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 价格信息 */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{t('confirm.purchasePrice')}</span>
            <span className="text-lg font-bold text-blue-600">
              {object.price} {token.symbol}
            </span>
          </div>
          
          {/* 手续费信息 */}
          <div className="border-t border-blue-100 pt-2 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{t('confirm.fee')}</span>
              <span className="text-green-600 font-medium">0 {token.symbol}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600">{t('confirm.total')}</span>
              <span className="font-bold text-blue-600">
                {object.price} {token.symbol}
              </span>
            </div>
          </div>
        </div>

        {/* 余额信息 */}
        <div className={`rounded-lg p-4 mb-4 ${
          hasEnoughBalance ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">{t('confirm.yourBalance')}</span>
            <span className={`font-bold ${
              hasEnoughBalance ? 'text-green-600' : 'text-red-600'
            }`}>
              {userBalance} {token.symbol}
            </span>
          </div>
          
          {!hasEnoughBalance && (
            <div className="mt-2 text-sm text-red-600">
              <p>{t('confirm.insufficientBalance', { amount: balanceShortage, symbol: token.symbol })}</p>
              <p className="text-xs mt-1">{t('confirm.getMoreTokens', { symbol: token.symbol })}</p>
            </div>
          )}
        </div>

        {/* 注意事项 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-700">
              <p className="font-medium mb-1">{t('confirm.notice')}</p>
              <ul className="text-xs space-y-1">
                <li>{t('confirm.notice1')}</li>
                <li>{t('confirm.notice2')}</li>
                <li>{t('confirm.notice3')}</li>
                <li>{t('confirm.notice4')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('confirm.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasEnoughBalance || isConfirming}
            className={`flex-1 px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              hasEnoughBalance 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isConfirming ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                {t('confirm.confirming')}
              </div>
            ) : (
              t('confirm.buy')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseConfirmDialog;
