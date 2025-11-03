import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import type { NetworkName } from '../../core/address-manager';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // FeePoolをデプロイ
  const result = await deployUUPS({
    name: 'FeePool',
    contractName: 'FeePool',
    initFunction: 'initialize',
    initArgs: [], // FeePoolのinitializeは引数なし
  });

  console.log(`\n✅ FeePool deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
