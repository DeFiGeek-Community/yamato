import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { type NetworkName } from '../../core/address-manager';

/**
 * PriceFeedSingle デプロイ
 * 
 * CUSD用のシンプルなプライスフィード（USD/USD = 1.0固定）
 * 
 * ⚠️ 注意:
 * - CUSDは米ドル連動のため、価格は常に1.0
 * - Chainlink Oracleは不要
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // PriceFeedSingleは引数なしで初期化
  const result = await deployUUPS({
    name: 'PriceFeedSingle_CUSD',
    contractName: 'PriceFeedSingle',
    initFunction: 'initialize',
    initArgs: [],
  });

  console.log(`\n✅ PriceFeedSingle deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}`);
  console.log(`\n📝 Note:`);
  console.log(`   This PriceFeed returns a fixed price of 1.0 USD\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

