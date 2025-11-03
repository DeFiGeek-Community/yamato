import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS, requiresPledgeLib } from '../../core/contract-definitions';

/**
 * YamatoDepositor デプロイ
 * 
 * 担保（ETH）を預け入れるアクションコントラクトです。
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

  // YamatoDepositorV2はPledgeLibのlinkReferencesが空のため、リンク不要
  // （using PledgeLib宣言はあるが、実際のバイトコードには含まれていない）
  const result = await deployUUPS({
    name: 'YamatoDepositor',
    contractName: V1_CONTRACTS.YamatoDepositor,
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
  });

  console.log(`\n✅ YamatoDepositor deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
