import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';

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
  const yamatoAddr = loadAddress(network, getCurrencyContractName('YamatoERC1967Proxy', currency));
  const depositorAddr = loadAddress(network, getCurrencyContractName('YamatoDepositorERC1967Proxy', currency));
  const borrowerAddr = loadAddress(network, getCurrencyContractName('YamatoBorrowerERC1967Proxy', currency));
  const repayerAddr = loadAddress(network, getCurrencyContractName('YamatoRepayerERC1967Proxy', currency));
  const withdrawerAddr = loadAddress(network, getCurrencyContractName('YamatoWithdrawerERC1967Proxy', currency));
  const redeemerAddr = loadAddress(network, getCurrencyContractName('YamatoRedeemerERC1967Proxy', currency));
  const sweeperAddr = loadAddress(network, getCurrencyContractName('YamatoSweeperERC1967Proxy', currency));
  const poolAddr = loadAddress(network, getCurrencyContractName('PoolERC1967Proxy', currency));
  const priorityRegistryAddr = loadAddress(network, getCurrencyContractName('PriorityRegistryERC1967Proxy', currency));
  
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

  const yamato = await hre.viem.getContractAt('YamatoV4', yamatoAddr);

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

