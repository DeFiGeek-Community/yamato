import type { Address, WalletClient, PublicClient } from 'viem';
import { encodeFunctionData } from 'viem';
import { saveAddress } from './address-manager.js';
import { linkLibrariesByName } from './library-linker.js';

export interface DeployUUPSWithLibrariesParams {
  name: string;
  implementation: {
    abi: any;
    bytecode: `0x${string}`;
    args?: any[];
    libraries?: Record<string, Address>; // ライブラリ名 -> アドレスのマッピング
  };
  proxy: {
    initFunction?: string;
    initArgs: any[];
  };
  proxyAbi: any;
  proxyBytecode: `0x${string}`;
  walletClient: WalletClient;
  publicClient: PublicClient;
  network: string;
}

/**
 * ライブラリリンクをサポートしたUUPSプロキシのデプロイ
 */
export async function deployUUPSWithLibraries(
  params: DeployUUPSWithLibrariesParams
): Promise<{ implAddress: Address; proxyAddress: Address }> {
  const {
    name,
    implementation,
    proxy,
    proxyAbi,
    proxyBytecode,
    walletClient,
    publicClient,
    network,
  } = params;

  console.log(`\n🚀 Deploying ${name}...`);

  // 1. バイトコードをライブラリとリンク
  let linkedBytecode = implementation.bytecode;
  
  if (implementation.libraries && Object.keys(implementation.libraries).length > 0) {
    console.log('  🔗 Linking libraries...');
    for (const [libName, libAddress] of Object.entries(implementation.libraries)) {
      console.log(`     ${libName}: ${libAddress}`);
    }
    linkedBytecode = linkLibrariesByName(implementation.bytecode, implementation.libraries);
    console.log('  ✅ Libraries linked');
  }

  // 2. 実装コントラクトのデプロイ
  console.log('  📦 Deploying implementation...');
  const implHash = await walletClient.deployContract({
    abi: implementation.abi,
    bytecode: linkedBytecode,
    args: implementation.args || [],
  });

  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
  const implAddress = implReceipt.contractAddress!;
  console.log(`  ✅ Implementation deployed: ${implAddress}`);

  // 3. 初期化データのエンコード
  console.log(`  🔧 Encoding init data (function: ${proxy.initFunction || 'initialize'})...`);
  const initData = encodeFunctionData({
    abi: implementation.abi,
    functionName: proxy.initFunction || 'initialize',
    args: proxy.initArgs,
  });

  // 4. プロキシコントラクトのデプロイ
  console.log('  📦 Deploying proxy...');
  const proxyHash = await walletClient.deployContract({
    abi: proxyAbi,
    bytecode: proxyBytecode,
    args: [implAddress, initData],
  });

  const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  const proxyAddress = proxyReceipt.contractAddress!;
  console.log(`  ✅ Proxy deployed: ${proxyAddress}`);

  // 5. アドレスの保存
  await saveAddress(network, `${name}UUPSImpl`, implAddress);
  await saveAddress(network, `${name}ERC1967Proxy`, proxyAddress);
  console.log(`✅ ${name} deployment complete!\n`);

  // 6. 結果を返す
  return { implAddress, proxyAddress };
}

