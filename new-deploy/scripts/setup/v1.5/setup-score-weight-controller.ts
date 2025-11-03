import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { parseEther } from 'viem';
import { V1_5_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * ScoreWeightController.addScore() 実行
 * 
 * ScoreWeightControllerにScoreRegistryを登録し、ウェイトを設定します。
 * デフォルトウェイト: 1 ether
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading addresses...');
  const controllerAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
  const scoreRegistryAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry);
  console.log(`   ScoreWeightController: ${controllerAddr}`);
  console.log(`   ScoreRegistry: ${scoreRegistryAddr}`);
  console.log('✅ Addresses loaded\n');

  const controller = await hre.viem.getContractAt(V1_5_CONTRACTS.ScoreWeightController, controllerAddr);
  const publicClient = await hre.viem.getPublicClient();

  // ウェイト（デフォルト: 1 ether）
  const weight = parseEther('1');
  console.log(`⚖️  Weight: ${weight} (1 ether)\n`);

  console.log('🔄 Calling ScoreWeightController.addScore()...');
  const hash = await controller.write.addScore([scoreRegistryAddr, weight]);
  
  console.log(`   📝 Transaction hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  console.log('\n✅ ScoreWeightController.addScore() executed!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
