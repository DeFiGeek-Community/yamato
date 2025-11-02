import {
  type Address,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
} from 'viem';
import { saveAddress } from './address-manager.js';
import type { NetworkName } from '../../config/networks.js';

export interface DeployUUPSParams {
  name: string;
  implementation: {
    abi: any;
    bytecode: `0x${string}`;
    args?: any[];
  };
  proxy: {
    initFunction?: string;  // デフォルト: 'initialize'
    initArgs: any[];
  };
  proxyAbi: any;
  proxyBytecode: `0x${string}`;
  walletClient: WalletClient;
  publicClient: PublicClient;
  network: NetworkName;
}

export interface DeployUUPSResult {
  implAddress: Address;
  proxyAddress: Address;
}

/**
 * UUPSプロキシパターンでコントラクトをデプロイ
 */
export async function deployUUPS(params: DeployUUPSParams): Promise<DeployUUPSResult> {
  console.log(`\n🚀 Deploying ${params.name}...`);

  // 1. 実装コントラクトのデプロイ
  console.log(`  📦 Deploying implementation...`);
  const implHash = await params.walletClient.deployContract({
    abi: params.implementation.abi,
    bytecode: params.implementation.bytecode,
    args: params.implementation.args || [],
  });

  const implReceipt = await params.publicClient.waitForTransactionReceipt({
    hash: implHash,
  });

  if (!implReceipt.contractAddress) {
    throw new Error('Implementation deployment failed: no contract address');
  }

  const implAddress = implReceipt.contractAddress;
  console.log(`  ✅ Implementation deployed: ${implAddress}`);

  // 2. 初期化データのエンコード
  const initFunctionName = params.proxy.initFunction || 'initialize';
  console.log(`  🔧 Encoding init data (function: ${initFunctionName})...`);

  const initData = encodeFunctionData({
    abi: params.implementation.abi,
    functionName: initFunctionName,
    args: params.proxy.initArgs,
  });

  // 3. プロキシコントラクトのデプロイ
  console.log(`  📦 Deploying proxy...`);
  const proxyHash = await params.walletClient.deployContract({
    abi: params.proxyAbi,
    bytecode: params.proxyBytecode,
    args: [implAddress, initData],
  });

  const proxyReceipt = await params.publicClient.waitForTransactionReceipt({
    hash: proxyHash,
  });

  if (!proxyReceipt.contractAddress) {
    throw new Error('Proxy deployment failed: no contract address');
  }

  const proxyAddress = proxyReceipt.contractAddress;
  console.log(`  ✅ Proxy deployed: ${proxyAddress}`);

  // 4. アドレスの保存
  saveAddress(params.network, `${params.name}UUPSImpl`, implAddress);
  saveAddress(params.network, `${params.name}ERC1967Proxy`, proxyAddress);

  console.log(`✅ ${params.name} deployment complete!\n`);

  return { implAddress, proxyAddress };
}

