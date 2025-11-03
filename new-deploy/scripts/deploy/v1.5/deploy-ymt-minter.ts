import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_5_CONTRACTS } from '../../core/contract-definitions';

/**
 * YmtMinter デプロイ
 * 
 * YMTトークンのマイニング（発行）を管理するコントラクトです。
 * UUPSプロキシパターンでデプロイされます。
 * 
 * 初期化引数:
 * - _ymtAddr: YMTトークンアドレス
 * - _controllerAddr: ScoreWeightControllerプロキシアドレス
 * - _startTime: マイニング開始時刻（UNIX timestamp）
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const ymtAddr = loadAddress(network, V1_5_CONTRACTS.YMT);
  const controllerAddr = loadAddress(network, 'ScoreWeightControllerERC1967Proxy');
  console.log(`   YMT: ${ymtAddr}`);
  console.log(`   ScoreWeightController: ${controllerAddr}`);
  console.log('✅ Dependencies loaded\n');

  // マイニング開始時刻（デフォルト: 現在時刻）
  const startTime = process.env.YMT_MINTER_START_TIME 
    ? parseInt(process.env.YMT_MINTER_START_TIME) 
    : Math.floor(Date.now() / 1000);
  
  console.log(`⏰ Mining start time: ${startTime} (${new Date(startTime * 1000).toISOString()})\n`);

  const result = await deployUUPS({
    name: 'YmtMinter',
    contractName: V1_5_CONTRACTS.YmtMinter,
    initFunction: 'initialize',
    initArgs: [ymtAddr, controllerAddr, startTime],
  });

  console.log(`\n✅ YmtMinter deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
