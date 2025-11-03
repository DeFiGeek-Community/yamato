import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { getNetworkConfig } from '../../config/networks';
import { getCurrency } from '../core/currency-manager';
import { createAndProposeSafeTransaction } from '../core/safe-transaction';
import { V2_CONTRACTS, V2_CURRENCY_CONTRACTS, V1_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v2.0 ガバナンス移譲
 * 
 * 通貨別コントラクトのガバナンス権限をマルチシグに移譲します。
 * 
 * 実行方法:
 * - localhost: 直接トランザクション実行
 * - その他（sepolia, mainnet）: Safe Transaction提案
 * 
 * 対象コントラクト（通貨別）:
 * - YmtOS (共有)
 * - PriceFeed (通貨別)
 * - CurrencyOS (通貨別)
 * - Pool (通貨別)
 * - PriorityRegistry (通貨別)
 * - Yamato (通貨別)
 * - YamatoDepositor (通貨別)
 * - YamatoBorrower (通貨別)
 * - YamatoRepayer (通貨別)
 * - YamatoWithdrawer (通貨別)
 * - YamatoRedeemer (通貨別)
 * - YamatoSweeper (通貨別)
 * - ScoreRegistry (通貨別)
 * 
 * ⚠️ 注意:
 * - 本番環境では必ずマルチシグアドレスを設定してください
 * - ローカル環境ではテスト用アドレスを使用します
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);

  // マルチシグアドレスを取得
  const networkConfig = getNetworkConfig(network);
  const multisigAddr = isLocalhost
    ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // Anvilのアカウント#1（テスト用）
    : (networkConfig.safeAddress as `0x${string}`);

  if (!multisigAddr) {
    throw new Error(`SAFE_ADDRESS_${network.toUpperCase()} is not set in .env`);
  }

  console.log(`🔐 Multisig Address: ${multisigAddr}\n`);
  console.log('🔄 Transferring governance...\n');

  // contract-definitions.tsから定義を取得
  const priceFeedContractName = currency === 'CUSD' 
    ? V2_CONTRACTS.PriceFeedSingle 
    : V1_CONTRACTS.PriceFeed;

  // 共通関数を使用してアドレスを読み込み
  const contracts = [
    { name: CONTRACT_NAMES.YmtOS, contractName: V2_CONTRACTS.YmtOS, address: loadProxyAddress(network, CONTRACT_NAMES.YmtOS) },
    { name: `PriceFeed (${currency})`, contractName: priceFeedContractName, address: loadProxyAddress(network, currency === 'CUSD' ? CONTRACT_NAMES.PriceFeedSingle : CONTRACT_NAMES.PriceFeed, currency) },
    { name: `CurrencyOS (${currency})`, contractName: V2_CURRENCY_CONTRACTS.CurrencyOS, address: loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS, currency) },
    { name: `Pool (${currency})`, contractName: V2_CURRENCY_CONTRACTS.Pool, address: loadProxyAddress(network, CONTRACT_NAMES.Pool, currency) },
    { name: `PriorityRegistry (${currency})`, contractName: V2_CURRENCY_CONTRACTS.PriorityRegistry, address: loadProxyAddress(network, CONTRACT_NAMES.PriorityRegistry, currency) },
    { name: `Yamato (${currency})`, contractName: V2_CURRENCY_CONTRACTS.Yamato, address: loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency) },
    { name: `YamatoDepositor (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoDepositor, currency) },
    { name: `YamatoBorrower (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoBorrower, currency) },
    { name: `YamatoRepayer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoRepayer, currency) },
    { name: `YamatoWithdrawer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoWithdrawer, currency) },
    { name: `YamatoRedeemer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoRedeemer, currency) },
    { name: `YamatoSweeper (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoSweeper, currency) },
    { name: `ScoreRegistry (${currency})`, contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry, address: loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry, currency) },
  ];

  const publicClient = isLocalhost ? await hre.viem.getPublicClient() : null;
  let successCount = 0;

  for (const contract of contracts) {
    try {
      console.log(`🔄 [${successCount + 1}/${contracts.length}] ${contract.name}.setGovernance()...`);
      
      const contractInstance = await hre.viem.getContractAt(contract.contractName, contract.address);

      if (isLocalhost) {
        // ローカル環境: 直接実行
        const hash = await contractInstance.write.setGovernance([multisigAddr]);
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        console.log(`   📝 Transaction hash: ${hash}`);
        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
      } else {
        // 本番環境: Safe Transaction提案
        await createAndProposeSafeTransaction(
          contract.address,
          contractInstance.abi,
          'setGovernance',
          [multisigAddr],
          network
        );
      }

      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Governance transfer completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Currency: ${currency}`);
  console.log(`   Transferred: ${successCount}/${contracts.length} contracts`);
  console.log(`   Multisig: ${multisigAddr}`);
  console.log(`\n📝 Next step:`);
  console.log(`   Multisig must call acceptGovernance() on each contract`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
