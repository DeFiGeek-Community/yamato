import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency } from '../../core/currency-manager';
import { sendAsGovernance } from '../../core/governance';
import { V2_CONTRACTS, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * YmtOSにCurrencyOSを追加
 *
 * YmtOS.addCurrencyOS()を実行します。
 *
 * - 登録済み（YmtOS.exists() が true）なら何もしません。addCurrencyOS は重複を確認しないためです。
 * - addCurrencyOS は YmtOS の governance しか呼べないため、現在の governance を持つ側から実行します。
 *   デプロイ用アカウントなら直接送信し、マルチシグなら localhost はアカウント #1 から直接送信、
 *   それ以外は Safe Transaction 提案になります。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();

  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);
  console.log('⚙️  Adding CurrencyOS to YmtOS...\n');

  console.log('📖 Loading addresses...');
  const ymtOSAddr = loadProxyAddress(network, CONTRACT_NAMES.YmtOS);
  const currencyOSAddr = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS, currency);

  console.log(`   YmtOS: ${ymtOSAddr}`);
  console.log(`   CurrencyOS (${currency}): ${currencyOSAddr}`);
  console.log('✅ Addresses loaded\n');

  const ymtOS = await hre.viem.getContractAt(V2_CONTRACTS.YmtOS, ymtOSAddr);

  if (await ymtOS.read.exists([currencyOSAddr])) {
    console.log(`⏭️  CurrencyOS (${currency}) is already registered in YmtOS\n`);
    return;
  }

  console.log('🔄 Calling YmtOS.addCurrencyOS()...');
  const result = await sendAsGovernance({
    network,
    address: ymtOSAddr,
    abi: ymtOS.abi,
    functionName: 'addCurrencyOS',
    args: [currencyOSAddr],
  });

  if (result === 'sent') {
    console.log(`\n✅ CurrencyOS (${currency}) added to YmtOS successfully!\n`);
  } else {
    console.log(`\n📝 addCurrencyOS for ${currency} is waiting for multisig execution (${result})\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
