import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { loadAddress } from '../../core/address-manager.js';
import { loadArtifact } from '../../core/artifact-loader.js';
import type { NetworkName } from '../../../config/networks.js';

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = (networkArg?.split('=')[1] || 'localhost') as NetworkName;

  console.log(`\n🔧 Setting up Yamato dependencies on ${network}...\n`);

  const { publicClient, walletClient } = createClients(network);

  // 全てのアドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const yamatoAddress = loadAddress(network, 'YamatoERC1967Proxy');
  const depositorAddress = loadAddress(network, 'YamatoDepositorERC1967Proxy');
  const borrowerAddress = loadAddress(network, 'YamatoBorrowerERC1967Proxy');
  const repayerAddress = loadAddress(network, 'YamatoRepayerERC1967Proxy');
  const withdrawerAddress = loadAddress(network, 'YamatoWithdrawerERC1967Proxy');
  const redeemerAddress = loadAddress(network, 'YamatoRedeemerERC1967Proxy');
  const sweeperAddress = loadAddress(network, 'YamatoSweeperERC1967Proxy');
  const poolAddress = loadAddress(network, 'PoolERC1967Proxy');
  const priorityRegistryAddress = loadAddress(network, 'PriorityRegistryERC1967Proxy');
  console.log('✅ All addresses loaded\n');

  // YamatoのABIを読み込む
  const { abi } = loadArtifact('YamatoV3');

  // Yamato.setDeps()を実行
  console.log('🚀 Executing Yamato.setDeps()...');
  const hash = await walletClient.writeContract({
    address: yamatoAddress,
    abi,
    functionName: 'setDeps',
    args: [
      depositorAddress,
      borrowerAddress,
      repayerAddress,
      withdrawerAddress,
      redeemerAddress,
      sweeperAddress,
      poolAddress,
      priorityRegistryAddress,
    ],
  });

  console.log(`  📝 Transaction hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);

  console.log(`\n✅ Yamato.setDeps() completed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

