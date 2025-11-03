import hre from 'hardhat';
import { deployContract } from '../../core/contract-deployer-hh';
import { type NetworkName } from '../../core/address-manager';

/**
 * CEUR デプロイ
 * 
 * Convertible EUR Token - ユーロ連動ステーブルコイン
 * 
 * ⚠️ 注意:
 * - 非UUPSコントラクト（アップグレード不可）
 * - コンストラクタで初期化されます
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  const result = await deployContract({
    name: 'CEUR',
    contractName: 'CEUR',
    args: [], // コンストラクタ引数なし
  });

  console.log(`\n✅ CEUR deployed!`);
  console.log(`   Address: ${result.address}`);
  console.log(`\n📝 Token Info:`);
  console.log(`   Name: Convertible EUR Token`);
  console.log(`   Symbol: CEUR\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

