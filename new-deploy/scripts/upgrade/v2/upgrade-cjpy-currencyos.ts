import hre from 'hardhat';
import { loadProxyAddress, saveImplementationAddress, type NetworkName } from '../../core/address-manager';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';
import { V2_UPGRADE_IMPLEMENTATIONS, V2_UPGRADE_PROXIES, CONTRACT_NAMES } from '../../core/contract-definitions';

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
  const implementation = await hre.viem.deployContract(V2_UPGRADE_IMPLEMENTATIONS.CurrencyOS, []);
  const newImplAddress = implementation.address;
  console.log(`   ✅ New implementation deployed: ${newImplAddress}`);
  
  // アドレスを保存（共通関数を使用）
  saveImplementationAddress(network, CONTRACT_NAMES.CurrencyOS, newImplAddress);

  // 2. プロキシをアップグレード（共通関数を使用）
  const proxyAddress = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS);
  console.log(`   📍 Proxy: ${proxyAddress}\n`);

  const proxy = await hre.viem.getContractAt(V2_UPGRADE_PROXIES.CurrencyOS, proxyAddress);

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
