import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../core/address-manager';
import { getCurrency, getCurrencyContractName, getPriceFeedContractName } from '../core/currency-manager';
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

  // アドレスを読み込み
  console.log('📖 Loading addresses...');
  const ymtOSAddr = loadAddress(network, 'YmtOSERC1967Proxy');
  const priceFeedName = getPriceFeedContractName(currency);
  const priceFeedAddr = loadAddress(network, getCurrencyContractName(`${priceFeedName}ERC1967Proxy`, currency));
  const currencyOSAddr = loadAddress(network, getCurrencyContractName('CurrencyOSERC1967Proxy', currency));
  const poolAddr = loadAddress(network, getCurrencyContractName('PoolERC1967Proxy', currency));
  const priorityRegistryAddr = loadAddress(network, getCurrencyContractName('PriorityRegistryERC1967Proxy', currency));
  const yamatoAddr = loadAddress(network, getCurrencyContractName('YamatoERC1967Proxy', currency));
  const depositorAddr = loadAddress(network, getCurrencyContractName('YamatoDepositorERC1967Proxy', currency));
  const borrowerAddr = loadAddress(network, getCurrencyContractName('YamatoBorrowerERC1967Proxy', currency));
  const repayerAddr = loadAddress(network, getCurrencyContractName('YamatoRepayerERC1967Proxy', currency));
  const withdrawerAddr = loadAddress(network, getCurrencyContractName('YamatoWithdrawerERC1967Proxy', currency));
  const redeemerAddr = loadAddress(network, getCurrencyContractName('YamatoRedeemerERC1967Proxy', currency));
  const sweeperAddr = loadAddress(network, getCurrencyContractName('YamatoSweeperERC1967Proxy', currency));
  const scoreRegistryAddr = loadAddress(network, getCurrencyContractName('ScoreRegistryERC1967Proxy', currency));
  console.log('✅ Addresses loaded\n');

  // contract-definitions.tsから定義を取得
  const priceFeedContractName = currency === 'CUSD' 
    ? V2_CONTRACTS.PriceFeedSingle 
    : V1_CONTRACTS.PriceFeed;

  const contracts = [
    { name: 'YmtOS', address: ymtOSAddr, contractName: V2_CONTRACTS.YmtOS },
    { name: `PriceFeed (${currency})`, address: priceFeedAddr, contractName: priceFeedContractName },
    { name: `CurrencyOS (${currency})`, address: currencyOSAddr, contractName: V2_CURRENCY_CONTRACTS.CurrencyOS },
    { name: `Pool (${currency})`, address: poolAddr, contractName: V2_CURRENCY_CONTRACTS.Pool },
    { name: `PriorityRegistry (${currency})`, address: priorityRegistryAddr, contractName: V2_CURRENCY_CONTRACTS.PriorityRegistry },
    { name: `Yamato (${currency})`, address: yamatoAddr, contractName: V2_CURRENCY_CONTRACTS.Yamato },
    { name: `YamatoDepositor (${currency})`, address: depositorAddr, contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor },
    { name: `YamatoBorrower (${currency})`, address: borrowerAddr, contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower },
    { name: `YamatoRepayer (${currency})`, address: repayerAddr, contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer },
    { name: `YamatoWithdrawer (${currency})`, address: withdrawerAddr, contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer },
    { name: `YamatoRedeemer (${currency})`, address: redeemerAddr, contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer },
    { name: `YamatoSweeper (${currency})`, address: sweeperAddr, contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper },
    { name: `ScoreRegistry (${currency})`, address: scoreRegistryAddr, contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry },
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
