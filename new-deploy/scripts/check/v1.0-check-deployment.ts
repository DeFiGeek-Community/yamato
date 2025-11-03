import hre from 'hardhat';
import { loadProxyAddress, loadImplementationAddress, type NetworkName } from '../core/address-manager';
import { V1_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v1.0 デプロイ確認スクリプト
 * 
 * 以下の項目をチェックします：
 * 1. 実装アドレスの一致確認（プロキシから取得した実装アドレスと保存されたアドレスの比較）
 * 2. 依存関係の設定確認（各コントラクトから読み取ったアドレスと期待値の比較）
 * 3. コントラクトインスタンスの取得確認
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔍 Checking v1.0 deployment on ${network}...\n`);

  const contracts = [
    { name: CONTRACT_NAMES.PriceFeed, contractName: V1_CONTRACTS.PriceFeed },
    { name: CONTRACT_NAMES.FeePool, contractName: V1_CONTRACTS.FeePool },
    { name: CONTRACT_NAMES.CurrencyOS, contractName: V1_CONTRACTS.CurrencyOS },
    { name: CONTRACT_NAMES.Pool, contractName: V1_CONTRACTS.Pool },
    { name: CONTRACT_NAMES.PriorityRegistry, contractName: V1_CONTRACTS.PriorityRegistry },
    { name: CONTRACT_NAMES.Yamato, contractName: V1_CONTRACTS.Yamato },
    { name: CONTRACT_NAMES.YamatoDepositor, contractName: V1_CONTRACTS.YamatoDepositor },
    { name: CONTRACT_NAMES.YamatoBorrower, contractName: V1_CONTRACTS.YamatoBorrower },
    { name: CONTRACT_NAMES.YamatoRepayer, contractName: V1_CONTRACTS.YamatoRepayer },
    { name: CONTRACT_NAMES.YamatoWithdrawer, contractName: V1_CONTRACTS.YamatoWithdrawer },
    { name: CONTRACT_NAMES.YamatoRedeemer, contractName: V1_CONTRACTS.YamatoRedeemer },
    { name: CONTRACT_NAMES.YamatoSweeper, contractName: V1_CONTRACTS.YamatoSweeper },
  ];

  console.log('='.repeat(60));
  console.log('📦 Step 1: Checking Implementation Addresses');
  console.log('='.repeat(60) + '\n');

  let implCheckPassed = 0;
  let implCheckFailed = 0;

  for (const { name, contractName } of contracts) {
    try {
      const proxyAddress = loadProxyAddress(network, name);
      const expectedImplAddress = loadImplementationAddress(network, name);
      
      const contractInstance = await hre.viem.getContractAt(contractName, proxyAddress);
      const actualImplAddress = await contractInstance.read.getImplementation() as `0x${string}`;
      
      const matches = actualImplAddress.toLowerCase() === expectedImplAddress.toLowerCase();
      
      if (matches) {
        console.log(`✅ ${name}:`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Implementation: ${actualImplAddress}`);
        implCheckPassed++;
      } else {
        console.log(`❌ ${name}:`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Expected: ${expectedImplAddress}`);
        console.log(`   Actual:   ${actualImplAddress}`);
        implCheckFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error instanceof Error ? error.message : error}`);
      implCheckFailed++;
    }
  }

  console.log(`\n📊 Implementation Check: ${implCheckPassed}/${contracts.length} passed`);

  // 依存関係の確認
  console.log('\n' + '='.repeat(60));
  console.log('🔗 Step 2: Checking Contract Dependencies');
  console.log('='.repeat(60) + '\n');

  try {
    const yamatoAddress = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
    const depositorAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoDepositor);
    const borrowerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoBorrower);
    const repayerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoRepayer);
    const withdrawerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoWithdrawer);
    const redeemerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoRedeemer);
    const sweeperAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoSweeper);
    const poolAddress = loadProxyAddress(network, CONTRACT_NAMES.Pool);
    const priorityRegistryAddress = loadProxyAddress(network, CONTRACT_NAMES.PriorityRegistry);

    const yamato = await hre.viem.getContractAt(V1_CONTRACTS.Yamato, yamatoAddress);
    
    const actualDepositor = await yamato.read.depositor();
    const actualBorrower = await yamato.read.borrower();
    const actualRepayer = await yamato.read.repayer();
    const actualWithdrawer = await yamato.read.withdrawer();
    const actualRedeemer = await yamato.read.redeemer();
    const actualSweeper = await yamato.read.sweeper();
    const actualPool = await yamato.read.pool();
    const actualPriorityRegistry = await yamato.read.priorityRegistry();

    const checks = [
      { name: 'Depositor', expected: depositorAddress, actual: actualDepositor as `0x${string}` },
      { name: 'Borrower', expected: borrowerAddress, actual: actualBorrower as `0x${string}` },
      { name: 'Repayer', expected: repayerAddress, actual: actualRepayer as `0x${string}` },
      { name: 'Withdrawer', expected: withdrawerAddress, actual: actualWithdrawer as `0x${string}` },
      { name: 'Redeemer', expected: redeemerAddress, actual: actualRedeemer as `0x${string}` },
      { name: 'Sweeper', expected: sweeperAddress, actual: actualSweeper as `0x${string}` },
      { name: 'Pool', expected: poolAddress, actual: actualPool as `0x${string}` },
      { name: 'PriorityRegistry', expected: priorityRegistryAddress, actual: actualPriorityRegistry as `0x${string}` },
    ];

    let depsCheckPassed = 0;
    let depsCheckFailed = 0;

    for (const { name, expected, actual } of checks) {
      const matches = expected.toLowerCase() === actual.toLowerCase();
      if (matches) {
        console.log(`✅ Yamato.${name.toLowerCase()}(): ${actual}`);
        depsCheckPassed++;
      } else {
        console.log(`❌ Yamato.${name.toLowerCase()}():`);
        console.log(`   Expected: ${expected}`);
        console.log(`   Actual:   ${actual}`);
        depsCheckFailed++;
      }
    }

    console.log(`\n📊 Dependencies Check: ${depsCheckPassed}/${checks.length} passed`);

    // CurrencyOSの依存関係確認
    console.log('\n' + '─'.repeat(60));
    const currencyOSAddress = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS);
    const currencyOS = await hre.viem.getContractAt(V1_CONTRACTS.CurrencyOS, currencyOSAddress);
    
    // CurrencyOSにYamatoが追加されているか確認
    // yamatoesはaddress[]型のpublic変数なので、yamatoes(uint256)で各要素にアクセス可能
    let yamatoInCurrencyOS = false;
    try {
      // 最初の要素を確認（配列が空でない場合）
      const firstYamato = await currencyOS.read.yamatoes([BigInt(0)]) as `0x${string}`;
      yamatoInCurrencyOS = firstYamato.toLowerCase() === yamatoAddress.toLowerCase();
      // 注: 複数要素がある場合は、ループで確認する必要があるが、簡易的に最初の要素のみ確認
    } catch (error) {
      // 配列が空の場合や取得できない場合はスキップ
    }
    
    if (yamatoInCurrencyOS) {
      console.log(`✅ CurrencyOS.yamatoes includes Yamato: ${yamatoAddress}`);
    } else {
      console.log(`⚠️  CurrencyOS.yamatoes may not include Yamato (check manually)`);
      console.log(`   Yamato: ${yamatoAddress}`);
    }

    // CJPYの設定確認
    // 注意: CurrencyコントラクトではcurrencyOSはpublic変数ではないため、直接getter関数がない
    // CurrencyV2ではgetter関数がある可能性があるが、v1.0では確認をスキップ
    console.log('\n' + '─'.repeat(60));
    console.log(`📋 CJPY configuration:`);
    console.log(`   ⚠️  CJPY.currencyOS() getter is not available in v1.0 Currency contract`);
    console.log(`   CurrencyOS address: ${currencyOSAddress}`);

    // 最終結果
    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Summary');
    console.log('='.repeat(60));
    console.log(`✅ Implementation Check: ${implCheckPassed}/${contracts.length} passed`);
    console.log(`✅ Dependencies Check: ${depsCheckPassed}/${checks.length} passed`);
    
    const totalChecks = contracts.length + checks.length;
    const totalPassed = implCheckPassed + depsCheckPassed;
    
    if (totalPassed === totalChecks && implCheckFailed === 0 && depsCheckFailed === 0) {
      console.log(`\n🎉 All checks passed! (${totalPassed}/${totalChecks})`);
    } else {
      console.log(`\n⚠️  Some checks failed. Please review the output above.`);
      console.log(`   Total: ${totalPassed}/${totalChecks} passed`);
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error checking dependencies:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

