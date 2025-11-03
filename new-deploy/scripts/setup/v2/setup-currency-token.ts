import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName, getCurrencyInfo } from '../../core/currency-manager';

/**
 * 通貨トークンにCurrencyOSを設定とガバナンス権限の放棄
 * 
 * Currency.setCurrencyOS() + Currency.revokeGovernance()を実行します。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  const currencyInfo = getCurrencyInfo(currency);
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log(`⚙️  Setting CurrencyOS and revoking governance for ${currency}...\n`);

  console.log('📖 Loading addresses...');
  const currencyAddr = loadAddress(network, currencyInfo.contractName);
  const currencyOSAddr = loadAddress(network, getCurrencyContractName('CurrencyOSERC1967Proxy', currency));
  
  console.log(`   ${currency}: ${currencyAddr}`);
  console.log(`   CurrencyOS: ${currencyOSAddr}`);
  console.log('✅ Addresses loaded\n');

  const currencyContract = await hre.viem.getContractAt('CurrencyV2', currencyAddr);
  const publicClient = await hre.viem.getPublicClient();

  // 1. setCurrencyOS
  console.log(`🔄 Calling ${currency}.setCurrencyOS()...`);
  const hash1 = await currencyContract.write.setCurrencyOS([currencyOSAddr]);
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
  console.log(`   📝 Transaction hash: ${hash1}`);
  console.log(`   ✅ setCurrencyOS() confirmed in block ${receipt1.blockNumber}\n`);

  // 2. revokeGovernance
  console.log(`🔄 Calling ${currency}.revokeGovernance()...`);
  const hash2 = await currencyContract.write.revokeGovernance();
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
  console.log(`   📝 Transaction hash: ${hash2}`);
  console.log(`   ✅ revokeGovernance() confirmed in block ${receipt2.blockNumber}\n`);

  console.log(`✅ ${currency} setup completed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

