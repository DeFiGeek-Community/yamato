import hre from 'hardhat';
import { loadAddress, saveAddress, type NetworkName } from '../../core/address-manager';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';

/**
 * CJPY CurrencyOS v3→v4 アップグレード
 * 
 * CJPYのCurrencyOSをV3からV4にアップグレードします。
 * 
 * 実行方法:
 * - localhost: 直接トランザクション実行
 * - その他（sepolia, mainnet）: Safe Transaction提案
 * 
 * ⚠️ 注意:
 * - 事前にCurrencyOSV4実装をデプロイしてください
 * - 本番環境ではマルチシグの承認が必要です
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);
  console.log('🔄 Upgrading CJPY CurrencyOS V3 → V4...\n');

  // 1. 新しい実装をデプロイ
  console.log('📦 Deploying CurrencyOSV4 implementation...');
  const implementation = await hre.viem.deployContract('CurrencyOSV4', []);
  const newImplAddress = implementation.address;
  console.log(`   ✅ New implementation deployed: ${newImplAddress}`);
  
  // アドレスを保存
  saveAddress(network, 'CurrencyOSV4Impl', newImplAddress);

  // 2. プロキシをアップグレード
  const proxyAddress = loadAddress(network, 'CurrencyOSERC1967Proxy');
  console.log(`   📍 Proxy: ${proxyAddress}\n`);

  const proxy = await hre.viem.getContractAt('CurrencyOSV3', proxyAddress);

  if (isLocalhost) {
    // ローカル環境: 直接実行
    console.log('🔄 Calling upgradeTo()...');
    const hash = await proxy.write.upgradeTo([newImplAddress]);
    
    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log(`   📝 Transaction hash: ${hash}`);
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  } else {
    // 本番環境: Safe Transaction提案
    console.log('📝 Proposing upgradeTo()...');
    await createAndProposeSafeTransaction(
      proxyAddress,
      proxy.abi,
      'upgradeTo',
      [newImplAddress],
      network
    );
  }

  console.log(`\n✅ CJPY CurrencyOS upgrade completed!`);
  console.log(`   Proxy: ${proxyAddress}`);
  console.log(`   New Implementation: ${newImplAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

