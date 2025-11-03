import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

/**
 * ScoreWeightController デプロイ
 * 
 * 複数のScoreRegistryのウェイトを管理するコントラクトです。
 * UUPSプロキシパターンでデプロイされます。
 * 
 * 初期化引数:
 * - _ymtAddr: YMTトークンアドレス
 * - _veYmtAddr: veYMTアドレス
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const ymtAddr = loadAddress(network, 'YMT');
  const veYmtAddr = loadAddress(network, 'veYMT');
  console.log(`   YMT: ${ymtAddr}`);
  console.log(`   veYMT: ${veYmtAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: 'ScoreWeightController',
    contractName: 'ScoreWeightController',
    initFunction: 'initialize',
    initArgs: [ymtAddr, veYmtAddr],
  });

  console.log(`\n✅ ScoreWeightController deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

