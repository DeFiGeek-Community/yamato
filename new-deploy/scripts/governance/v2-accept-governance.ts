import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { getCurrency } from '../core/currency-manager';
import { createAndProposeSafeTransaction } from '../core/safe-transaction';
import { V2_CONTRACTS, V2_CURRENCY_CONTRACTS, V1_CONTRACTS } from '../core/contract-definitions';

/**
 * v2.0 ガバナンス承認
 * 
 * マルチシグが通貨別コントラクトのガバナンス権限を承認します。
 * 
 * 実行方法:
 * - localhost: 直接トランザクション実行（テスト用）
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
 * - 本番環境では、マルチシグの署名者が実行する必要があります
 * - ローカル環境では、テスト用アカウント#1で実行します
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}`);
  console.log(`📝 Execution mode: ${isLocalhost ? 'Direct' : 'Safe Transaction'}\n`);

  // マルチシグアドレスを取得
  const multisigAddr = isLocalhost
    ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // Anvilのアカウント#1（テスト用）
    : (process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS as `0x${string}`);

  if (!multisigAddr) {
    throw new Error('UUPS_PROXY_ADMIN_MULTISIG_ADDRESS is not set in .env');
  }

  console.log(`🔐 Multisig Address: ${multisigAddr}\n`);
  console.log('🔄 Accepting governance...\n');

  // contract-definitions.tsから定義を取得
  const priceFeedContractName = currency === 'CUSD' 
    ? V2_CONTRACTS.PriceFeedSingle 
    : V1_CONTRACTS.PriceFeed;

  // 共通関数を使用してアドレスを読み込み
  const contracts = [
    { name: 'YmtOS', contractName: V2_CONTRACTS.YmtOS, address: loadProxyAddress(network, 'YmtOS') },
    { name: `PriceFeed (${currency})`, contractName: priceFeedContractName, address: loadProxyAddress(network, currency === 'CUSD' ? 'PriceFeedSingle' : 'PriceFeed', currency) },
    { name: `CurrencyOS (${currency})`, contractName: V2_CURRENCY_CONTRACTS.CurrencyOS, address: loadProxyAddress(network, 'CurrencyOS', currency) },
    { name: `Pool (${currency})`, contractName: V2_CURRENCY_CONTRACTS.Pool, address: loadProxyAddress(network, 'Pool', currency) },
    { name: `PriorityRegistry (${currency})`, contractName: V2_CURRENCY_CONTRACTS.PriorityRegistry, address: loadProxyAddress(network, 'PriorityRegistry', currency) },
    { name: `Yamato (${currency})`, contractName: V2_CURRENCY_CONTRACTS.Yamato, address: loadProxyAddress(network, 'Yamato', currency) },
    { name: `YamatoDepositor (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor, address: loadProxyAddress(network, 'YamatoDepositor', currency) },
    { name: `YamatoBorrower (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower, address: loadProxyAddress(network, 'YamatoBorrower', currency) },
    { name: `YamatoRepayer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer, address: loadProxyAddress(network, 'YamatoRepayer', currency) },
    { name: `YamatoWithdrawer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer, address: loadProxyAddress(network, 'YamatoWithdrawer', currency) },
    { name: `YamatoRedeemer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer, address: loadProxyAddress(network, 'YamatoRedeemer', currency) },
    { name: `YamatoSweeper (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper, address: loadProxyAddress(network, 'YamatoSweeper', currency) },
    { name: `ScoreRegistry (${currency})`, contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry, address: loadProxyAddress(network, 'ScoreRegistry', currency) },
  ];

  const publicClient = isLocalhost ? await hre.viem.getPublicClient() : null;
  let successCount = 0;

  // ローカル環境の場合、アカウント#1を使用
  const [, multisigSigner] = isLocalhost ? await hre.viem.getWalletClients() : [null, null];

  for (const contract of contracts) {
    try {
      console.log(`🔄 [${successCount + 1}/${contracts.length}] ${contract.name}.acceptGovernance()...`);
      
      const contractInstance = await hre.viem.getContractAt(contract.contractName, contract.address);

      if (isLocalhost && multisigSigner) {
        // ローカル環境: アカウント#1で直接実行
        const hash = await contractInstance.write.acceptGovernance({ account: multisigSigner.account });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        console.log(`   📝 Transaction hash: ${hash}`);
        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
      } else {
        // 本番環境: Safe Transaction提案
        await createAndProposeSafeTransaction(
          contract.address,
          contractInstance.abi,
          'acceptGovernance',
          [],
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
  console.log(`\n✅ Governance acceptance completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Currency: ${currency}`);
  console.log(`   Accepted: ${successCount}/${contracts.length} contracts`);
  console.log(`   Multisig: ${multisigAddr}`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
