import hre from 'hardhat';
import { parseEther } from 'viem';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency } from '../../core/currency-manager';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';
import { V2_UPGRADE_IMPLEMENTATIONS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * 通貨別 ScoreRegistry を ScoreWeightController にゲージ登録
 *
 * `ScoreWeightController.addScore(currencyScoreRegistry, weight)` を実行する。
 *
 * ⚠️ これを行わないと当該通貨の ScoreRegistry が SWC のゲージとして認識されず、
 *    YMT 発行 / スコア配分が機能しない（中核の deposit/borrow 等には影響しない）。
 *
 * 実行方法:
 * - localhost: 直接実行
 * - その他（sepolia, mainnet）: Safe Transaction提案（SWC の governance は多重署名）
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  const currency = getCurrency();

  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);

  console.log('📖 Loading addresses...');
  const controllerAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
  const scoreRegistryAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry, currency);
  const weight = parseEther('1');
  console.log(`   ScoreWeightController: ${controllerAddr}`);
  console.log(`   ScoreRegistry (${currency}): ${scoreRegistryAddr}`);
  console.log(`   Weight: ${weight} (1 ether)\n`);

  // V2 で addScore / getScoreWeight を使う
  const controller = await hre.viem.getContractAt(
    V2_UPGRADE_IMPLEMENTATIONS.ScoreWeightController,
    controllerAddr
  );

  if (isLocalhost) {
    // 既に登録済みならスキップ（冪等）
    let already = false;
    try {
      const w = (await controller.read.getScoreWeight([scoreRegistryAddr])) as bigint;
      already = w > 0n;
    } catch {
      already = false;
    }

    if (already) {
      console.log('   ⏭️  addScore skipped (already registered)');
    } else {
      console.log('🔄 Calling ScoreWeightController.addScore()...');
      const hash = await controller.write.addScore([scoreRegistryAddr, weight]);
      const publicClient = await hre.viem.getPublicClient();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   📝 Transaction hash: ${hash}`);
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    }
  } else {
    console.log('📝 Proposing addScore()...');
    await createAndProposeSafeTransaction(
      controllerAddr,
      controller.abi,
      'addScore',
      [scoreRegistryAddr, weight],
      network
    );
  }

  console.log(`\n✅ ScoreWeightController.addScore (${currency}) completed!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
