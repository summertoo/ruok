import React from 'react';
import { networkConfig } from '../config/networkConfig';
import type { NetworkType } from '../config/networkConfig';

interface NetworkSelectorProps {
  currentNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  currentNetwork,
  onNetworkChange,
}) => {
  const getNetworkColor = (network: NetworkType) => {
    switch (network) {
      case 'mainnet':
        return 'bg-green-500';
      case 'testnet':
        return 'bg-yellow-500';
      case 'devnet':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <select
        value={currentNetwork}
        onChange={(e) => onNetworkChange(e.target.value as NetworkType)}
        className="block px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
      >
        {Object.entries(networkConfig).map(([key, config]) => (
          <option key={key} value={key}>
            {config.name} ({config.description})
          </option>
        ))}
      </select>
      <div
        className={`w-2.5 h-2.5 rounded-full ${getNetworkColor(currentNetwork)}`}
        title={`当前网络: ${currentNetwork}`}
      />
    </div>
  );
};