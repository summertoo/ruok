import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { networkConfig } from './config/networkConfig';

const queryClient = new QueryClient();

const networks = {
  testnet: { url: networkConfig.testnet.url },
  mainnet: { url: networkConfig.mainnet.url },
  devnet: { url: networkConfig.devnet.url },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}