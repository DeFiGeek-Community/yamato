import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { encodeFunctionData } from 'viem';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';

/**
 * v1.5 プロキシをアップグレード
 * 
 * 既存のv1.0プロキシを新しいv1.5実装にアップグレードします。
 * - 通常のコントラクト: `upgradeTo()`を使用
 * - FeePool: `upgradeToAndCall()`を使用（initializeV2を同時実行）
 * 
 * 実行方法:
 * - localhost: 直接トランザクション実行
 * - その他（sepolia, mainnet）: Safe Transaction提案
 * 
 * ⚠️ 注意:
 * - 本番環境ではマルチシグの承認が必要です
 * - 事前に`deploy-implementations.ts`を実行してください
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);
  console.log('🔄 Upgrading proxies to v1.5 implementations...\n');

  const upgrades = [
    { name: 'YamatoRepayer', version: 'V3', proxyContract: 'YamatoRepayerV2', method: 'upgradeTo' },
    { name: 'YamatoRedeemer', version: 'V5', proxyContract: 'YamatoRedeemerV4', method: 'upgradeTo' },
    { name: 'YamatoWithdrawer', version: 'V3', proxyContract: 'YamatoWithdrawerV2', method: 'upgradeTo' },
    { name: 'YamatoSweeper', version: 'V3', proxyContract: 'YamatoSweeperV2', method: 'upgradeTo' },
    { name: 'YamatoDepositor', version: 'V3', proxyContract: 'YamatoDepositorV2', method: 'upgradeTo' },
    { name: 'YamatoBorrower', version: 'V2', proxyContract: 'YamatoBorrower', method: 'upgradeTo' },
    { name: 'CurrencyOS', version: 'V3', proxyContract: 'CurrencyOSV2', method: 'upgradeTo' },
    { name: 'Yamato', version: 'V4', proxyContract: 'YamatoV3', method: 'upgradeTo' },
    { name: 'FeePool', version: 'V2', proxyContract: 'FeePool', method: 'upgradeToAndCall' },
  ];

  const publicClient = await hre.viem.getPublicClient();
  let successCount = 0;

  // FeePool用のstartTimeを取得（環境変数またはデフォルト値）
  const startTime = process.env.YMT_MINTER_START_TIME 
    ? parseInt(process.env.YMT_MINTER_START_TIME) 
    : 1753412400; // deployConfig.startTime

  for (const upgrade of upgrades) {
    try {
      console.log(`🔄 [${successCount + 1}/${upgrades.length}] Upgrading ${upgrade.name}...`);

      // プロキシアドレスを取得
      const proxyAddress = loadAddress(network, `${upgrade.name}ERC1967Proxy`);
      console.log(`   📍 Proxy: ${proxyAddress}`);

      // 新しい実装アドレスを取得
      const newImplAddress = loadAddress(network, `${upgrade.name}${upgrade.version}Impl`);
      console.log(`   📦 New Implementation: ${newImplAddress}`);

      // プロキシコントラクトを取得（現在のバージョンのABIを使用）
      const proxy = await hre.viem.getContractAt(upgrade.proxyContract, proxyAddress);

      if (isLocalhost) {
        // ローカル環境: 直接トランザクション実行
        let hash: `0x${string}`;

        if (upgrade.method === 'upgradeToAndCall') {
          // FeePool: upgradeToAndCall with initializeV2
          console.log(`   🔄 Calling upgradeToAndCall() with initializeV2(${startTime})...`);
          
          // 新しい実装のABIを取得してinitializeV2のcalldataをエンコード
          const newImpl = await hre.viem.getContractAt('FeePoolV2', newImplAddress);
          const initData = encodeFunctionData({
            abi: newImpl.abi,
            functionName: 'initializeV2',
            args: [BigInt(startTime)],
          });

          hash = await proxy.write.upgradeToAndCall([newImplAddress, initData]);
        } else {
          // 通常のアップグレード: upgradeTo
          console.log(`   🔄 Calling upgradeTo()...`);
          hash = await proxy.write.upgradeTo([newImplAddress]);
        }

        console.log(`   📝 Transaction hash: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      } else {
        // 本番環境: Safe Transaction提案
        if (upgrade.method === 'upgradeToAndCall') {
          // FeePool: upgradeToAndCall with initializeV2
          console.log(`   📝 Proposing upgradeToAndCall() with initializeV2(${startTime})...`);
          
          // 新しい実装のABIを取得してinitializeV2のcalldataをエンコード
          const newImpl = await hre.viem.getContractAt('FeePoolV2', newImplAddress);
          const initData = encodeFunctionData({
            abi: newImpl.abi,
            functionName: 'initializeV2',
            args: [BigInt(startTime)],
          });

          await createAndProposeSafeTransaction(
            proxyAddress,
            proxy.abi,
            'upgradeToAndCall',
            [newImplAddress, initData],
            network
          );
        } else {
          // 通常のアップグレード: upgradeTo
          console.log(`   📝 Proposing upgradeTo()...`);
          
          await createAndProposeSafeTransaction(
            proxyAddress,
            proxy.abi,
            'upgradeTo',
            [newImplAddress],
            network
          );
        }
      }

      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to upgrade ${upgrade.name}:`, error);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Proxy upgrade completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Upgraded: ${successCount}/${upgrades.length} proxies`);
  console.log(`\n📝 Next step:`);
  console.log(`   Run: npx hardhat run scripts/upgrade/v1.5/post-upgrade-setup.ts --network ${network}`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

