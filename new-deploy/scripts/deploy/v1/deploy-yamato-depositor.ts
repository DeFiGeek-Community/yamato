import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { deployUUPSWithLibraries } from '../../core/uups-deployer-with-libraries.js';
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
  const yamatoAddress = loadAddress(network, 'YamatoERC1967Proxy');
  const pledgeLibAddress = loadAddress(network, 'PledgeLib');
  console.log('✅ Dependencies loaded\n');

  // YamatoDepositorV2のABI/Bytecodeを読み込む
  const { abi, bytecode } = loadArtifact('YamatoDepositorV2');
  
  // OpenZeppelin ERC1967Proxyのアーティファクトを読み込む
  const { abi: proxyAbi, bytecode: proxyBytecode } = loadArtifact(
    '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy'
  );

  // YamatoDepositorをデプロイ（ライブラリリンク付き）
  const result = await deployUUPSWithLibraries({
    name: 'YamatoDepositor',
    implementation: {
      abi,
      bytecode,
      args: [],
      libraries: {
        PledgeLib: pledgeLibAddress,
      },
    },
    proxy: {
      initFunction: 'initialize',
      initArgs: [yamatoAddress],
    },
    proxyAbi,
    proxyBytecode,
    walletClient,
    publicClient,
    network,
  });

  console.log(`\n✅ YamatoDepositor deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

