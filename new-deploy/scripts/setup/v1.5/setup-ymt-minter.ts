import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';

/**
 * YMT.setMinter() 実行
 * 
 * YMTトークンにMinter権限を持つコントラクト（YmtMinter）を設定します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading addresses...');
  const ymtAddr = loadAddress(network, 'YMT');
  const ymtMinterAddr = loadAddress(network, 'YmtMinterERC1967Proxy');
  console.log(`   YMT: ${ymtAddr}`);
  console.log(`   YmtMinter: ${ymtMinterAddr}`);
  console.log('✅ Addresses loaded\n');

  const ymt = await hre.viem.getContractAt('YMT', ymtAddr);
  const publicClient = await hre.viem.getPublicClient();

  // 既に設定済みかチェック
  const currentMinter = await ymt.read.ymtMinter();
  if (currentMinter.toLowerCase() === ymtMinterAddr.toLowerCase()) {
    console.log('⏭️  YMT.setMinter() already set. Skipping...\n');
    return;
  }

  console.log('🔄 Calling YMT.setMinter()...');
  const hash = await ymt.write.setMinter([ymtMinterAddr]);
  
  console.log(`   📝 Transaction hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  console.log('\n✅ YMT.setMinter() executed!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

