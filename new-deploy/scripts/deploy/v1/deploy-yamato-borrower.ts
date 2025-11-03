import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS, requiresPledgeLib } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddress = loadProxyAddress(network, 'Yamato');
  const pledgeLibAddress = loadAddress(network, V1_CONTRACTS.PledgeLib);
  console.log(`   Yamato: ${yamatoAddress}`);
  console.log(`   PledgeLib: ${pledgeLibAddress}`);
  console.log('✅ Dependencies loaded\n');

  const needsLibrary = requiresPledgeLib(V1_CONTRACTS.YamatoBorrower, 'v1');

  const result = await deployUUPS({
    name: 'YamatoBorrower',
    contractName: V1_CONTRACTS.YamatoBorrower,
    initFunction: 'initialize',
    initArgs: [yamatoAddress],
    libraries: needsLibrary ? {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddress,
    } : undefined,
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

