import hre from 'hardhat';
import { saveImplementationAddress, type NetworkName, loadAddress } from '../../core/address-manager';
import { 
  V1_5_UPGRADE_IMPLEMENTATIONS, 
  V1_CONTRACTS,
  requiresPledgeLib 
} from '../../core/contract-definitions';

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

  // contract-definitions.tsから定義を取得
  const implementations = [
    { name: 'YamatoRepayer', version: 'V3', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.YamatoRepayer },
    { name: 'YamatoRedeemer', version: 'V5', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.YamatoRedeemer },
    { name: 'YamatoWithdrawer', version: 'V3', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.YamatoWithdrawer },
    { name: 'YamatoSweeper', version: 'V3', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.YamatoSweeper },
    { name: 'YamatoDepositor', version: 'V3', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.YamatoDepositor },
    { name: 'YamatoBorrower', version: 'V2', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.YamatoBorrower },
    { name: 'CurrencyOS', version: 'V3', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.CurrencyOS },
    { name: 'Yamato', version: 'V4', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.Yamato },
    { name: 'FeePool', version: 'V2', contractName: V1_5_UPGRADE_IMPLEMENTATIONS.FeePool },
  ];

  const publicClient = await hre.viem.getPublicClient();
  let successCount = 0;

  // PledgeLibアドレスを取得（ライブラリリンク用）
  const pledgeLibAddr = loadAddress(network, V1_CONTRACTS.PledgeLib);

  for (const impl of implementations) {
    try {
      console.log(`🔄 [${successCount + 1}/${implementations.length}] Deploying ${impl.contractName}...`);

      // contract-definitions.tsでライブラリリンクが必要かチェック
      const needsLibrary = requiresPledgeLib(impl.contractName, 'v1.5');
      const libraries = needsLibrary && pledgeLibAddr
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

      // アドレスを保存（共通関数を使用）
      saveImplementationAddress(network, impl.name, impl.version, implAddress);

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
