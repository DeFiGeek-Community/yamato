import hre from 'hardhat';
import { deployContract } from '../../core/contract-deployer-hh';
import { type NetworkName } from '../../core/address-manager';

/**
 * YmtVesting デプロイ
 * 
 * YMTトークンのベスティング（段階的付与）を管理するコントラクトです。
 * 非UUPSコントラクト（通常のコントラクト）です。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  const result = await deployContract({
    name: 'YmtVesting',
    contractName: 'YmtVesting',
    args: [],
  });

  console.log(`\n✅ YmtVesting deployed!`);
  console.log(`   Address: ${result.address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

