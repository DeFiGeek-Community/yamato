import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import type { Address } from 'viem';

export type NetworkName = 'sepolia' | 'mainnet' | 'localhost';

// 親ディレクトリのdeploymentsを参照
const DEPLOYMENTS_DIR = resolve(__dirname, '../../../deployments');

/**
 * deploymentsディレクトリのパスを取得
 */
function getDeploymentsPath(network: NetworkName): string {
  return join(DEPLOYMENTS_DIR, network);
}

/**
 * アドレスファイルのパスを取得
 */
function getAddressFilePath(network: NetworkName, contractName: string): string {
  return join(getDeploymentsPath(network), contractName);
}

/**
 * アドレスを読み込む
 */
export function loadAddress(network: NetworkName, contractName: string): Address {
  const filePath = getAddressFilePath(network, contractName);
  
  if (!existsSync(filePath)) {
    throw new Error(`Address file not found: ${filePath}`);
  }

  const address = readFileSync(filePath, 'utf-8').trim() as Address;
  
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid address in file: ${filePath}`);
  }

  return address;
}

/**
 * アドレスを保存
 */
export function saveAddress(network: NetworkName, contractName: string, address: Address): void {
  const deploymentsDir = getDeploymentsPath(network);
  
  // ディレクトリが存在しない場合は作成
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = getAddressFilePath(network, contractName);
  writeFileSync(filePath, address, 'utf-8');
  
  console.log(`✅ Saved ${contractName}: ${address}`);
}

/**
 * アドレスが存在するかチェック
 */
export function hasAddress(network: NetworkName, contractName: string): boolean {
  const filePath = getAddressFilePath(network, contractName);
  return existsSync(filePath);
}

/**
 * Chain IDを保存
 */
export function saveChainId(network: NetworkName, chainId: number): void {
  const deploymentsDir = getDeploymentsPath(network);
  
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = join(deploymentsDir, '.chainId');
  writeFileSync(filePath, chainId.toString(), 'utf-8');
}

/**
 * Chain IDを読み込む
 */
export function loadChainId(network: NetworkName): number {
  const filePath = join(getDeploymentsPath(network), '.chainId');
  
  if (!existsSync(filePath)) {
    throw new Error(`Chain ID file not found: ${filePath}`);
  }

  return parseInt(readFileSync(filePath, 'utf-8').trim());
}

