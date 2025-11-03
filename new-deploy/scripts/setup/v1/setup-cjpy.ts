import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔧 Setting CurrencyOS and revoking governance for CJPY on ${network}...\n`);

  // アドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const cjpyAddress = loadAddress(network, V1_CONTRACTS.CJPY);
  const currencyOSAddress = loadAddress(network, 'CurrencyOSERC1967Proxy');
  console.log('✅ Addresses loaded\n');

  // CJPYコントラクトを取得
  const cjpy = await hre.viem.getContractAt(V1_CONTRACTS.CJPY, cjpyAddress);
  const publicClient = await hre.viem.getPublicClient();

  // CJPY.setCurrencyOS()を実行
  console.log('🚀 Executing CJPY.setCurrencyOS()...');
  const setCurrencyOSHash = await cjpy.write.setCurrencyOS([currencyOSAddress], {
    gas: 10000000n,
  });

  console.log(`  📝 Transaction hash: ${setCurrencyOSHash}`);
  const setCurrencyOSReceipt = await publicClient.waitForTransactionReceipt({ hash: setCurrencyOSHash });
  console.log(`  ✅ setCurrencyOS() confirmed in block ${setCurrencyOSReceipt.blockNumber}`);

  // CJPY.revokeGovernance()を実行
  console.log('\n🚀 Executing CJPY.revokeGovernance()...');
  const revokeHash = await cjpy.write.revokeGovernance();

  console.log(`  📝 Transaction hash: ${revokeHash}`);
  const revokeReceipt = await publicClient.waitForTransactionReceipt({ hash: revokeHash });
  console.log(`  ✅ revokeGovernance() confirmed in block ${revokeReceipt.blockNumber}`);

  console.log(`\n✅ CJPY setup completed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
