import hre from 'hardhat';
import { deployContract } from '../../core/contract-deployer-hh';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_5_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * YMT デプロイ
 * 
 * Yamatoプロトコルのガバナンストークンです。
 * 非UUPSコントラクト（通常のコントラクト）です。
 * 
 * コンストラクタ引数:
 * - _vestingAddr: YmtVestingアドレス
 * - _adminAddr: 管理者アドレス（マルチシグ）
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // 環境変数から管理者アドレスを取得
  const adminAddr = process.env.COMMUNITY_MULTISIG_ADDRESS;
  if (!adminAddr) {
    throw new Error('COMMUNITY_MULTISIG_ADDRESS is not set in .env');
  }
  console.log(`📝 Admin address: ${adminAddr}\n`);

  console.log('📖 Loading dependencies...');
  const ymtVestingAddr = loadAddress(network, V1_5_CONTRACTS.YmtVesting);
  console.log(`   YmtVesting: ${ymtVestingAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployContract({
    name: CONTRACT_NAMES.YMT,
    contractName: V1_5_CONTRACTS.YMT,
    args: [ymtVestingAddr, adminAddr],
  });

  console.log(`\n✅ YMT deployed!`);
  console.log(`   Address: ${result.address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
