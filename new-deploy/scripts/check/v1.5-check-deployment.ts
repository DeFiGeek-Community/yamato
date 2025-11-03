import hre from 'hardhat';
import { loadProxyAddress, loadImplementationAddress, loadAddress, type NetworkName } from '../core/address-manager';
import { V1_5_CONTRACTS, V1_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v1.5 デプロイ確認スクリプト
 * 
 * 以下の項目をチェックします：
 * 1. v1.5新規コントラクトの実装アドレス確認
 * 2. v1.0→v1.5アップグレード済みコントラクトの実装アドレス確認
 * 3. 依存関係の設定確認（YMT、veYMT、ScoreWeightController、ScoreRegistry等）
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔍 Checking v1.5 deployment on ${network}...\n`);

  // v1.5新規コントラクト
  const v15NewContracts = [
    { name: CONTRACT_NAMES.YmtMinter, contractName: V1_5_CONTRACTS.YmtMinter },
    { name: CONTRACT_NAMES.ScoreWeightController, contractName: V1_5_CONTRACTS.ScoreWeightController },
    { name: CONTRACT_NAMES.ScoreRegistry, contractName: V1_5_CONTRACTS.ScoreRegistry },
  ];

  // v1.0→v1.5アップグレード済みコントラクト
  const upgradedContracts = [
    { name: CONTRACT_NAMES.YamatoRepayer, contractName: V1_CONTRACTS.YamatoRepayer },
    { name: CONTRACT_NAMES.YamatoRedeemer, contractName: V1_CONTRACTS.YamatoRedeemer },
    { name: CONTRACT_NAMES.YamatoWithdrawer, contractName: V1_CONTRACTS.YamatoWithdrawer },
    { name: CONTRACT_NAMES.YamatoSweeper, contractName: V1_CONTRACTS.YamatoSweeper },
    { name: CONTRACT_NAMES.YamatoDepositor, contractName: V1_CONTRACTS.YamatoDepositor },
    { name: CONTRACT_NAMES.YamatoBorrower, contractName: V1_CONTRACTS.YamatoBorrower },
    { name: CONTRACT_NAMES.CurrencyOS, contractName: V1_CONTRACTS.CurrencyOS },
    { name: CONTRACT_NAMES.Yamato, contractName: V1_CONTRACTS.Yamato },
    { name: CONTRACT_NAMES.FeePool, contractName: V1_CONTRACTS.FeePool },
  ];

  console.log('='.repeat(60));
  console.log('📦 Step 1: Checking v1.5 New Contracts Implementation');
  console.log('='.repeat(60) + '\n');

  let newImplCheckPassed = 0;
  let newImplCheckFailed = 0;

  for (const { name, contractName } of v15NewContracts) {
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
        newImplCheckPassed++;
      } else {
        console.log(`❌ ${name}:`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Expected: ${expectedImplAddress}`);
        console.log(`   Actual:   ${actualImplAddress}`);
        newImplCheckFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error instanceof Error ? error.message : error}`);
      newImplCheckFailed++;
    }
  }

  console.log(`\n📊 v1.5 New Contracts Check: ${newImplCheckPassed}/${v15NewContracts.length} passed`);

  console.log('\n' + '='.repeat(60));
  console.log('🔄 Step 2: Checking Upgraded Contracts Implementation');
  console.log('='.repeat(60) + '\n');

  let upgradedCheckPassed = 0;
  let upgradedCheckFailed = 0;

  for (const { name, contractName } of upgradedContracts) {
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
        upgradedCheckPassed++;
      } else {
        console.log(`❌ ${name}:`);
        console.log(`   Proxy: ${proxyAddress}`);
        console.log(`   Expected: ${expectedImplAddress}`);
        console.log(`   Actual:   ${actualImplAddress}`);
        upgradedCheckFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error instanceof Error ? error.message : error}`);
      upgradedCheckFailed++;
    }
  }

  console.log(`\n📊 Upgraded Contracts Check: ${upgradedCheckPassed}/${upgradedContracts.length} passed`);

  // 依存関係の確認
  console.log('\n' + '='.repeat(60));
  console.log('🔗 Step 3: Checking Contract Dependencies');
  console.log('='.repeat(60) + '\n');

  try {
    const ymtAddress = loadAddress(network, V1_5_CONTRACTS.YMT);
    const veYmtAddress = loadAddress(network, V1_5_CONTRACTS.veYMT);
    const ymtVestingAddress = loadAddress(network, V1_5_CONTRACTS.YmtVesting);
    const ymtMinterAddress = loadProxyAddress(network, CONTRACT_NAMES.YmtMinter);
    const scoreWeightControllerAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreWeightController);
    const scoreRegistryAddress = loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry);
    const yamatoAddress = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
    const feePoolAddress = loadProxyAddress(network, CONTRACT_NAMES.FeePool);
    const currencyOSAddress = loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS);

    // YmtMinterの依存関係
    const ymtMinter = await hre.viem.getContractAt(V1_5_CONTRACTS.YmtMinter, ymtMinterAddress);
    const ymtFromMinter = await ymtMinter.read.YMT() as `0x${string}`;
    const controllerFromMinter = await ymtMinter.read.scoreWeightController() as `0x${string}`;
    
    console.log('📋 YmtMinter dependencies:');
    console.log(`   YMT: ${ymtFromMinter.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${ymtFromMinter}`);
    console.log(`   ScoreWeightController: ${controllerFromMinter.toLowerCase() === scoreWeightControllerAddress.toLowerCase() ? '✅' : '❌'} ${controllerFromMinter}`);

    // YMTの依存関係
    const ymt = await hre.viem.getContractAt(V1_5_CONTRACTS.YMT, ymtAddress);
    const minterFromYmt = await ymt.read.ymtMinter() as `0x${string}`;
    console.log('\n📋 YMT dependencies:');
    console.log(`   YmtMinter: ${minterFromYmt.toLowerCase() === ymtMinterAddress.toLowerCase() ? '✅' : '❌'} ${minterFromYmt}`);

    // YmtVestingの依存関係
    const ymtVesting = await hre.viem.getContractAt(V1_5_CONTRACTS.YmtVesting, ymtVestingAddress);
    const ymtFromVesting = await ymtVesting.read.ymtTokenAddress() as `0x${string}`;
    console.log('\n📋 YmtVesting dependencies:');
    console.log(`   YMT: ${ymtFromVesting.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${ymtFromVesting}`);

    // veYMTの依存関係
    const veYmt = await hre.viem.getContractAt(V1_5_CONTRACTS.veYMT, veYmtAddress);
    const tokenFromVeYmt = await veYmt.read.token() as `0x${string}`;
    console.log('\n📋 veYMT dependencies:');
    console.log(`   token (YMT): ${tokenFromVeYmt.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${tokenFromVeYmt}`);

    // ScoreWeightControllerの依存関係
    const scoreWeightController = await hre.viem.getContractAt(V1_5_CONTRACTS.ScoreWeightController, scoreWeightControllerAddress);
    const ymtFromController = await scoreWeightController.read.YMT() as `0x${string}`;
    const veYmtFromController = await scoreWeightController.read.veYMT() as `0x${string}`;
    console.log('\n📋 ScoreWeightController dependencies:');
    console.log(`   YMT: ${ymtFromController.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${ymtFromController}`);
    console.log(`   veYMT: ${veYmtFromController.toLowerCase() === veYmtAddress.toLowerCase() ? '✅' : '❌'} ${veYmtFromController}`);

    // ScoreRegistryの依存関係（191_check_setAddress.tsに合わせる）
    const scoreRegistry = await hre.viem.getContractAt(V1_5_CONTRACTS.ScoreRegistry, scoreRegistryAddress);
    const ymtFromRegistry = await scoreRegistry.read.YMT() as `0x${string}`;
    const veYmtFromRegistry = await scoreRegistry.read.veYMT() as `0x${string}`;
    const minterFromRegistry = await scoreRegistry.read.ymtMinter() as `0x${string}`;
    const controllerFromRegistry = await scoreRegistry.read.scoreWeightController() as `0x${string}`;
    const yamatoFromRegistry = await scoreRegistry.read.yamato() as `0x${string}`;
    console.log('\n📋 ScoreRegistry dependencies:');
    console.log(`   YMT: ${ymtFromRegistry.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${ymtFromRegistry}`);
    console.log(`   veYMT: ${veYmtFromRegistry.toLowerCase() === veYmtAddress.toLowerCase() ? '✅' : '❌'} ${veYmtFromRegistry}`);
    console.log(`   YmtMinter: ${minterFromRegistry.toLowerCase() === ymtMinterAddress.toLowerCase() ? '✅' : '❌'} ${minterFromRegistry}`);
    console.log(`   ScoreWeightController: ${controllerFromRegistry.toLowerCase() === scoreWeightControllerAddress.toLowerCase() ? '✅' : '❌'} ${controllerFromRegistry}`);
    console.log(`   Yamato: ${yamatoFromRegistry.toLowerCase() === yamatoAddress.toLowerCase() ? '✅' : '❌'} ${yamatoFromRegistry}`);

    // YamatoV4の依存関係（ScoreRegistry）
    // 注意: scoreRegistry()はYamatoV4以降にのみ存在する
    try {
      const yamato = await hre.viem.getContractAt(V1_CONTRACTS.Yamato, yamatoAddress);
      const scoreRegistryFromYamato = await yamato.read.scoreRegistry() as `0x${string}`;
      console.log('\n📋 YamatoV4 dependencies:');
      console.log(`   ScoreRegistry: ${scoreRegistryFromYamato.toLowerCase() === scoreRegistryAddress.toLowerCase() ? '✅' : '❌'} ${scoreRegistryFromYamato}`);
    } catch (error) {
      console.log('\n📋 YamatoV4 dependencies:');
      console.log(`   ⚠️  Could not check Yamato.scoreRegistry(): ${error instanceof Error ? error.message : error}`);
    }

    // FeePoolV2の依存関係（veYMT）
    const feePool = await hre.viem.getContractAt(V1_CONTRACTS.FeePool, feePoolAddress);
    const veYmtFromFeePool = await feePool.read.veYMT() as `0x${string}`;
    console.log('\n📋 FeePoolV2 dependencies:');
    console.log(`   veYMT: ${veYmtFromFeePool.toLowerCase() === veYmtAddress.toLowerCase() ? '✅' : '❌'} ${veYmtFromFeePool}`);

    // CurrencyOSV3の依存関係
    // 注意: これらの関数はCurrencyOSV3以降にのみ存在する
    try {
      const currencyOS = await hre.viem.getContractAt(V1_CONTRACTS.CurrencyOS, currencyOSAddress);
      const ymtFromCurrencyOS = await currencyOS.read.YMT() as `0x${string}`;
      const veYmtFromCurrencyOS = await currencyOS.read.veYMT() as `0x${string}`;
      const minterFromCurrencyOS = await currencyOS.read.ymtMinter() as `0x${string}`;
      const controllerFromCurrencyOS = await currencyOS.read.scoreWeightController() as `0x${string}`;
      console.log('\n📋 CurrencyOSV3 dependencies:');
      console.log(`   YMT: ${ymtFromCurrencyOS.toLowerCase() === ymtAddress.toLowerCase() ? '✅' : '❌'} ${ymtFromCurrencyOS}`);
      console.log(`   veYMT: ${veYmtFromCurrencyOS.toLowerCase() === veYmtAddress.toLowerCase() ? '✅' : '❌'} ${veYmtFromCurrencyOS}`);
      console.log(`   YmtMinter: ${minterFromCurrencyOS.toLowerCase() === ymtMinterAddress.toLowerCase() ? '✅' : '❌'} ${minterFromCurrencyOS}`);
      console.log(`   ScoreWeightController: ${controllerFromCurrencyOS.toLowerCase() === scoreWeightControllerAddress.toLowerCase() ? '✅' : '❌'} ${controllerFromCurrencyOS}`);
    } catch (error) {
      console.log('\n📋 CurrencyOSV3 dependencies:');
      console.log(`   ⚠️  Could not check CurrencyOSV3 dependencies: ${error instanceof Error ? error.message : error}`);
    }

    // 最終結果
    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Summary');
    console.log('='.repeat(60));
    console.log(`✅ v1.5 New Contracts: ${newImplCheckPassed}/${v15NewContracts.length} passed`);
    console.log(`✅ Upgraded Contracts: ${upgradedCheckPassed}/${upgradedContracts.length} passed`);
    
    const totalChecks = v15NewContracts.length + upgradedContracts.length;
    const totalPassed = newImplCheckPassed + upgradedCheckPassed;
    
    if (totalPassed === totalChecks && newImplCheckFailed === 0 && upgradedCheckFailed === 0) {
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

