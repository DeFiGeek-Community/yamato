import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyInfo, getPriceFeedContractName, getCurrencyContractName } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * 通貨別CurrencyOS デプロイ
 * 
 * CURRENCY環境変数で指定された通貨のCurrencyOSインスタンスをデプロイします。
 * 
 * 使用方法:
 *   CURRENCY=CUSD npx hardhat run scripts/deploy/v2/deploy-currency-currencyos.ts --network localhost
 *   CURRENCY=CEUR npx hardhat run scripts/deploy/v2/deploy-currency-currencyos.ts --network localhost
 * 
 * ⚠️ 注意:
 * - 各通貨ごとに独立したCurrencyOSインスタンスが必要です
 * - 事前にその通貨のトークン、PriceFeed、FeePoolをデプロイしてください
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  const currencyInfo = getCurrencyInfo(currency);
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);

  console.log('📖 Loading dependencies...');
  const currencyAddr = loadAddress(network, currencyInfo.contractName);
  const priceFeedName = getPriceFeedContractName(currency);
  const priceFeedAddr = loadProxyAddress(network, priceFeedName, currency);
  const feePoolAddr = loadProxyAddress(network, CONTRACT_NAMES.FeePool); // FeePoolは全通貨共有
  
  console.log(`   ${currency}: ${currencyAddr}`);
  console.log(`   PriceFeed (${priceFeedName}): ${priceFeedAddr}`);
  console.log(`   FeePool (shared): ${feePoolAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: getCurrencyContractName('CurrencyOS', currency),
    contractName: V2_CURRENCY_CONTRACTS.CurrencyOS,
    initFunction: 'initialize',
    initArgs: [currencyAddr, priceFeedAddr, feePoolAddr],
  });

  console.log(`\n✅ CurrencyOS (${currency}) deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
