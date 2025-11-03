import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * HardhatのartifactsからABIとBytecodeを読み込む
 */
export function loadArtifact(contractName: string) {
  let artifactPath: string;
  
  // @で始まる場合（例: @openzeppelin/...）はcontracts/を含めない
  if (contractName.startsWith('@')) {
    artifactPath = join(
      process.cwd(),
      '..',
      'artifacts',
      `${contractName}.json`
    );
  }
  // Dependencies/ で始まる場合は contracts/Dependencies/ 配下を探す
  else if (contractName.startsWith('Dependencies/')) {
    const baseName = contractName.split('/')[1]; // 'Dependencies/PledgeLib' -> 'PledgeLib'
    artifactPath = join(
      process.cwd(),
      '..',
      'artifacts',
      'contracts',
      'Dependencies',
      `${baseName}.sol`,
      `${baseName}.json`
    );
  }
  // 通常のコントラクト
  else {
    artifactPath = join(
      process.cwd(),
      '..',
      'artifacts',
      'contracts',
      `${contractName}.sol`,
      `${contractName}.json`
    );
  }

  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    return {
      abi: artifact.abi,
      bytecode: artifact.bytecode as `0x${string}`,
    };
  } catch (error) {
    throw new Error(
      `Failed to load artifact for ${contractName}. Make sure to run 'npx hardhat compile' first.\nPath: ${artifactPath}`
    );
  }
}

/**
 * ERC1967Proxyのartifactを読み込む
 */
export function loadProxyArtifact() {
  return loadArtifact('ERC1967Proxy');
}

/**
 * 特定のディレクトリ配下のコントラクトをロード
 */
export function loadArtifactFromPath(relativePath: string, contractName: string) {
  const artifactPath = join(
    process.cwd(),
    '..',
    'artifacts',
    'contracts',
    relativePath,
    `${contractName}.sol`,
    `${contractName}.json`
  );

  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    return {
      abi: artifact.abi,
      bytecode: artifact.bytecode as `0x${string}`,
    };
  } catch (error) {
    throw new Error(
      `Failed to load artifact for ${contractName}.\nPath: ${artifactPath}`
    );
  }
}

