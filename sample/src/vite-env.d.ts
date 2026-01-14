/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUI_NETWORK: string
  readonly VITE_SUI_RPC_URL: string
  readonly VITE_USDC_TYPE: string
  readonly VITE_USDC_DECIMALS: string
  readonly VITE_WALRUS_ENDPOINT: string
  readonly VITE_WALRUS_PUBLISHER_ENDPOINT: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_DESCRIPTION: string
  readonly VITE_ENABLE_WALRUS: string
  readonly VITE_ENABLE_AUTO_TRADING: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_DEBUG_MODE: string
  readonly VITE_LOG_LEVEL: string
  readonly VITE_TESTNET_PACKAGE_ID: string
  readonly VITE_TESTNET_MARKETPLACE_ID: string
  readonly VITE_TESTNET_ADMIN_ADDRESS: string
  readonly VITE_MAINNET_PACKAGE_ID: string
  readonly VITE_MAINNET_MARKETPLACE_ID: string
  readonly VITE_MAINNET_ADMIN_ADDRESS: string
  readonly VITE_DEVNET_PACKAGE_ID: string
  readonly VITE_DEVNET_MARKETPLACE_ID: string
  readonly VITE_DEVNET_ADMIN_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
