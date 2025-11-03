import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

/**
 * YamatoRedeemer デプロイ
 * 
 * CJPYを償還（ETHと交換）するアクションコントラクトです。
 * PledgeLibをリンクします。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddr = loadAddress(network, 'YamatoERC1967Proxy');
  const pledgeLibAddr = loadAddress(network, 'PledgeLib');
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: 'YamatoRedeemer',
    contractName: 'YamatoRedeemerV4',
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
    libraries: {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
    },
  });

  console.log(`\n✅ YamatoRedeemer deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
