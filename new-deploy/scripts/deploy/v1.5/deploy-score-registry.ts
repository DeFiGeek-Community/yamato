import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

/**
 * ScoreRegistry デプロイ
 * 
 * ユーザーのスコア（YMT獲得権）を記録するコントラクトです。
 * UUPSプロキシパターンでデプロイされ、PledgeLibライブラリをリンクします。
 * 
 * 初期化引数:
 * - _ymtMinterAddr: YmtMinterプロキシアドレス
 * - _yamatoAddr: Yamatoプロキシアドレス
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const ymtMinterAddr = loadAddress(network, 'YmtMinterERC1967Proxy');
  const yamatoAddr = loadAddress(network, 'YamatoERC1967Proxy');
  const pledgeLibAddr = loadAddress(network, 'PledgeLib');
  console.log(`   YmtMinter: ${ymtMinterAddr}`);
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: 'ScoreRegistry',
    contractName: 'ScoreRegistry',
    initFunction: 'initialize',
    initArgs: [ymtMinterAddr, yamatoAddr],
    libraries: {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
    },
  });

  console.log(`\n✅ ScoreRegistry deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

