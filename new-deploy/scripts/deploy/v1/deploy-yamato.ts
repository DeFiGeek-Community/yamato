import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // 依存コントラクトのアドレスを読み込む
  console.log('📖 Loading dependencies...');
  const currencyOSAddress = loadAddress(network, 'CurrencyOSERC1967Proxy');
  console.log(`   CurrencyOS: ${currencyOSAddress}`);
  console.log('✅ Dependencies loaded\n');

  // Yamatoをデプロイ
  const result = await deployUUPS({
    name: 'Yamato',
    contractName: V1_CONTRACTS.Yamato,
    initFunction: 'initialize',
    initArgs: [currencyOSAddress],
  });

  console.log(`\n✅ Yamato deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
