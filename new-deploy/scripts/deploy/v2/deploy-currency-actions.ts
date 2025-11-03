import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';

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
  const yamatoAddr = loadAddress(network, getCurrencyContractName('YamatoERC1967Proxy', currency));
  const pledgeLibAddr = loadAddress(network, 'PledgeLib');
  console.log(`   Yamato (${currency}): ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const actions = [
    { name: 'YamatoDepositor', version: 'V3', contractName: 'YamatoDepositorV3', libraries: true },
    { name: 'YamatoBorrower', version: 'V2', contractName: 'YamatoBorrowerV2', libraries: true },
    { name: 'YamatoRepayer', version: 'V3', contractName: 'YamatoRepayerV3', libraries: true },
    { name: 'YamatoWithdrawer', version: 'V3', contractName: 'YamatoWithdrawerV3', libraries: true },
    { name: 'YamatoRedeemer', version: 'V5', contractName: 'YamatoRedeemerV5', libraries: true },
    { name: 'YamatoSweeper', version: 'V3', contractName: 'YamatoSweeperV3', libraries: true },
  ];

  let successCount = 0;

  for (const action of actions) {
    try {
      console.log(`🔄 [${successCount + 1}/${actions.length}] Deploying ${action.name}${action.version}...`);

      const result = await deployUUPS({
        name: getCurrencyContractName(action.name, currency),
        contractName: action.contractName,
        initFunction: 'initialize',
        initArgs: [yamatoAddr],
        libraries: action.libraries ? {
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

