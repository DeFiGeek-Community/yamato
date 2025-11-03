import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';

/**
 * YmtOSにCurrencyOSを追加
 * 
 * YmtOS.addCurrencyOS()を実行します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log('⚙️  Adding CurrencyOS to YmtOS...\n');

  console.log('📖 Loading addresses...');
  const ymtOSAddr = loadAddress(network, 'YmtOSERC1967Proxy');
  const currencyOSAddr = loadAddress(network, getCurrencyContractName('CurrencyOSERC1967Proxy', currency));
  
  console.log(`   YmtOS: ${ymtOSAddr}`);
  console.log(`   CurrencyOS (${currency}): ${currencyOSAddr}`);
  console.log('✅ Addresses loaded\n');

  const ymtOS = await hre.viem.getContractAt('YmtOS', ymtOSAddr);

  console.log('🔄 Calling YmtOS.addCurrencyOS()...');
  const hash = await ymtOS.write.addCurrencyOS([currencyOSAddr]);

  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`   📝 Transaction hash: ${hash}`);
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  console.log(`✅ CurrencyOS (${currency}) added to YmtOS successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

