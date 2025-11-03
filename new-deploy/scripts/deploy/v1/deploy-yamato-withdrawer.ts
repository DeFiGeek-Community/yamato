import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

/**
 * YamatoWithdrawer デプロイ
 * 
 * 担保（ETH）を引き出すアクションコントラクトです。
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
    name: 'YamatoWithdrawer',
    contractName: 'YamatoWithdrawerV2',
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
    libraries: {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
    },
  });

  console.log(`\n✅ YamatoWithdrawer deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
