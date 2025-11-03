import hre from 'hardhat';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, type NetworkName } from '../../core/address-manager';
import { V2_CONTRACTS } from '../../core/contract-definitions';

/**
 * YmtOS デプロイ
 * 
 * マルチカレンシー統合管理システムです。
 * CJPY CurrencyOSアドレスを初期化引数として受け取ります。
 * 
 * ⚠️ 注意:
 * - YmtOSは全通貨で共有される単一のインスタンスです
 * - 初期化時にCJPY CurrencyOSアドレスが必要です
 * - 後でCUSD/CEURのCurrencyOSを追加します（addCurrencyOS）
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const cjpyCurrencyOSAddr = loadAddress(network, 'CurrencyOSERC1967Proxy');
  console.log(`   CJPY CurrencyOS: ${cjpyCurrencyOSAddr}`);
  console.log('✅ Dependencies loaded\n');

  const result = await deployUUPS({
    name: 'YmtOS',
    contractName: V2_CONTRACTS.YmtOS,
    initFunction: 'initialize',
    initArgs: [cjpyCurrencyOSAddr],
  });

  console.log(`\n✅ YmtOS deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Deploy CUSD/CEUR currencies`);
  console.log(`   2. Add CUSD/CEUR CurrencyOS using YmtOS.addCurrencyOS()\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
