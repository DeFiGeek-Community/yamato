import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

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
  const yamatoAddr = loadAddress(network, 'YamatoERC1967Proxy');
  const pledgeLibAddr = loadAddress(network, 'PledgeLib');
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  // YamatoDepositorV2はPledgeLibのlinkReferencesが空のため、リンク不要
  // （using PledgeLib宣言はあるが、実際のバイトコードには含まれていない）
  const result = await deployUUPS({
    name: 'YamatoDepositor',
    contractName: 'YamatoDepositorV2',
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
