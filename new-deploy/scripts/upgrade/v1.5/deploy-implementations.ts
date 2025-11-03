import hre from 'hardhat';
import { saveAddress, type NetworkName } from '../../core/address-manager';

/**
 * v1.5 新しい実装コントラクトをデプロイ
 * 
 * v1.0からv1.5へのアップグレード用に、新しいバージョンの実装コントラクトをデプロイします。
 * プロキシはアップグレードせず、実装のみをデプロイします。
 * 
 * デプロイ対象:
 * 1. YamatoRepayerV3
 * 2. YamatoRedeemerV5
 * 3. YamatoWithdrawerV3
 * 4. YamatoSweeperV3
 * 5. YamatoDepositorV3
 * 6. YamatoBorrowerV2
 * 7. CurrencyOSV3
 * 8. YamatoV4
 * 9. FeePoolV2
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);
  console.log('📦 Deploying v1.5 implementation contracts...\n');

  // PledgeLib linkReferencesの実態に基づいた設定:
  // - YamatoRepayerV3: リンク必要
  // - YamatoRedeemerV5: リンク必要
  // - YamatoWithdrawerV3: リンク必要
  // - YamatoSweeperV3: リンク必要
  // - YamatoDepositorV3: リンク必要（V2は不要だったがV3は必要）
  // - YamatoBorrowerV2: リンク必要
  // - CurrencyOSV3: リンク不要
  // - YamatoV4: リンク不要
  // - FeePoolV2: リンク不要
  const implementations = [
    { name: 'YamatoRepayer', version: 'V3', contractName: 'YamatoRepayerV3', libraries: true },
    { name: 'YamatoRedeemer', version: 'V5', contractName: 'YamatoRedeemerV5', libraries: true },
    { name: 'YamatoWithdrawer', version: 'V3', contractName: 'YamatoWithdrawerV3', libraries: true },
    { name: 'YamatoSweeper', version: 'V3', contractName: 'YamatoSweeperV3', libraries: true },
    { name: 'YamatoDepositor', version: 'V3', contractName: 'YamatoDepositorV3', libraries: true },
    { name: 'YamatoBorrower', version: 'V2', contractName: 'YamatoBorrowerV2', libraries: true },
    { name: 'CurrencyOS', version: 'V3', contractName: 'CurrencyOSV3' },
    { name: 'Yamato', version: 'V4', contractName: 'YamatoV4' },
    { name: 'FeePool', version: 'V2', contractName: 'FeePoolV2' },
  ];

  const publicClient = await hre.viem.getPublicClient();
  let successCount = 0;

  // PledgeLibアドレスを取得（ライブラリリンク用）
  const pledgeLibAddr = await (async () => {
    try {
      const { loadAddress } = await import('../../core/address-manager');
      return loadAddress(network, 'PledgeLib');
    } catch {
      return null;
    }
  })();

  for (const impl of implementations) {
    try {
      console.log(`🔄 [${successCount + 1}/${implementations.length}] Deploying ${impl.contractName}...`);

      // ライブラリリンクが必要な場合
      const libraries = impl.libraries && pledgeLibAddr
        ? { 'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr }
        : undefined;

      if (libraries) {
        console.log(`   🔗 Linking PledgeLib: ${pledgeLibAddr}`);
      }

      // 実装コントラクトをデプロイ
      const implementation = await hre.viem.deployContract(
        impl.contractName,
        [],
        libraries ? { libraries: libraries } : undefined
      );

      const implAddress = implementation.address;
      console.log(`   ✅ Deployed: ${implAddress}`);

      // アドレスを保存（v1.5用の命名規則）
      saveAddress(network, `${impl.name}${impl.version}Impl`, implAddress);

      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to deploy ${impl.contractName}:`, error);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Implementation deployment completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Deployed: ${successCount}/${implementations.length} implementations`);
  console.log(`\n📝 Next step:`);
  console.log(`   Run: npx hardhat run scripts/upgrade/v1.5/upgrade-proxies.ts --network ${network}`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

