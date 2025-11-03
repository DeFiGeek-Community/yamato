import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔧 Adding Yamato to CurrencyOS on ${network}...\n`);

  // アドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const currencyOSAddress = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS);
  const yamatoAddress = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
  console.log('✅ Addresses loaded\n');

  // CurrencyOSコントラクトを取得
  const currencyOS = await hre.viem.getContractAt(V1_CONTRACTS.CurrencyOS, currencyOSAddress);

  // CurrencyOS.addYamato()を実行
  console.log('🚀 Executing CurrencyOS.addYamato()...');
  const hash = await currencyOS.write.addYamato([yamatoAddress], {
    gas: 2000000n,
  });

  console.log(`  📝 Transaction hash: ${hash}`);
  const publicClient = await hre.viem.getPublicClient();
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
