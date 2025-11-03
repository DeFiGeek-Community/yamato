import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddress = loadAddress(network, 'YamatoERC1967Proxy');
  const pledgeLibAddress = loadAddress(network, 'PledgeLib');
  console.log(`   Yamato: ${yamatoAddress}`);
  console.log(`   PledgeLib: ${pledgeLibAddress}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: 'YamatoBorrower',
    contractName: 'YamatoBorrower',
    initFunction: 'initialize',
    initArgs: [yamatoAddress],
    libraries: {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddress,
    },
  });

  console.log(`\n✅ YamatoBorrower deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

