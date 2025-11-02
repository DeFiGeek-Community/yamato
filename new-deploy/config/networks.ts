import { Chain, sepolia, mainnet } from 'viem/chains';

export type NetworkName = 'sepolia' | 'mainnet' | 'localhost';

export interface NetworkConfig {
  chain: Chain;
  rpcUrl: string;
  chainId: number;
  safeAddress?: string;
}

// Anvilのデフォルトチェーン設定（chainId: 31337）
const anvilChain: Chain = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
};

export function getNetworkConfig(network: NetworkName): NetworkConfig {
  const configs: Record<NetworkName, NetworkConfig> = {
    sepolia: {
      chain: sepolia,
      rpcUrl: process.env.SEPOLIA_RPC_URL || '',
      chainId: parseInt(process.env.SEPOLIA_CHAIN_ID || '11155111'),
      safeAddress: process.env.SAFE_ADDRESS_SEPOLIA,
    },
    mainnet: {
      chain: mainnet,
      rpcUrl: process.env.MAINNET_RPC_URL || '',
      chainId: parseInt(process.env.MAINNET_CHAIN_ID || '1'),
      safeAddress: process.env.SAFE_ADDRESS_MAINNET,
    },
    localhost: {
      chain: anvilChain,
      rpcUrl: process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545',
      chainId: parseInt(process.env.LOCALHOST_CHAIN_ID || '31337'),
    },
  };

  const config = configs[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }

  if (!config.rpcUrl) {
    throw new Error(`RPC URL not set for network: ${network}`);
  }

  return config;
}

