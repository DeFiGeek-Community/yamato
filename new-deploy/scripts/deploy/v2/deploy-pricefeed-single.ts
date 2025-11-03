import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrencyContractName } from '../../core/currency-manager';
import { V2_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * PriceFeedSingle デプロイ
 * 
 * CUSD用のプライスフィード
 * 
 * ⚠️ 注意:
 * - PriceFeedSingleはETH/USDオラクルを必要とします
 * - ローカル環境ではChainLinkMockEthUsdを使用します
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // モックオラクルアドレスを読み込む
  console.log('📖 Loading mock oracle address...');
  const chainlinkEthUsdAddress = loadAddress(network, 'ChainLinkMockEthUsd');
  console.log(`   ETH/USD Oracle: ${chainlinkEthUsdAddress}`);
  console.log('✅ Mock address loaded\n');

  // PriceFeedSingleはCUSD専用
  const result = await deployUUPS({
    name: getCurrencyContractName(CONTRACT_NAMES.PriceFeedSingle, 'CUSD'),
    contractName: V2_CONTRACTS.PriceFeedSingle,
    initFunction: 'initialize',
    initArgs: [chainlinkEthUsdAddress],
  });

  console.log(`\n✅ PriceFeedSingle deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}`);
  console.log(`\n📝 Note:`);
  console.log(`   This PriceFeed returns a fixed price of 1.0 USD\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
