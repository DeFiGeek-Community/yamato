import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // 依存コントラクトのアドレスを読み込む（共通関数を使用）
  console.log('📖 Loading dependencies...');
  const cjpyAddress = loadAddress(network, V1_CONTRACTS.CJPY);
  const priceFeedAddress = loadProxyAddress(network, 'PriceFeed');
  const feePoolAddress = loadProxyAddress(network, 'FeePool');
  console.log(`   CJPY: ${cjpyAddress}`);
  console.log(`   PriceFeed: ${priceFeedAddress}`);
  console.log(`   FeePool: ${feePoolAddress}`);
  console.log('✅ Dependencies loaded\n');

  // CurrencyOSをデプロイ
  const result = await deployUUPS({
    name: 'CurrencyOS',
    contractName: V1_CONTRACTS.CurrencyOS,
    initFunction: 'initialize',
    initArgs: [cjpyAddress, priceFeedAddress, feePoolAddress],
  });

  console.log(`\n✅ CurrencyOS deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
