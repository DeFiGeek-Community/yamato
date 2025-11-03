import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS } from '../../core/contract-definitions';

/**
 * 通貨別CurrencyOSにYamatoを追加
 * 
 * CurrencyOS.addYamato()を実行します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log('⚙️  Adding Yamato to CurrencyOS...\n');

  console.log('📖 Loading addresses...');
  const currencyOSAddr = loadProxyAddress(network, 'CurrencyOS', currency);
  const yamatoAddr = loadProxyAddress(network, 'Yamato', currency);
  
  console.log(`   CurrencyOS: ${currencyOSAddr}`);
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log('✅ Addresses loaded\n');

  const currencyOS = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.CurrencyOS, currencyOSAddr);

  console.log('🔄 Calling CurrencyOS.addYamato()...');
  const hash = await currencyOS.write.addYamato([yamatoAddr]);

  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`   📝 Transaction hash: ${hash}`);
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  console.log(`✅ Yamato added to CurrencyOS successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
