import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Address, WalletClient, PublicClient } from 'viem';
import { keccak256, toHex } from 'viem';

/**
 * ライブラリのプレースホルダーをアドレスに置換
 * 
 * Solidityコンパイラは、ライブラリへの参照を以下の形式のプレースホルダーで埋め込みます：
 * __$<library-hash>$__
 * 
 * 例: __$3407dfe6223903c4cb1bc015f8d76fa350$__
 * 
 * このプレースホルダーをライブラリの実際のデプロイアドレスに置換する必要があります。
 */
export function linkLibraries(
  bytecode: string,
  libraries: Record<string, Address>
): `0x${string}` {
  let linkedBytecode = bytecode;

  for (const [placeholder, address] of Object.entries(libraries)) {
    // アドレスから0xを除去して小文字に
    const addressWithoutPrefix = address.slice(2).toLowerCase();
    
    // プレースホルダーを正規表現でグローバルに置換
    // __$...$__ 形式のプレースホルダーを探す
    const placeholderRegex = new RegExp(placeholder, 'g');
    linkedBytecode = linkedBytecode.replace(placeholderRegex, addressWithoutPrefix);
  }

  return linkedBytecode as `0x${string}`;
}

/**
 * バイトコードからライブラリプレースホルダーを抽出
 * 
 * @param bytecode コントラクトのバイトコード
 * @returns プレースホルダーの配列 (例: ["__$3407dfe6223903c4cb1bc015f8d76fa350$__"])
 */
export function extractLibraryPlaceholders(bytecode: string): string[] {
  // __$...$__ 形式のプレースホルダーを抽出
  const placeholderRegex = /__\$[a-f0-9]{40}\$__/g;
  const matches = bytecode.match(placeholderRegex);
  
  if (!matches) {
    return [];
  }

  // 重複を除去
  return Array.from(new Set(matches));
}

/**
 * Hardhatのartifactsからライブラリプレースホルダーマッピングを読み込む
 * 
 * Hardhatがコンパイルしたコントラクトのartifactには、どのプレースホルダーが
 * どのライブラリに対応するかの情報が含まれています。
 */
export function getLibraryPlaceholderMapping(contractName: string): Record<string, string> {
  const artifactPath = join(
    process.cwd(),
    '..',
    'artifacts',
    'contracts',
    `${contractName}.sol`,
    `${contractName}.json`
  );

  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    
    // linkReferences から placeholderMapping を生成
    const mapping: Record<string, string> = {};
    
    if (artifact.linkReferences) {
      for (const [fileName, libraries] of Object.entries(artifact.linkReferences)) {
        for (const libraryName of Object.keys(libraries as Record<string, any>)) {
          // ライブラリ名からプレースホルダーを推測
          // Hardhatは`contracts/Dependencies/${libraryName}.sol:${libraryName}`の形式を使用
          const fullLibraryPath = `contracts/Dependencies/${libraryName}.sol:${libraryName}`;
          mapping[libraryName] = fullLibraryPath;
        }
      }
    }

    return mapping;
  } catch (error) {
    console.warn(`Warning: Could not load library mapping for ${contractName}`);
    return {};
  }
}

/**
 * ライブラリ名からプレースホルダーを計算
 * 
 * Solidityコンパイラは以下の方法でプレースホルダーを生成します：
 * 1. ライブラリのフルパス (例: "contracts/Dependencies/PledgeLib.sol:PledgeLib") のkeccak256ハッシュを計算
 * 2. ハッシュの最初の17バイト（34文字）を取得
 * 3. "__$" + hash + "$__" の形式にする
 */
export function calculateLibraryPlaceholder(libraryPath: string): string {
  // ライブラリパスのハッシュを計算
  const hash = keccak256(toHex(libraryPath));
  
  // 最初の17バイト（34文字）を取得（0xを除く）
  const placeholder = hash.slice(2, 36);
  
  return `__$${placeholder}$__`;
}

/**
 * 簡略化されたライブラリリンク
 * ライブラリ名とアドレスのマッピングからバイトコードをリンク
 */
export function linkLibrariesByName(
  bytecode: string,
  libraryAddresses: Record<string, Address>
): `0x${string}` {
  let linkedBytecode = bytecode;

  for (const [libraryName, address] of Object.entries(libraryAddresses)) {
    // PledgeLibのフルパスを生成
    const libraryPath = `contracts/Dependencies/${libraryName}.sol:${libraryName}`;
    const placeholder = calculateLibraryPlaceholder(libraryPath);
    
    console.log(`  📌 Library: ${libraryName}`);
    console.log(`     Path: ${libraryPath}`);
    console.log(`     Calculated placeholder: ${placeholder}`);
    console.log(`     Address: ${address}`);
    
    // アドレスから0xを除去
    const addressWithoutPrefix = address.slice(2).toLowerCase();
    
    // バイトコード内では PUSH20 (0x73) が先頭につくので、そのパターンを探す
    // 73__$...$__ -> 73<address>
    const fullPlaceholder = `73${placeholder}`;
    const replacement = `73${addressWithoutPrefix}`;
    
    // 正規表現の特殊文字（特に$）をエスケープ
    const escapedPlaceholder = fullPlaceholder.replace(/\$/g, '\\$');
    const regex = new RegExp(escapedPlaceholder, 'g');
    
    const beforeCount = (linkedBytecode.match(regex) || []).length;
    linkedBytecode = linkedBytecode.replace(regex, replacement);
    const afterCount = (linkedBytecode.match(regex) || []).length;
    
    console.log(`     Replacements: ${beforeCount} -> ${afterCount}`);
  }

  return linkedBytecode as `0x${string}`;
}

/**
 * バイトコードがリンク済みかどうかをチェック
 */
export function isLinked(bytecode: string): boolean {
  const placeholders = extractLibraryPlaceholders(bytecode);
  return placeholders.length === 0;
}

