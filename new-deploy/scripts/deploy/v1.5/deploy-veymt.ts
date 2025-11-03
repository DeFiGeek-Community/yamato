import hre from 'hardhat';
import { deployContract } from '../../core/contract-deployer-hh';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_5_CONTRACTS } from '../../core/contract-definitions';

/**
 * veYMT デプロイ
 * 
 * Vote-Escrowed YMT - YMTをロックしてガバナンス投票権を得るコントラクトです。
 * 非UUPSコントラクト（通常のコントラクト）です。
 * 
 * コンストラクタ引数:
 * - _ymtAddr: YMTトークンアドレス
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const ymtAddr = loadAddress(network, V1_5_CONTRACTS.YMT);
  console.log(`   YMT: ${ymtAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployContract({
    name: 'veYMT',
    contractName: V1_5_CONTRACTS.veYMT,
    args: [ymtAddr],
  });

  console.log(`\n✅ veYMT deployed!`);
  console.log(`   Address: ${result.address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
