import type { Address, WalletClient, PublicClient } from 'viem';
import { saveAddress } from './address-manager.js';
import type { NetworkName } from '../../config/networks.js';

export interface DeployContractParams {
  name: string;
  abi: any;
  bytecode: `0x${string}`;
  args?: any[];
  walletClient: WalletClient;
  publicClient: PublicClient;
  network: NetworkName;
}

/**
 * 通常のコントラクトをデプロイ
 */
export async function deployContract(params: DeployContractParams): Promise<Address> {
  console.log(`\n🚀 Deploying ${params.name}...`);

  const hash = await params.walletClient.deployContract({
    abi: params.abi,
    bytecode: params.bytecode,
    args: params.args || [],
  });

  console.log(`  📝 Transaction hash: ${hash}`);

  const receipt = await params.publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error(`${params.name} deployment failed: no contract address`);
  }

  const address = receipt.contractAddress;
  console.log(`  ✅ Deployed at: ${address}`);

  // アドレスを保存
  saveAddress(params.network, params.name, address);

  console.log(`✅ ${params.name} deployment complete!\n`);

  return address;
}

