import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS } from '../../core/contract-definitions';

/**
 * Pool デプロイ
 * 
 * 償還プールと清算プールを管理するコントラクトです。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddr = loadProxyAddress(network, 'Yamato');
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: 'Pool',
    contractName: V1_CONTRACTS.Pool,
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
  });

  console.log(`\n✅ Pool deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
