import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { getCurrencyContractName } from '../../core/currency-manager';
import { V1_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * PriceFeed (EUR用) デプロイ
 * 
 * CEUR用のプライスフィード（PriceFeedV3を使用）
 * 
 * ⚠️ 注意:
 * - PriceFeedV3はETH/USDとEUR/USDオラクルを必要とします
 * - ローカル環境ではChainLinkMockEthUsdとChainLinkMockEurUsdを使用します
 * - 本番環境（mainnet, sepolia）ではChainlinkの実際のオラクルアドレスを使用します
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // モックオラクルアドレスを読み込む
  console.log('📖 Loading oracle addresses...');
  
  let chainlinkEthUsdAddress: string;
  let chainlinkEurUsdAddress: string;

  if (network === 'mainnet') {
    chainlinkEthUsdAddress = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
    chainlinkEurUsdAddress = '0xb49f677943BC038e9857d61E7d053CaA2C1734C1';
  } else if (network === 'sepolia') {
    chainlinkEthUsdAddress = '0x694AA1769357215DE4FAC081bf1f309aDC325306';
    chainlinkEurUsdAddress = '0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910';
  } else {
    // localhost環境: モックオラクルを使用
    chainlinkEthUsdAddress = loadAddress(network, 'ChainLinkMockEthUsd');
    chainlinkEurUsdAddress = loadAddress(network, 'ChainLinkMockEurUsd');
  }
  
  console.log(`   ETH/USD Oracle: ${chainlinkEthUsdAddress}`);
  console.log(`   EUR/USD Oracle: ${chainlinkEurUsdAddress}`);
  console.log('✅ Oracle addresses loaded\n');

  // PriceFeedV3をデプロイ（CEUR用）
  // 通貨別のPriceFeedプロキシとしてデプロイ
  // name: 'PriceFeed_CEUR' → プロキシ名: 'PriceFeedERC1967Proxy_CEUR'
  const result = await deployUUPS({
    name: getCurrencyContractName(CONTRACT_NAMES.PriceFeed, 'CEUR'),
    contractName: V1_CONTRACTS.PriceFeed,
    initFunction: 'initialize',
    initArgs: [
      chainlinkEthUsdAddress,
      chainlinkEurUsdAddress,
    ],
  });

  console.log(`\n✅ PriceFeed (CEUR) deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}`);
  console.log(`\n📝 Note:`);
  console.log(`   This PriceFeed uses ETH/USD and EUR/USD oracles\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

