import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import type { Address } from 'viem';
import { getCurrencyContractName, type Currency } from './currency-manager';

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

/**
 * プロキシ名を生成
 * 
 * @param contractName - コントラクト名（例: 'Yamato', 'CurrencyOS'）
 * @param currency - 通貨（オプション、v2で通貨別の場合に指定）
 * @returns プロキシ名（例: 'YamatoERC1967Proxy' または 'YamatoERC1967Proxy_CUSD'）
 */
export function getProxyName(contractName: string, currency?: Currency): string {
  if (currency) {
    return getCurrencyContractName(`${contractName}ERC1967Proxy`, currency);
  }
  return `${contractName}ERC1967Proxy`;
}

/**
 * 実装名を生成
 * 
 * @param contractName - コントラクト名（例: 'Yamato'）
 * @returns 実装名（例: 'YamatoImpl'）
 */
export function getImplementationName(contractName: string): string {
  return `${contractName}Impl`;
}

/**
 * プロキシアドレスを読み込む
 * 
 * @param network - ネットワーク名
 * @param contractName - コントラクト名（例: 'Yamato', 'CurrencyOS'）
 * @param currency - 通貨（オプション、v2で通貨別の場合に指定）
 * @returns プロキシアドレス
 */
export function loadProxyAddress(
  network: NetworkName, 
  contractName: string, 
  currency?: Currency
): Address {
  const proxyName = getProxyName(contractName, currency);
  return loadAddress(network, proxyName);
}

/**
 * 実装アドレスを読み込む
 * 
 * @param network - ネットワーク名
 * @param contractName - コントラクト名（例: 'Yamato'）
 * @returns 実装アドレス
 */
export function loadImplementationAddress(
  network: NetworkName,
  contractName: string
): Address {
  const implName = getImplementationName(contractName);
  return loadAddress(network, implName);
}

/**
 * プロキシアドレスを保存
 * 
 * @param network - ネットワーク名
 * @param contractName - コントラクト名
 * @param address - プロキシアドレス
 * @param currency - 通貨（オプション、v2で通貨別の場合に指定）
 */
export function saveProxyAddress(
  network: NetworkName,
  contractName: string,
  address: Address,
  currency?: Currency
): void {
  const proxyName = getProxyName(contractName, currency);
  saveAddress(network, proxyName, address);
}

/**
 * 実装アドレスを保存
 * 
 * @param network - ネットワーク名
 * @param contractName - コントラクト名
 * @param address - 実装アドレス
 */
export function saveImplementationAddress(
  network: NetworkName,
  contractName: string,
  address: Address
): void {
  const implName = getImplementationName(contractName);
  saveAddress(network, implName, address);
}

