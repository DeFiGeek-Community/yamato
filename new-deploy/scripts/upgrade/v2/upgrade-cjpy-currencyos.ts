import hre from 'hardhat';
import { loadProxyAddress, saveImplementationAddress, type NetworkName } from '../../core/address-manager';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';
import { V2_UPGRADE_IMPLEMENTATIONS, V2_UPGRADE_PROXIES, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * CJPY CurrencyOS v3→v4 アップグレード ＋ YmtOS 配線
 *
 * CurrencyOSV4 の YMT()/veYMT()/ymtMinter()/scoreWeightController() は
 * `IYmtOS(ymtOS()).XXX()` に委譲する実装（contracts/CurrencyOSV4.sol）。
 * そのため upgradeTo で V4 化しただけだと ymtOS 未設定でこれらが revert する。
 * 本スクリプトで upgradeTo に続けて setYmtOS まで行い、
 * ゲッターが即座に解決できる状態にする。
 *
 * 実行方法:
 * - localhost: 直接トランザクション実行
 * - その他（sepolia, mainnet）: Safe Transaction提案
 *   （upgradeTo と setYmtOS を連番 nonce で個別提案。nonce 順で upgradeTo→setYmtOS に実行される）
 *
 * ⚠️ 事前に YmtOS をデプロイしておくこと（deploy-ymtos.ts）。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';

  console.log(`\n🌐 Network: ${network}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);
  console.log('🔄 Upgrading CJPY CurrencyOS V3 → V4...\n');

  const publicClient = await hre.viem.getPublicClient();

  // 1. 新しい実装をデプロイ
  console.log('📦 Deploying CurrencyOSV4 implementation...');
  const implementation = await hre.viem.deployContract(V2_UPGRADE_IMPLEMENTATIONS.CurrencyOS, []);
  const newImplAddress = implementation.address;
  console.log(`   ✅ New implementation deployed: ${newImplAddress}`);
  saveImplementationAddress(network, CONTRACT_NAMES.CurrencyOS, newImplAddress);

  // 2. プロキシをアップグレード
  const proxyAddress = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS);
  console.log(`   📍 Proxy: ${proxyAddress}\n`);
  const proxy = await hre.viem.getContractAt(V2_UPGRADE_PROXIES.CurrencyOS, proxyAddress);

  if (isLocalhost) {
    console.log('🔄 Calling upgradeTo()...');
    const hash = await proxy.write.upgradeTo([newImplAddress]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   📝 Transaction hash: ${hash}`);
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  } else {
    console.log('📝 Proposing upgradeTo()...');
    await createAndProposeSafeTransaction(proxyAddress, proxy.abi, 'upgradeTo', [newImplAddress], network);
  }

  // 3. YmtOS を配線（V4 の委譲ゲッターが revert しないために必須）
  const ymtOSAddr = loadProxyAddress(network, CONTRACT_NAMES.YmtOS);
  // setYmtOS/ymtOS は V4 のみのため V4 ABI で接続する
  const proxyV4 = await hre.viem.getContractAt(V2_UPGRADE_IMPLEMENTATIONS.CurrencyOS, proxyAddress);
  console.log(`\n🔗 Wiring YmtOS: ${ymtOSAddr}`);

  if (isLocalhost) {
    // 既に設定済みならスキップ（冪等）
    const current = (await proxyV4.read.ymtOS()) as `0x${string}`;
    if (current.toLowerCase() === ymtOSAddr.toLowerCase()) {
      console.log('   ⏭️  setYmtOS skipped (already set)');
    } else {
      console.log('🔄 Calling setYmtOS()...');
      const hash = await proxyV4.write.setYmtOS([ymtOSAddr]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   📝 Transaction hash: ${hash}`);
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    }
  } else {
    console.log('📝 Proposing setYmtOS()...');
    await createAndProposeSafeTransaction(proxyAddress, proxyV4.abi, 'setYmtOS', [ymtOSAddr], network);
  }

  console.log(`\n✅ CJPY CurrencyOS upgrade + YmtOS wiring completed!`);
  console.log(`   Proxy: ${proxyAddress}`);
  console.log(`   New Implementation: ${newImplAddress}`);
  console.log(`   YmtOS: ${ymtOSAddr}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
