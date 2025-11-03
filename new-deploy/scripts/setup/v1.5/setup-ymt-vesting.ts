import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_5_CONTRACTS } from '../../core/contract-definitions';

/**
 * YmtVesting.setYmtToken() 実行
 * 
 * YmtVestingコントラクトにYMTトークンのアドレスを設定します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading addresses...');
  const ymtVestingAddr = loadAddress(network, V1_5_CONTRACTS.YmtVesting);
  const ymtAddr = loadAddress(network, V1_5_CONTRACTS.YMT);
  console.log(`   YmtVesting: ${ymtVestingAddr}`);
  console.log(`   YMT: ${ymtAddr}`);
  console.log('✅ Addresses loaded\n');

  const ymtVesting = await hre.viem.getContractAt(V1_5_CONTRACTS.YmtVesting, ymtVestingAddr);
  const publicClient = await hre.viem.getPublicClient();

  // 既に設定済みかチェック
  const currentYmtAddr = await ymtVesting.read.ymtTokenAddress();
  if (currentYmtAddr.toLowerCase() === ymtAddr.toLowerCase()) {
    console.log('⏭️  YmtVesting.setYmtToken() already set. Skipping...\n');
    return;
  }

  console.log('🔄 Calling YmtVesting.setYmtToken()...');
  const hash = await ymtVesting.write.setYmtToken([ymtAddr]);
  
  console.log(`   📝 Transaction hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  console.log('\n✅ YmtVesting.setYmtToken() executed!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
