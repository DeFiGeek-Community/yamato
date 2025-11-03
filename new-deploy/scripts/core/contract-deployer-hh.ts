import hre from 'hardhat';
import type { Address } from 'viem';
import { saveAddress, type NetworkName } from './address-manager';

export interface DeployContractParams {
  name: string;
  contractName: string;
  args?: any[];
  libraries?: Record<string, `0x${string}`>;
}

export interface DeployContractResult {
  address: `0x${string}`;
}

/**
 * 通常のコントラクトをデプロイ（hardhat-viem版）
 */
export async function deployContract(params: DeployContractParams): Promise<DeployContractResult> {
  const network = hre.network.name as NetworkName;
  
  console.log(`\n🚀 Deploying ${params.name}...`);

  // コントラクトをデプロイ（ライブラリリンク付き）
  console.log(`  📦 Deploying contract...`);
  if (params.libraries) {
    console.log(`  🔗 Linking libraries...`);
  }
  
  const contract = await hre.viem.deployContract(
    params.contractName,
    params.args || [],
    {
      libraries: params.libraries,
    }
  );
  
  const address = contract.address as Address;
  console.log(`  ✅ Contract deployed: ${address}`);

  // アドレスを保存
  saveAddress(network, params.name, address);

  console.log(`✅ ${params.name} deployment complete!\n`);

  return { address: address as `0x${string}` };
}

/**
 * ライブラリをデプロイ
 */
export async function deployLibrary(params: {
  name: string;
  contractName: string;
}): Promise<`0x${string}`> {
  const network = hre.network.name as NetworkName;
  
  console.log(`\n📚 Deploying library ${params.name}...`);

  // ライブラリをデプロイ
  const library = await hre.viem.deployContract(params.contractName, []);
  
  const address = library.address as Address;
  console.log(`  ✅ Library deployed: ${address}`);

  // アドレスを保存
  saveAddress(network, params.name, address);

  console.log(`✅ ${params.name} library deployment complete!\n`);

  return address as `0x${string}`;
}

