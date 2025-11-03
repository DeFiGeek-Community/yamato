import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_5_CONTRACTS, V1_CONTRACTS, requiresPledgeLib, CONTRACT_NAMES } from '../../core/contract-definitions';

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
  const ymtMinterAddr = loadProxyAddress(network, CONTRACT_NAMES.YmtMinter);
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
  const pledgeLibAddr = loadAddress(network, V1_CONTRACTS.PledgeLib);
  console.log(`   YmtMinter: ${ymtMinterAddr}`);
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const needsLibrary = requiresPledgeLib(V1_5_CONTRACTS.ScoreRegistry, 'v1.5');

  const result = await deployUUPS({
    name: CONTRACT_NAMES.ScoreRegistry,
    contractName: V1_5_CONTRACTS.ScoreRegistry,
    initFunction: 'initialize',
    initArgs: [ymtMinterAddr, yamatoAddr],
    libraries: needsLibrary ? {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
    } : undefined,
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
