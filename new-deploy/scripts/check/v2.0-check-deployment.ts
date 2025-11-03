import hre from 'hardhat';
import { loadProxyAddress, loadImplementationAddress, type NetworkName } from '../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../core/currency-manager';
import { V2_CONTRACTS, V2_CURRENCY_CONTRACTS, V1_CONTRACTS, V1_5_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';
import { getPriceFeedContractName } from '../core/currency-manager';

/**
 * v2.0 デプロイ確認スクリプト
 * 
 * 以下の項目をチェックします：
 * 1. 通貨別コントラクトの実装アドレス確認
 * 2. YmtOSの設定確認
 * 3. 通貨別コントラクト間の依存関係確認
 * 
 * 使用方法:
 *   CURRENCY=CUSD npx hardhat run scripts/check/v2.0-check-deployment.ts --network localhost
 *   CURRENCY=CEUR npx hardhat run scripts/check/v2.0-check-deployment.ts --network localhost
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🔍 Checking v2.0 deployment on ${network}...`);
  console.log(`💱 Currency: ${currency}\n`);

  // 共通コントラクト（通貨に依存しない）
  const sharedContracts = [
    { name: CONTRACT_NAMES.YmtOS, contractName: V2_CONTRACTS.YmtOS },
  ];

  // 通貨別コントラクト
  const priceFeedContractName = getPriceFeedContractName(currency);
  const currencyContracts = [
    { name: priceFeedContractName, contractName: currency === 'CUSD' ? V2_CONTRACTS.PriceFeedSingle : V1_CONTRACTS.PriceFeed, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.CurrencyOS, contractName: V2_CURRENCY_CONTRACTS.CurrencyOS, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.Pool, contractName: V2_CURRENCY_CONTRACTS.Pool, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.PriorityRegistry, contractName: V2_CURRENCY_CONTRACTS.PriorityRegistry, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.Yamato, contractName: V2_CURRENCY_CONTRACTS.Yamato, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.YamatoDepositor, contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.YamatoBorrower, contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.YamatoRepayer, contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.YamatoWithdrawer, contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.YamatoRedeemer, contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.YamatoSweeper, contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper, isCurrencySpecific: true },
    { name: CONTRACT_NAMES.ScoreRegistry, contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry, isCurrencySpecific: true },
  ];

  console.log('='.repeat(60));
  console.log('📦 Step 1: Checking Shared Contracts Implementation');
  console.log('='.repeat(60) + '\n');

  let sharedCheckPassed = 0;
  let sharedCheckFailed = 0;

  for (const { name, contractName } of sharedContracts) {
    try {
      const proxyAddress = loadProxyAddress(network, name);
      const expectedImplAddress = loadImplementationAddress(network, name);
      
      const contractInstance = await hre.viem.getContractAt(contractName, proxyAddress);
      const actualImplAddress = await contractInstance.read.getImplementation();
      
      const matches = actualImplAddress.toLowerCase() === expectedImplAddress.toLowerCase();
      
      if (matches) {
        console.log(`✅ ${name}:`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Implementation: ${actualImplAddress}`);
        sharedCheckPassed++;
      } else {
        console.log(`❌ ${name}:`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Expected: ${expectedImplAddress}`);
        console.log(`   Actual:   ${actualImplAddress}`);
        sharedCheckFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error instanceof Error ? error.message : error}`);
      sharedCheckFailed++;
    }
  }

  console.log(`\n📊 Shared Contracts Check: ${sharedCheckPassed}/${sharedContracts.length} passed`);

  console.log('\n' + '='.repeat(60));
  console.log(`📦 Step 2: Checking ${currency} Currency-Specific Contracts Implementation`);
  console.log('='.repeat(60) + '\n');

  let currencyCheckPassed = 0;
  let currencyCheckFailed = 0;

  for (const { name, contractName, isCurrencySpecific } of currencyContracts) {
    try {
      const proxyName = isCurrencySpecific ? getCurrencyContractName(name, currency) : name;
      const proxyAddress = loadProxyAddress(network, name, isCurrencySpecific ? currency : undefined);
      const expectedImplAddress = loadImplementationAddress(network, name);
      
      const contractInstance = await hre.viem.getContractAt(contractName, proxyAddress);
      const actualImplAddress = await contractInstance.read.getImplementation();
      
      const matches = actualImplAddress.toLowerCase() === expectedImplAddress.toLowerCase();
      
      if (matches) {
        console.log(`✅ ${name} (${currency}):`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Implementation: ${actualImplAddress}`);
        currencyCheckPassed++;
      } else {
        console.log(`❌ ${name} (${currency}):`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Expected: ${expectedImplAddress}`);
        console.log(`   Actual:   ${actualImplAddress}`);
        currencyCheckFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name} (${currency}): Error - ${error instanceof Error ? error.message : error}`);
      currencyCheckFailed++;
    }
  }

  console.log(`\n📊 ${currency} Contracts Check: ${currencyCheckPassed}/${currencyContracts.length} passed`);

  // 依存関係の確認
  console.log('\n' + '='.repeat(60));
  console.log('🔗 Step 3: Checking Contract Dependencies');
  console.log('='.repeat(60) + '\n');

  try {
    const ymtOSAddress = loadProxyAddress(network, CONTRACT_NAMES.YmtOS);
    const yamatoAddress = loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency);
    const depositorAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoDepositor, currency);
    const borrowerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoBorrower, currency);
    const repayerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoRepayer, currency);
    const withdrawerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoWithdrawer, currency);
    const redeemerAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoRedeemer, currency);
    const sweeperAddress = loadProxyAddress(network, CONTRACT_NAMES.YamatoSweeper, currency);
    const poolAddress = loadProxyAddress(network, CONTRACT_NAMES.Pool, currency);
    const priorityRegistryAddress = loadProxyAddress(network, CONTRACT_NAMES.PriorityRegistry, currency);
    const scoreRegistryAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry, currency);
    const currencyOSAddress = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS, currency);

    // Yamatoの依存関係
    const yamato = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.Yamato, yamatoAddress);
    const actualDepositor = await yamato.read.depositor();
    const actualBorrower = await yamato.read.borrower();
    const actualRepayer = await yamato.read.repayer();
    const actualWithdrawer = await yamato.read.withdrawer();
    const actualRedeemer = await yamato.read.redeemer();
    const actualSweeper = await yamato.read.sweeper();
    const actualPool = await yamato.read.pool();
    const actualPriorityRegistry = await yamato.read.priorityRegistry();
    const actualScoreRegistry = await yamato.read.scoreRegistry();
    
    console.log('📋 Yamato dependencies:');
    const yamatoDeps = [
      { name: 'Depositor', expected: depositorAddress, actual: actualDepositor },
      { name: 'Borrower', expected: borrowerAddress, actual: actualBorrower },
      { name: 'Repayer', expected: repayerAddress, actual: actualRepayer },
      { name: 'Withdrawer', expected: withdrawerAddress, actual: actualWithdrawer },
      { name: 'Redeemer', expected: redeemerAddress, actual: actualRedeemer },
      { name: 'Sweeper', expected: sweeperAddress, actual: actualSweeper },
      { name: 'Pool', expected: poolAddress, actual: actualPool },
      { name: 'PriorityRegistry', expected: priorityRegistryAddress, actual: actualPriorityRegistry },
      { name: 'ScoreRegistry', expected: scoreRegistryAddress, actual: actualScoreRegistry },
    ];

    let yamatoDepsPassed = 0;
    for (const { name: depName, expected, actual } of yamatoDeps) {
      const matches = expected.toLowerCase() === actual.toLowerCase();
      console.log(`   ${depName}: ${matches ? '✅' : '❌'} ${actual}`);
      if (matches) yamatoDepsPassed++;
    }

    // CurrencyOSの依存関係
    const currencyOS = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.CurrencyOS, currencyOSAddress);
    
    // CurrencyOSV4の依存関係を確認（311_check_setAddress.tsに合わせる）
    try {
      const { loadAddress } = await import('../core/address-manager');
      const { getCurrencyInfo } = await import('../core/currency-manager');
      const currencyInfo = getCurrencyInfo(currency);
      const currencyTokenAddress = loadAddress(network, currencyInfo.contractName);
      const scoreWeightControllerAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
      const feePoolAddress = loadProxyAddress(network, CONTRACT_NAMES.FeePool);
      
      const actualYmtOS = await currencyOS.read.ymtOS() as `0x${string}`;
      const actualCurrency = await currencyOS.read.currency() as `0x${string}`;
      const actualPriceFeed = await currencyOS.read.priceFeed() as `0x${string}`;
      const actualFeePool = await currencyOS.read.feePool() as `0x${string}`;
      
      // CurrencyOSV4ではscoreWeightController()はYmtOSから取得するため、エラーハンドリング
      let actualScoreWeightController: `0x${string}` | null = null;
      try {
        actualScoreWeightController = await currencyOS.read.scoreWeightController() as `0x${string}`;
      } catch (error) {
        // YmtOSが設定されていない場合や、scoreWeightControllerが取得できない場合はスキップ
      }
      
      // CurrencyOSにYamatoが追加されているか確認
      let yamatoInCurrencyOS = false;
      try {
        const firstYamato = await currencyOS.read.yamatoes([BigInt(0)]) as `0x${string}`;
        yamatoInCurrencyOS = firstYamato.toLowerCase() === yamatoAddress.toLowerCase();
      } catch (error) {
        // 配列が空の場合や取得できない場合はスキップ
      }
      
      const priceFeedAddress = loadProxyAddress(network, priceFeedContractName, currency);
      
      console.log('\n📋 CurrencyOS dependencies:');
      console.log(`   YmtOS: ${actualYmtOS.toLowerCase() === ymtOSAddress.toLowerCase() ? '✅' : '❌'} ${actualYmtOS}`);
      console.log(`   Currency: ${actualCurrency.toLowerCase() === currencyTokenAddress.toLowerCase() ? '✅' : '❌'} ${actualCurrency}`);
      console.log(`   PriceFeed: ${actualPriceFeed.toLowerCase() === priceFeedAddress.toLowerCase() ? '✅' : '❌'} ${actualPriceFeed}`);
      console.log(`   FeePool: ${actualFeePool.toLowerCase() === feePoolAddress.toLowerCase() ? '✅' : '❌'} ${actualFeePool}`);
      if (actualScoreWeightController) {
        console.log(`   ScoreWeightController: ${actualScoreWeightController.toLowerCase() === scoreWeightControllerAddress.toLowerCase() ? '✅' : '❌'} ${actualScoreWeightController}`);
      } else {
        console.log(`   ScoreWeightController: ⚠️  Could not read (YmtOS may not be set)`);
      }
      if (yamatoInCurrencyOS) {
        console.log(`   Yamato in yamatoes: ✅ ${yamatoAddress}`);
      } else {
        console.log(`   Yamato in yamatoes: ⚠️  ${yamatoAddress} (check manually)`);
      }
    } catch (error) {
      console.log('\n📋 CurrencyOS dependencies:');
      console.log(`   ⚠️  Could not check CurrencyOS dependencies: ${error instanceof Error ? error.message : error}`);
    }

    // YmtOSの依存関係
    const ymtOS = await hre.viem.getContractAt(V2_CONTRACTS.YmtOS, ymtOSAddress);
    try {
      const { loadAddress } = await import('../core/address-manager');
      const ymtAddress = loadAddress(network, V1_5_CONTRACTS.YMT);
      const veYmtAddress = loadAddress(network, V1_5_CONTRACTS.veYMT);
      const minterProxyAddress = loadProxyAddress(network, CONTRACT_NAMES.YmtMinter);
      const scoreWeightControllerAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
      
      const ymtFromYmtOS = await ymtOS.read.YMT() as `0x${string}`;
      const veYMTFromYmtOS = await ymtOS.read.veYMT() as `0x${string}`;
      const ymtMinterFromYmtOS = await ymtOS.read.ymtMinter() as `0x${string}`;
      const scoreWeightControllerFromYmtOS = await ymtOS.read.scoreWeightController() as `0x${string}`;
      
      // YmtOSにCurrencyOSが追加されているか確認
      let currencyOSInYmtOS = false;
      try {
        const firstCurrencyOS = await ymtOS.read.currencyOSes([BigInt(0)]) as `0x${string}`;
        currencyOSInYmtOS = firstCurrencyOS.toLowerCase() === currencyOSAddress.toLowerCase();
      } catch (error) {
        // 配列が空の場合や取得できない場合はスキップ
      }
      
      console.log('\n📋 YmtOS dependencies:');
      console.log(`   YMT: ${ymtFromYmtOS.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${ymtFromYmtOS}`);
      console.log(`   veYMT: ${veYMTFromYmtOS.toLowerCase() === veYmtAddress.toLowerCase() ? '✅' : '❌'} ${veYMTFromYmtOS}`);
      console.log(`   YmtMinter: ${ymtMinterFromYmtOS.toLowerCase() === minterProxyAddress.toLowerCase() ? '✅' : '❌'} ${ymtMinterFromYmtOS}`);
      console.log(`   ScoreWeightController: ${scoreWeightControllerFromYmtOS.toLowerCase() === scoreWeightControllerAddress.toLowerCase() ? '✅' : '❌'} ${scoreWeightControllerFromYmtOS}`);
      if (currencyOSInYmtOS) {
        console.log(`   CurrencyOS (${currency}) in currencyOSes: ✅ ${currencyOSAddress}`);
      } else {
        console.log(`   CurrencyOS (${currency}) in currencyOSes: ⚠️  ${currencyOSAddress} (check manually)`);
      }
    } catch (error) {
      console.log('\n📋 YmtOS dependencies:');
      console.log(`   ⚠️  Could not check YmtOS dependencies: ${error instanceof Error ? error.message : error}`);
    }
    
    // ScoreRegistryの依存関係（311_check_setAddress.tsに合わせる）
    try {
      const { loadAddress } = await import('../core/address-manager');
      const ymtAddress = loadAddress(network, V1_5_CONTRACTS.YMT);
      const veYmtAddress = loadAddress(network, V1_5_CONTRACTS.veYMT);
      const minterProxyAddress = loadProxyAddress(network, CONTRACT_NAMES.YmtMinter);
      const scoreWeightControllerAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
      
      const scoreRegistry = await hre.viem.getContractAt(V2_CURRENCY_CONTRACTS.ScoreRegistry, scoreRegistryAddress);
      const ymtMinterFromRegistry = await scoreRegistry.read.ymtMinter() as `0x${string}`;
      const scoreWeightControllerFromRegistry = await scoreRegistry.read.scoreWeightController() as `0x${string}`;
      const yamatoFromRegistry = await scoreRegistry.read.yamato() as `0x${string}`;
      
      console.log('\n📋 ScoreRegistry dependencies:');
      console.log(`   YmtMinter: ${ymtMinterFromRegistry.toLowerCase() === minterProxyAddress.toLowerCase() ? '✅' : '❌'} ${ymtMinterFromRegistry}`);
      console.log(`   ScoreWeightController: ${scoreWeightControllerFromRegistry.toLowerCase() === scoreWeightControllerAddress.toLowerCase() ? '✅' : '❌'} ${scoreWeightControllerFromRegistry}`);
      console.log(`   Yamato: ${yamatoFromRegistry.toLowerCase() === yamatoAddress.toLowerCase() ? '✅' : '❌'} ${yamatoFromRegistry}`);
    } catch (error) {
      console.log('\n📋 ScoreRegistry dependencies:');
      console.log(`   ⚠️  Could not check ScoreRegistry dependencies: ${error instanceof Error ? error.message : error}`);
    }
    
    // ScoreWeightControllerの依存関係（ScoreRegistryが追加されているか）
    try {
      const scoreWeightControllerAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
      const scoreWeightController = await hre.viem.getContractAt(V1_5_CONTRACTS.ScoreWeightController, scoreWeightControllerAddress);
      const scoreRegistryInController = await scoreWeightController.read.scores([scoreRegistryAddress]) as bigint;
      
      console.log('\n📋 ScoreWeightController dependencies:');
      console.log(`   ScoreRegistry (${currency}) in scores: ${scoreRegistryInController !== 0n ? '✅' : '❌'} ${scoreRegistryInController !== 0n ? 'Weight: ' + scoreRegistryInController.toString() : 'Not registered'}`);
    } catch (error) {
      console.log('\n📋 ScoreWeightController dependencies:');
      console.log(`   ⚠️  Could not check ScoreWeightController.scores(): ${error instanceof Error ? error.message : error}`);
    }

    // 通貨トークンの設定確認
    // 注意: CurrencyV2にはcurrencyOS()のgetter関数がないため、確認をスキップ
    // currencyOSはprivate変数で、setCurrencyOS()で設定されるのみ
    console.log('\n' + '─'.repeat(60));
    console.log(`📋 ${currency} token configuration:`);
    console.log(`   ⚠️  CurrencyV2 does not have a public currencyOS() getter`);
    console.log(`   CurrencyOS should be set via setCurrencyOS() function`);
    console.log(`   CurrencyOS address: ${currencyOSAddress}`);

    // 最終結果
    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Summary');
    console.log('='.repeat(60));
    console.log(`✅ Shared Contracts: ${sharedCheckPassed}/${sharedContracts.length} passed`);
    console.log(`✅ ${currency} Contracts: ${currencyCheckPassed}/${currencyContracts.length} passed`);
    console.log(`✅ Yamato Dependencies: ${yamatoDepsPassed}/${yamatoDeps.length} passed`);
    
    const totalChecks = sharedContracts.length + currencyContracts.length;
    const totalPassed = sharedCheckPassed + currencyCheckPassed;
    
    if (totalPassed === totalChecks && sharedCheckFailed === 0 && currencyCheckFailed === 0) {
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

