import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS, requiresPledgeLib } from '../../core/contract-definitions';

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
  const yamatoAddr = loadProxyAddress(network, 'Yamato');
  const pledgeLibAddr = loadAddress(network, V1_CONTRACTS.PledgeLib);
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const needsLibrary = requiresPledgeLib(V1_CONTRACTS.YamatoWithdrawer, 'v1');

  const result = await deployUUPS({
    name: 'YamatoWithdrawer',
    contractName: V1_CONTRACTS.YamatoWithdrawer,
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
    libraries: needsLibrary ? {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
    } : undefined,
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
