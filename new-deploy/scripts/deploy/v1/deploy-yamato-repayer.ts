import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * YamatoRepayer デプロイ
 * 
 * 借入（CJPY）を返済するアクションコントラクトです。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: CONTRACT_NAMES.YamatoRepayer,
    contractName: V1_CONTRACTS.YamatoRepayer,
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
  });

  console.log(`\n✅ YamatoRepayer deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
