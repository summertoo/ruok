import React from 'react';
import { NetworkType, networkConfig } from '../config/networkConfig';
import { useLanguage } from '../contexts/LanguageContext';

interface NetworkSelectorProps {
  currentNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  disabled?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  currentNetwork,
  onNetworkChange,
  disabled = false
}) => {
  const { t } = useLanguage();

  const getNetworkDisplayName = (network: NetworkType) => {
    // 网络名称保持英文，不进行翻译
    return network;
  };

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="network-select" className="text-sm font-medium text-gray-700">
        {t('network.label')}:
      </label>
      <select
        id="network-select"
        value={currentNetwork}
        onChange={(e) => onNetworkChange(e.target.value as NetworkType)}
        disabled={disabled}
        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {Object.entries(networkConfig).map(([key, config]) => (
          <option key={key} value={key}>
            {getNetworkDisplayName(key as NetworkType)}
          </option>
        ))}
      </select>
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${
          currentNetwork === 'mainnet' ? 'bg-green-500' :
          currentNetwork === 'testnet' ? 'bg-yellow-500' :
          'bg-blue-500'
        }`}></div>

      </div>
    </div>
  );
};
