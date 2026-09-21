import hre from 'hardhat';
import { encodeFunctionData } from 'viem';
import { loadProxyAddress, saveImplementationAddress, type NetworkName } from '../../core/address-manager';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';
import { V2_UPGRADE_IMPLEMENTATIONS, V2_UPGRADE_PROXIES, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * ScoreWeightController v1→v2 アップグレード（initializeV2 込み）
 *
 * 単なる upgradeTo だと V2 の初期化（既存 ScoreRegistry / period の引き継ぎ）が
 * 行われず getTotalWeight() などが正しく機能しないため、
 * upgradeToAndCall(impl, initializeV2(scoreRegistry, v1periodTimestamp)) を実行する。
 *
 * 実行方法:
 * - localhost: 直接トランザクション実行
 * - その他（sepolia, mainnet）: Safe Transaction提案
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';

  console.log(`\n🌐 Network: ${network}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);
  console.log('🔄 Upgrading ScoreWeightController V1 → V2 (with initializeV2)...\n');

  const publicClient = await hre.viem.getPublicClient();

  // 1. 新しい実装をデプロイ
  console.log('📦 Deploying ScoreWeightControllerV2 implementation...');
  const implementation = await hre.viem.deployContract(V2_UPGRADE_IMPLEMENTATIONS.ScoreWeightController, []);
  const newImplAddress = implementation.address;
  console.log(`   ✅ New implementation deployed: ${newImplAddress}`);
  saveImplementationAddress(network, CONTRACT_NAMES.ScoreWeightController, newImplAddress);

  // 2. initializeV2 の calldata を構築
  //    initializeV2(scoreRegistry, v1periodTimestamp): 既存 ScoreRegistry の periodTimestamp(0) を引き継ぐ
  const scoreRegistryAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry);
  const scoreRegistry = await hre.viem.getContractAt(CONTRACT_NAMES.ScoreRegistry, scoreRegistryAddr);
  const v1PeriodTimestamp = (await scoreRegistry.read.periodTimestamp([0n])) as bigint;
  console.log(`   ScoreRegistry: ${scoreRegistryAddr}`);
  console.log(`   v1 periodTimestamp(0): ${v1PeriodTimestamp}`);

  const initV2Data = encodeFunctionData({
    abi: implementation.abi,
    functionName: 'initializeV2',
    args: [scoreRegistryAddr, v1PeriodTimestamp],
  });

  // 3. upgradeToAndCall（upgrade + initializeV2 を1txで）
  const proxyAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
  console.log(`   📍 Proxy: ${proxyAddress}\n`);
  const proxy = await hre.viem.getContractAt(V2_UPGRADE_PROXIES.ScoreWeightController, proxyAddress);

  if (isLocalhost) {
    console.log('🔄 Calling upgradeToAndCall(impl, initializeV2)...');
    const hash = await proxy.write.upgradeToAndCall([newImplAddress, initV2Data]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   📝 Transaction hash: ${hash}`);
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  } else {
    console.log('📝 Proposing upgradeToAndCall(impl, initializeV2)...');
    await createAndProposeSafeTransaction(
      proxyAddress,
      proxy.abi,
      'upgradeToAndCall',
      [newImplAddress, initV2Data],
      network
    );
  }

  console.log(`\n✅ ScoreWeightController upgrade (V2 + initializeV2) completed!`);
  console.log(`   Proxy: ${proxyAddress}`);
  console.log(`   New Implementation: ${newImplAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
