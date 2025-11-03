import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';

/**
 * 通貨別PriorityRegistry デプロイ
 * 
 * CURRENCY環境変数で指定された通貨のPriorityRegistryインスタンスをデプロイします。
 * PledgeLibをリンクします。
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

  const result = await deployUUPS({
    name: getCurrencyContractName('PriorityRegistry', currency),
    contractName: 'PriorityRegistryV6',
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
    libraries: {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
    },
  });

  console.log(`\n✅ PriorityRegistry (${currency}) deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

