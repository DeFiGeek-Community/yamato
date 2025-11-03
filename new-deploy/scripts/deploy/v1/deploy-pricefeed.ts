import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // Chainlinkモックアドレスを読み込む
  console.log('📖 Loading mock oracle addresses...');
  const chainlinkEthUsdAddress = loadAddress(network, 'ChainLinkMockEthUsd');
  const chainlinkJpyUsdAddress = loadAddress(network, 'ChainLinkMockJpyUsd');
  console.log(`   ETH/USD Oracle: ${chainlinkEthUsdAddress}`);
  console.log(`   JPY/USD Oracle: ${chainlinkJpyUsdAddress}`);
  console.log('✅ Mock addresses loaded\n');

  // PriceFeedをデプロイ
  const result = await deployUUPS({
    name: 'PriceFeed',
    contractName: 'PriceFeedV3',
    initFunction: 'initialize',
    initArgs: [
      chainlinkEthUsdAddress,
      chainlinkJpyUsdAddress,
    ],
  });

  console.log(`\n✅ PriceFeed deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

