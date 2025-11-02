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

  // 依存コントラクトのアドレスを読み込む
  console.log('📖 Loading dependencies...');
  const cjpyAddress = loadAddress(network, 'CJPY');
  const priceFeedAddress = loadAddress(network, 'PriceFeedERC1967Proxy');
  const feePoolAddress = loadAddress(network, 'FeePoolERC1967Proxy');
  console.log('✅ Dependencies loaded\n');

  // CurrencyOSV2のABI/Bytecodeを読み込む
  const { abi, bytecode } = loadArtifact('CurrencyOSV2');
  
  // OpenZeppelin ERC1967Proxyのアーティファクトを読み込む
  const { abi: proxyAbi, bytecode: proxyBytecode } = loadArtifact(
    '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy'
  );

  // CurrencyOSをデプロイ
  const result = await deployUUPS({
    name: 'CurrencyOS',
    implementation: {
      abi,
      bytecode,
      args: [],
    },
    proxy: {
      initFunction: 'initialize',
      initArgs: [cjpyAddress, priceFeedAddress, feePoolAddress],
    },
    proxyAbi,
    proxyBytecode,
    walletClient,
    publicClient,
    network,
  });

  console.log(`\n✅ CurrencyOS deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

