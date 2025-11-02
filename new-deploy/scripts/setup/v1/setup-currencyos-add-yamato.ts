import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { loadAddress } from '../../core/address-manager.js';
import { loadArtifact } from '../../core/artifact-loader.js';
import type { NetworkName } from '../../../config/networks.js';

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = (networkArg?.split('=')[1] || 'localhost') as NetworkName;

  console.log(`\n🔧 Adding Yamato to CurrencyOS on ${network}...\n`);

  const { publicClient, walletClient } = createClients(network);

  // アドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const currencyOSAddress = loadAddress(network, 'CurrencyOSERC1967Proxy');
  const yamatoAddress = loadAddress(network, 'YamatoERC1967Proxy');
  console.log('✅ Addresses loaded\n');

  // CurrencyOSのABIを読み込む
  const { abi } = loadArtifact('CurrencyOSV2');

  // CurrencyOS.addYamato()を実行
  console.log('🚀 Executing CurrencyOS.addYamato()...');
  const hash = await walletClient.writeContract({
    address: currencyOSAddress,
    abi,
    functionName: 'addYamato',
    args: [yamatoAddress],
    gas: 2000000n,
  });

  console.log(`  📝 Transaction hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);

  console.log(`\n✅ CurrencyOS.addYamato() completed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

