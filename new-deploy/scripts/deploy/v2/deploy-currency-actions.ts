import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS, V1_CONTRACTS, requiresPledgeLib, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * 通貨別アクションコントラクト デプロイ
 * 
 * CURRENCY環境変数で指定された通貨の全アクションコントラクトをデプロイします。
 * 
 * デプロイ対象:
 * - YamatoDepositorV3
 * - YamatoBorrowerV2
 * - YamatoRepayerV3
 * - YamatoWithdrawerV3
 * - YamatoRedeemerV5
 * - YamatoSweeperV3
 * 
 * 使用方法:
 *   CURRENCY=CUSD npx hardhat run scripts/deploy/v2/deploy-currency-actions.ts --network localhost
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency);
  const pledgeLibAddr = loadAddress(network, V1_CONTRACTS.PledgeLib);
  console.log(`   Yamato (${currency}): ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  // contract-definitions.tsから定義を取得
  const actions = [
    { name: CONTRACT_NAMES.YamatoDepositor, version: 'V3', contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor },
    { name: CONTRACT_NAMES.YamatoBorrower, version: 'V2', contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower },
    { name: CONTRACT_NAMES.YamatoRepayer, version: 'V3', contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer },
    { name: CONTRACT_NAMES.YamatoWithdrawer, version: 'V3', contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer },
    { name: CONTRACT_NAMES.YamatoRedeemer, version: 'V5', contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer },
    { name: CONTRACT_NAMES.YamatoSweeper, version: 'V3', contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper },
  ];

  let successCount = 0;

  for (const action of actions) {
    try {
      console.log(`🔄 [${successCount + 1}/${actions.length}] Deploying ${action.name}${action.version}...`);

      // contract-definitions.tsでライブラリリンクが必要かチェック
      const needsLibrary = requiresPledgeLib(action.contractName, 'v2');
      
      const result = await deployUUPS({
        name: getCurrencyContractName(action.name, currency),
        contractName: action.contractName,
        initFunction: 'initialize',
        initArgs: [yamatoAddr],
        libraries: needsLibrary ? {
          'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
        } : undefined,
      });

      console.log(`   ✅ ${action.name}: ${result.proxyAddress}\n`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to deploy ${action.name}:`, error);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ All action contracts deployed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Currency: ${currency}`);
  console.log(`   Deployed: ${successCount}/${actions.length} contracts`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

