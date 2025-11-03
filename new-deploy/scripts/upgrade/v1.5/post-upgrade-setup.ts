import hre from 'hardhat';
import { loadProxyAddress, loadAddress, type NetworkName } from '../../core/address-manager';
import { createAndProposeSafeTransaction } from '../../core/safe-transaction';
import { 
  V1_5_UPGRADE_IMPLEMENTATIONS, 
  V1_5_CONTRACTS,
  CONTRACT_NAMES 
} from '../../core/contract-definitions';

/**
 * v1.5 アップグレード後の初期設定
 * 
 * アップグレード後に必要な初期設定を実行します。
 * 
 * 実行方法:
 * - localhost: 直接トランザクション実行
 * - その他（sepolia, mainnet）: Safe Transaction提案
 * 
 * 実行内容:
 * 1. Yamato.setScoreRegistry() - ScoreRegistryアドレスを設定
 * 2. FeePool.setVeYMT() - veYMTアドレスを設定
 * 3. CurrencyOS.setYMT() - YMTアドレスを設定
 * 4. CurrencyOS.setVeYMT() - veYMTアドレスを設定
 * 5. CurrencyOS.setYmtMinter() - YmtMinterアドレスを設定
 * 6. CurrencyOS.setScoreWeightController() - ScoreWeightControllerアドレスを設定
 * 7. FeePool.toggleAllowCheckpointToken() - チェックポイント機能を有効化
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);
  console.log('⚙️  Executing post-upgrade setup...\n');

  // 必要なアドレスを読み込み（共通関数を使用）
  console.log('📖 Loading addresses...');
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
  const feePoolAddr = loadProxyAddress(network, CONTRACT_NAMES.FeePool);
  const currencyOSAddr = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS);
  const scoreRegistryAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry);
  const veYmtAddr = loadAddress(network, V1_5_CONTRACTS.veYMT);
  const ymtAddr = loadAddress(network, V1_5_CONTRACTS.YMT);
  const ymtMinterAddr = loadProxyAddress(network, CONTRACT_NAMES.YmtMinter);
  const scoreWeightControllerAddr = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
  
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   FeePool: ${feePoolAddr}`);
  console.log(`   CurrencyOS: ${currencyOSAddr}`);
  console.log(`   ScoreRegistry: ${scoreRegistryAddr}`);
  console.log(`   veYMT: ${veYmtAddr}`);
  console.log(`   YMT: ${ymtAddr}`);
  console.log(`   YmtMinter: ${ymtMinterAddr}`);
  console.log(`   ScoreWeightController: ${scoreWeightControllerAddr}`);
  console.log('✅ Addresses loaded\n');

  const publicClient = isLocalhost ? await hre.viem.getPublicClient() : null;
  let successCount = 0;
  const totalSteps = 7;

  // ヘルパー関数: ネットワークに応じてトランザクションを実行
  async function executeOrPropose(
    stepNum: number,
    contractName: string,
    contractAddress: string,
    functionName: string,
    args: any[]
  ) {
    console.log(`🔄 [${stepNum}/${totalSteps}] ${contractName}.${functionName}()...`);
    const contract = await hre.viem.getContractAt(contractName, contractAddress);

    if (isLocalhost) {
      // ローカル環境: 直接実行
      const hash = await (contract.write as any)[functionName](args);
      console.log(`   📝 Transaction hash: ${hash}`);
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    } else {
      // 本番環境: Safe Transaction提案
      await createAndProposeSafeTransaction(
        contractAddress,
        contract.abi,
        functionName,
        args,
        network
      );
    }
  }

  // 1. Yamato.setScoreRegistry()
  try {
    await executeOrPropose(
      1,
      V1_5_UPGRADE_IMPLEMENTATIONS.Yamato,
      yamatoAddr,
      'setScoreRegistry',
      [scoreRegistryAddr]
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // 2. FeePool.setVeYMT()
  try {
    await executeOrPropose(
      2,
      V1_5_UPGRADE_IMPLEMENTATIONS.FeePool,
      feePoolAddr,
      'setVeYMT',
      [veYmtAddr]
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // 3. CurrencyOS.setYMT()
  try {
    await executeOrPropose(
      3,
      V1_5_UPGRADE_IMPLEMENTATIONS.CurrencyOS,
      currencyOSAddr,
      'setYMT',
      [ymtAddr]
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // 4. CurrencyOS.setVeYMT()
  try {
    await executeOrPropose(
      4,
      V1_5_UPGRADE_IMPLEMENTATIONS.CurrencyOS,
      currencyOSAddr,
      'setVeYMT',
      [veYmtAddr]
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // 5. CurrencyOS.setYmtMinter()
  try {
    await executeOrPropose(
      5,
      V1_5_UPGRADE_IMPLEMENTATIONS.CurrencyOS,
      currencyOSAddr,
      'setYmtMinter',
      [ymtMinterAddr]
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // 6. CurrencyOS.setScoreWeightController()
  try {
    await executeOrPropose(
      6,
      V1_5_UPGRADE_IMPLEMENTATIONS.CurrencyOS,
      currencyOSAddr,
      'setScoreWeightController',
      [scoreWeightControllerAddr]
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  // 7. FeePool.toggleAllowCheckpointToken()
  try {
    await executeOrPropose(
      7,
      V1_5_UPGRADE_IMPLEMENTATIONS.FeePool,
      feePoolAddr,
      'toggleAllowCheckpointToken',
      []
    );
    successCount++;
  } catch (error) {
    console.error(`   ❌ Failed:`, error);
    throw error;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Post-upgrade setup completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Executed: ${successCount}/${totalSteps} setup functions`);
  console.log(`\n🎉 v1.5 upgrade is now complete!`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
