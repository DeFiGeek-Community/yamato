import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * 通貨別Pool デプロイ
 * 
 * CURRENCY環境変数で指定された通貨のPoolインスタンスをデプロイします。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency);
  console.log(`   Yamato (${currency}): ${yamatoAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: getCurrencyContractName(CONTRACT_NAMES.Pool, currency),
    contractName: V2_CURRENCY_CONTRACTS.Pool,
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
  });

  console.log(`\n✅ Pool (${currency}) deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
