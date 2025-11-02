import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { deployUUPS } from '../../core/uups-deployer.js';
import { loadAddress } from '../../core/address-manager.js';
import { loadArtifact } from '../../core/artifact-loader.js';
import type { NetworkName } from '../../../config/networks.js';

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = (networkArg?.split('=')[1] || 'localhost') as NetworkName;

  console.log(`\n🌐 Network: ${network}\n`);

  const { publicClient, walletClient } = createClients(network);

  // Chainlinkモックアドレスを読み込む
  console.log('📖 Loading mock oracle addresses...');
  const chainlinkEthUsdAddress = loadAddress(network, 'ChainLinkMockEthUsd');
  const chainlinkJpyUsdAddress = loadAddress(network, 'ChainLinkMockJpyUsd');
  console.log(`   ETH/USD Oracle: ${chainlinkEthUsdAddress}`);
  console.log(`   JPY/USD Oracle: ${chainlinkJpyUsdAddress}`);
  console.log('✅ Mock addresses loaded\n');

  // PriceFeedV3のABI/Bytecodeを読み込む
  const { abi, bytecode } = loadArtifact('PriceFeedV3');
  
  // OpenZeppelin ERC1967Proxyのアーティファクトを読み込む
  const { abi: proxyAbi, bytecode: proxyBytecode } = loadArtifact(
    '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy'
  );

  // PriceFeedをデプロイ
  const result = await deployUUPS({
    name: 'PriceFeed',
    implementation: {
      abi,
      bytecode,
      args: [],
    },
    proxy: {
      initFunction: 'initialize',
      initArgs: [
        chainlinkEthUsdAddress,
        chainlinkJpyUsdAddress,
      ],
    },
    proxyAbi,
    proxyBytecode,
    walletClient,
    publicClient,
    network,
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

