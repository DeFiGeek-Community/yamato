import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetworkConfig, type NetworkName } from '../../config/networks.js';

export interface Clients {
  publicClient: PublicClient;
  walletClient: WalletClient;
}

/**
 * viem clientsを作成
 */
export function createClients(network: NetworkName): Clients {
  const config = getNetworkConfig(network);

  // Private keyの確認
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not set in .env');
  }

  // アカウント作成
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  // Public client作成
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  }) as PublicClient;

  // Wallet client作成
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  console.log(`📡 Connected to ${network}`);
  console.log(`👤 Account: ${account.address}\n`);

  // WalletClient型に明示的にキャスト
  return {
    publicClient,
    walletClient: walletClient as WalletClient,
  };
}

