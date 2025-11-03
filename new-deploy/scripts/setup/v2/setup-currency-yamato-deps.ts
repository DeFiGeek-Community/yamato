import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * 通貨別Yamato依存関係設定
 * 
 * Yamato.setDeps()を実行して、全てのアクションコントラクトとサポートコントラクトを登録します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log('⚙️  Setting Yamato dependencies...\n');

  console.log('📖 Loading addresses...');
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency);
  const depositorAddr = loadProxyAddress(network, CONTRACT_NAMES.YamatoDepositor, currency);
  const borrowerAddr = loadProxyAddress(network, CONTRACT_NAMES.YamatoBorrower, currency);
  const repayerAddr = loadProxyAddress(network, CONTRACT_NAMES.YamatoRepayer, currency);
  const withdrawerAddr = loadProxyAddress(network, CONTRACT_NAMES.YamatoWithdrawer, currency);
  const redeemerAddr = loadProxyAddress(network, CONTRACT_NAMES.YamatoRedeemer, currency);
  const sweeperAddr = loadProxyAddress(network, CONTRACT_NAMES.YamatoSweeper, currency);
  const poolAddr = loadProxyAddress(network, CONTRACT_NAMES.Pool, currency);
  const priorityRegistryAddr = loadProxyAddress(network, CONTRACT_NAMES.PriorityRegistry, currency);
  
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   YamatoDepositor: ${depositorAddr}`);
  console.log(`   YamatoBorrower: ${borrowerAddr}`);
  console.log(`   YamatoRepayer: ${repayerAddr}`);
  console.log(`   YamatoWithdrawer: ${withdrawerAddr}`);
  console.log(`   YamatoRedeemer: ${redeemerAddr}`);
  console.log(`   YamatoSweeper: ${sweeperAddr}`);
  console.log(`   Pool: ${poolAddr}`);
  console.log(`   PriorityRegistry: ${priorityRegistryAddr}`);
  console.log('✅ Addresses loaded\n');

  const yamato = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.Yamato, yamatoAddr);

  console.log('🔄 Calling Yamato.setDeps()...');
  const hash = await yamato.write.setDeps([
    depositorAddr,
    borrowerAddr,
    repayerAddr,
    withdrawerAddr,
    redeemerAddr,
    sweeperAddr,
    poolAddr,
    priorityRegistryAddr,
  ]);

  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`   📝 Transaction hash: ${hash}`);
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  console.log(`✅ Yamato dependencies set successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
