import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../core/address-manager';

/**
 * v1.5 ガバナンス権限をマルチシグに移譲
 * 
 * YMT関連コントラクトの管理権限をマルチシグウォレットに移譲します。
 * 
 * 対象:
 * - YMT.setAdmin() -> UUPS_PROXY_ADMIN_MULTISIG_ADDRESS
 * - YmtVesting.setAdmin() -> COMMUNITY_MULTISIG_ADDRESS
 * - YmtMinter.setGovernance() -> UUPS_PROXY_ADMIN_MULTISIG_ADDRESS
 * - ScoreWeightController.setGovernance() -> UUPS_PROXY_ADMIN_MULTISIG_ADDRESS
 * - ScoreRegistry.setGovernance() -> UUPS_PROXY_ADMIN_MULTISIG_ADDRESS
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔐 Transferring v1.5 governance to multisig on ${network}...\n`);

  // マルチシグアドレスを環境変数から取得
  const multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  if (!multisigAddr) {
    throw new Error('UUPS_PROXY_ADMIN_MULTISIG_ADDRESS is not set in .env');
  }
  
  const communityMultisigAddr = process.env.COMMUNITY_MULTISIG_ADDRESS;
  if (!communityMultisigAddr) {
    throw new Error('COMMUNITY_MULTISIG_ADDRESS is not set in .env');
  }

  console.log(`📝 UUPS Proxy Admin Multisig: ${multisigAddr}`);
  console.log(`📝 Community Multisig: ${communityMultisigAddr}\n`);

  const publicClient = await hre.viem.getPublicClient();
  let successCount = 0;

  // YMT.setAdmin()
  try {
    console.log(`🔄 [1/5] YMT.setAdmin()...`);
    const ymtAddr = loadAddress(network, 'YMT');
    const ymt = await hre.viem.getContractAt('YMT', ymtAddr);
    
    const hash = await ymt.write.setAdmin([multisigAddr as `0x${string}`]);
    console.log(`   📝 Transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // YmtVesting.setAdmin()
  try {
    console.log(`\n🔄 [2/5] YmtVesting.setAdmin()...`);
    const ymtVestingAddr = loadAddress(network, 'YmtVesting');
    const ymtVesting = await hre.viem.getContractAt('YmtVesting', ymtVestingAddr);
    
    const hash = await ymtVesting.write.setAdmin([communityMultisigAddr as `0x${string}`]);
    console.log(`   📝 Transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // YmtMinter.setGovernance()
  try {
    console.log(`\n🔄 [3/5] YmtMinter.setGovernance()...`);
    const ymtMinterAddr = loadAddress(network, 'YmtMinterERC1967Proxy');
    const ymtMinter = await hre.viem.getContractAt('YmtMinter', ymtMinterAddr);
    
    const hash = await ymtMinter.write.setGovernance([multisigAddr as `0x${string}`]);
    console.log(`   📝 Transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // ScoreWeightController.setGovernance()
  try {
    console.log(`\n🔄 [4/5] ScoreWeightController.setGovernance()...`);
    const controllerAddr = loadAddress(network, 'ScoreWeightControllerERC1967Proxy');
    const controller = await hre.viem.getContractAt('ScoreWeightController', controllerAddr);
    
    const hash = await controller.write.setGovernance([multisigAddr as `0x${string}`]);
    console.log(`   📝 Transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // ScoreRegistry.setGovernance()
  try {
    console.log(`\n🔄 [5/5] ScoreRegistry.setGovernance()...`);
    const scoreRegistryAddr = loadAddress(network, 'ScoreRegistryERC1967Proxy');
    const scoreRegistry = await hre.viem.getContractAt('ScoreRegistry', scoreRegistryAddr);
    
    const hash = await scoreRegistry.write.setGovernance([multisigAddr as `0x${string}`]);
    console.log(`   📝 Transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n🎉 v1.5 Governance transfer completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total contracts: ${successCount}/5`);
  console.log(`   UUPS Proxy Admin Multisig: ${multisigAddr}`);
  console.log(`   Community Multisig: ${communityMultisigAddr}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Switch PRIVATE_KEY in .env to multisig signer's key`);
  console.log(`   2. Run: npx hardhat run scripts/governance/v1.5-accept-governance.ts --network ${network}`);
  console.log(`\n⚠️  Warning: Contract upgrades now require multisig approval!`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

