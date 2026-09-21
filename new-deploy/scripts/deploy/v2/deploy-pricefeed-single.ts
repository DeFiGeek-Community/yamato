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

  // ETH/USD オラクルアドレスを取得
  // - mainnet/sepolia: Chainlink の実オラクル
  // - localhost: ChainLinkMock（deploy-mocks で事前デプロイ）
  console.log('📖 Loading ETH/USD oracle address...');
  let chainlinkEthUsdAddress: string;
  if (network === 'mainnet') {
    chainlinkEthUsdAddress = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
  } else if (network === 'sepolia') {
    chainlinkEthUsdAddress = '0x694AA1769357215DE4FAC081bf1f309aDC325306';
  } else {
    chainlinkEthUsdAddress = loadAddress(network, 'ChainLinkMockEthUsd');
  }
  console.log(`   ETH/USD Oracle: ${chainlinkEthUsdAddress}`);
  console.log('✅ Oracle address loaded\n');

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
