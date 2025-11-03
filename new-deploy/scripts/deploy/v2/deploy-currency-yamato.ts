import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, saveAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';

/**
 * 通貨別Yamato デプロイ
 * 
 * CURRENCY環境変数で指定された通貨のYamatoインスタンスをデプロイします。
 * 
 * 使用方法:
 *   CURRENCY=CUSD npx hardhat run scripts/deploy/v2/deploy-currency-yamato.ts --network localhost
 *   CURRENCY=CEUR npx hardhat run scripts/deploy/v2/deploy-currency-yamato.ts --network localhost
 * 
 * ⚠️ 注意:
 * - 各通貨ごとに独立したYamatoインスタンスが必要です
 * - 事前にその通貨のCurrencyOSをデプロイしてください
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);

  console.log('📖 Loading dependencies...');
  const currencyOSAddr = loadAddress(network, getCurrencyContractName('CurrencyOSERC1967Proxy', currency));
  console.log(`   CurrencyOS (${currency}): ${currencyOSAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: getCurrencyContractName('Yamato', currency),
    contractName: 'YamatoV4',
    initFunction: 'initialize',
    initArgs: [currencyOSAddr],
  });

  console.log(`\n✅ Yamato (${currency}) deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

