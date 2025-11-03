import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS } from '../../core/contract-definitions';

/**
 * 通貨別YamatoにScoreRegistryを設定
 * 
 * Yamato.setScoreRegistry()を実行します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log('⚙️  Setting ScoreRegistry in Yamato...\n');

  console.log('📖 Loading addresses...');
  const yamatoAddr = loadAddress(network, getCurrencyContractName('YamatoERC1967Proxy', currency));
  const scoreRegistryAddr = loadAddress(network, getCurrencyContractName('ScoreRegistryERC1967Proxy', currency));
  
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   ScoreRegistry: ${scoreRegistryAddr}`);
  console.log('✅ Addresses loaded\n');

  const yamato = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.Yamato, yamatoAddr);

  console.log('🔄 Calling Yamato.setScoreRegistry()...');
  const hash = await yamato.write.setScoreRegistry([scoreRegistryAddr]);

  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`   📝 Transaction hash: ${hash}`);
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  console.log(`✅ ScoreRegistry set in Yamato successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
