import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS, V2_CONTRACTS } from '../../core/contract-definitions';

/**
 * 通貨別CurrencyOSにYmtOSを設定
 * 
 * CurrencyOS.setYmtOS()を実行します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log('⚙️  Setting YmtOS in CurrencyOS...\n');

  console.log('📖 Loading addresses...');
  const currencyOSAddr = loadAddress(network, getCurrencyContractName('CurrencyOSERC1967Proxy', currency));
  const ymtOSAddr = loadAddress(network, 'YmtOSERC1967Proxy');
  
  console.log(`   CurrencyOS: ${currencyOSAddr}`);
  console.log(`   YmtOS: ${ymtOSAddr}`);
  console.log('✅ Addresses loaded\n');

  const currencyOS = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.CurrencyOS, currencyOSAddr);

  console.log('🔄 Calling CurrencyOS.setYmtOS()...');
  const hash = await currencyOS.write.setYmtOS([ymtOSAddr]);

  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`   📝 Transaction hash: ${hash}`);
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);
  console.log(`✅ YmtOS set in CurrencyOS successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
