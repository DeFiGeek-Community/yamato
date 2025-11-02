import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { loadAddress } from '../../core/address-manager.js';
import { loadArtifact } from '../../core/artifact-loader.js';
import type { NetworkName } from '../../../config/networks.js';

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = (networkArg?.split('=')[1] || 'localhost') as NetworkName;

  console.log(`\n🔧 Setting CurrencyOS and revoking governance for CJPY on ${network}...\n`);

  const { publicClient, walletClient } = createClients(network);

  // アドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const cjpyAddress = loadAddress(network, 'CJPY');
  const currencyOSAddress = loadAddress(network, 'CurrencyOSERC1967Proxy');
  console.log('✅ Addresses loaded\n');

  // CJPYのABIを読み込む
  const { abi } = loadArtifact('CJPY');

  // CJPY.setCurrencyOS()を実行
  console.log('🚀 Executing CJPY.setCurrencyOS()...');
  const setCurrencyOSHash = await walletClient.writeContract({
    address: cjpyAddress,
    abi,
    functionName: 'setCurrencyOS',
    args: [currencyOSAddress],
    gas: 10000000n,
  });

  console.log(`  📝 Transaction hash: ${setCurrencyOSHash}`);
  const setCurrencyOSReceipt = await publicClient.waitForTransactionReceipt({ hash: setCurrencyOSHash });
  console.log(`  ✅ setCurrencyOS() confirmed in block ${setCurrencyOSReceipt.blockNumber}`);

  // CJPY.revokeGovernance()を実行
  console.log('\n🚀 Executing CJPY.revokeGovernance()...');
  const revokeHash = await walletClient.writeContract({
    address: cjpyAddress,
    abi,
    functionName: 'revokeGovernance',
    args: [],
  });

  console.log(`  📝 Transaction hash: ${revokeHash}`);
  const revokeReceipt = await publicClient.waitForTransactionReceipt({ hash: revokeHash });
  console.log(`  ✅ revokeGovernance() confirmed in block ${revokeReceipt.blockNumber}`);

  console.log(`\n✅ CJPY setup completed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

