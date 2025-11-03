import hre from 'hardhat';
import { encodeFunctionData } from 'viem';
import type { Address } from 'viem';
import { saveProxyAddress, saveImplementationAddress, type NetworkName } from './address-manager';

export interface DeployUUPSParams {
  name: string;
  contractName: string;
  initFunction?: string;  // デフォルト: 'initialize'
  initArgs: any[];
  libraries?: Record<string, `0x${string}`>;
}

export interface DeployUUPSResult {
  implAddress: `0x${string}`;
  proxyAddress: `0x${string}`;
}

/**
 * UUPSプロキシパターンでコントラクトをデプロイ（hardhat-viem版）
 */
export async function deployUUPS(params: DeployUUPSParams): Promise<DeployUUPSResult> {
  const network = hre.network.name as NetworkName;
  
  console.log(`\n🚀 Deploying ${params.name}...`);

  // 1. 実装コントラクトをデプロイ（ライブラリリンク付き）
  console.log(`  📦 Deploying implementation...`);
  if (params.libraries) {
    console.log(`  🔗 Linking libraries...`);
  }
  
  const implementation = await hre.viem.deployContract(
    params.contractName,
    [],
    {
      libraries: params.libraries,
    }
  );
  
  const implAddress = implementation.address as Address;
  console.log(`  ✅ Implementation deployed: ${implAddress}`);

  // 2. 初期化データをエンコード
  const initFunctionName = params.initFunction || 'initialize';
  console.log(`  🔧 Encoding init data (function: ${initFunctionName})...`);
  
  const initData = encodeFunctionData({
    abi: implementation.abi,
    functionName: initFunctionName,
    args: params.initArgs,
  });

  // 3. プロキシをデプロイ
  console.log(`  📦 Deploying proxy...`);
  const proxy = await hre.viem.deployContract(
    '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy',
    [implAddress, initData]
  );
  
  const proxyAddress = proxy.address as Address;
  console.log(`  ✅ Proxy deployed: ${proxyAddress}`);

  // 4. アドレスを保存
  // nameパラメータが通貨別の場合（例: 'Yamato_CUSD'）に対応
  // 'Yamato_CUSD' → 'Yamato'を抽出
  const contractName = params.name.includes('_') 
    ? params.name.split('_')[0] 
    : params.name;
  const currency = params.name.includes('_') 
    ? params.name.split('_')[1] as 'CJPY' | 'CUSD' | 'CEUR'
    : undefined;
  
  // 実装アドレスを保存（統一された命名規則: {ContractName}Impl）
  saveImplementationAddress(network, contractName, implAddress);
  saveProxyAddress(network, contractName, proxyAddress, currency);

  console.log(`✅ ${params.name} deployment complete!\n`);

  return { 
    implAddress: implAddress as `0x${string}`, 
    proxyAddress: proxyAddress as `0x${string}` 
  };
}

