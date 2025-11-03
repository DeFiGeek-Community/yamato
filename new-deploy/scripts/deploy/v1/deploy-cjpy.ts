import hre from 'hardhat';
import { deployContract } from '../../core/contract-deployer-hh';
import type { NetworkName } from '../../core/address-manager';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // CJPYをデプロイ
  const result = await deployContract({
    name: 'CJPY',
    contractName: 'CJPY',
    args: [], // CJPYはコンストラクタ引数なし
  });

  console.log(`\n✅ CJPY deployed at: ${result.address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

