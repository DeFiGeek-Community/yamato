import hre from 'hardhat';
import { execSync } from 'child_process';
import { loadImplementationAddress, loadAddress, loadProxyAddress, type NetworkName, hasAddress } from '../core/address-manager';
import { getCurrency, type Currency } from '../core/currency-manager';
import {
  V1_CONTRACTS,
  V1_5_CONTRACTS,
  V2_CONTRACTS,
  V2_CURRENCY_CONTRACTS,
  CONTRACT_NAMES,
} from '../core/contract-definitions';

/**
 * Etherscan検証スクリプト
 * 
 * デプロイされた全てのコントラクトの実装をEtherscanで検証します。
 * 
 * 実行方法:
 * ```bash
 * # 全てのコントラクトを検証
 * npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia
 * 
 * # 通貨別に検証（v2.0）
 * CURRENCY=CUSD npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia
 * ```
 */

/**
 * コントラクトの最新バージョン名を取得
 * 
 * @param contractNameBase - コントラクト名のベース（例: 'Yamato'）
 * @returns 最新バージョンのコントラクト名（例: 'YamatoV4'）
 */
function getLatestContractName(contractNameBase: string): string {
  // contract-definitions.tsから最新バージョンを判定
  const mapping: Record<string, string> = {
    'PriceFeed': V1_CONTRACTS.PriceFeed, // PriceFeedV3
    'FeePool': V1_CONTRACTS.FeePool, // FeePool
    'CurrencyOS': V2_CURRENCY_CONTRACTS.CurrencyOS, // CurrencyOSV4 (v2.0以降)
    'Yamato': V2_CURRENCY_CONTRACTS.Yamato, // YamatoV4 (v1.5アップグレード後)
    'YamatoDepositor': V2_CURRENCY_CONTRACTS.YamatoDepositor, // YamatoDepositorV3
    'YamatoBorrower': V2_CURRENCY_CONTRACTS.YamatoBorrower, // YamatoBorrowerV2
    'YamatoRepayer': V2_CURRENCY_CONTRACTS.YamatoRepayer, // YamatoRepayerV3
    'YamatoWithdrawer': V2_CURRENCY_CONTRACTS.YamatoWithdrawer, // YamatoWithdrawerV3
    'YamatoRedeemer': V2_CURRENCY_CONTRACTS.YamatoRedeemer, // YamatoRedeemerV5
    'YamatoSweeper': V2_CURRENCY_CONTRACTS.YamatoSweeper, // YamatoSweeperV3
    'Pool': V2_CURRENCY_CONTRACTS.Pool, // PoolV2
    'PriorityRegistry': V2_CURRENCY_CONTRACTS.PriorityRegistry, // PriorityRegistryV6
    'ScoreRegistry': V2_CURRENCY_CONTRACTS.ScoreRegistry, // ScoreRegistry
    'ScoreWeightController': 'ScoreWeightControllerV2', // v2.0でアップグレード
  };

  return mapping[contractNameBase] || contractNameBase;
}

/**
 * 検証を実行
 */
async function verifyContract(
  contractName: string,
  contractFilePath: string,
  address: string,
  constructorArgs?: string[]
): Promise<void> {
  const network = hre.network.name;
  
  // コンストラクタ引数がある場合は、JSON配列形式で渡す
  let command: string;
  if (constructorArgs && constructorArgs.length > 0) {
    const argsJson = JSON.stringify(constructorArgs);
    command = `npx hardhat verify --network ${network} --contract ${contractFilePath}:${contractName} ${address} --constructor-args '${argsJson}'`;
  } else {
    command = `npx hardhat verify --network ${network} --contract ${contractFilePath}:${contractName} ${address}`;
  }

  try {
    console.log(`   📝 Verifying ${contractName}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`   ✅ ${contractName} verified successfully!`);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    // 既に検証済みの場合はスキップ
    if (errorMessage.includes('Already Verified') || 
        errorMessage.includes('already verified') ||
        errorMessage.includes('Contract source code already verified')) {
      console.log(`   ⏭️  ${contractName} already verified`);
    } else {
      console.log(`   ⚠️  ${contractName} verification failed: ${errorMessage}`);
      // エラーでも続行
    }
  }
}

/**
 * プロキシ検証URLを表示
 */
function showProxyVerificationURLs(network: NetworkName, currency?: Currency): void {
  const networkName = network === 'localhost' ? 'localhost' : network;
  const baseURL = networkName === 'localhost' 
    ? '' 
    : `https://${networkName}.etherscan.io/proxyContractChecker?a=`;

  const contracts = [
    CONTRACT_NAMES.Yamato,
    CONTRACT_NAMES.YamatoDepositor,
    CONTRACT_NAMES.YamatoBorrower,
    CONTRACT_NAMES.YamatoRepayer,
    CONTRACT_NAMES.YamatoWithdrawer,
    CONTRACT_NAMES.YamatoRedeemer,
    CONTRACT_NAMES.YamatoSweeper,
    CONTRACT_NAMES.Pool,
    CONTRACT_NAMES.PriorityRegistry,
    CONTRACT_NAMES.ScoreRegistry,
    CONTRACT_NAMES.ScoreWeightController,
  ];

  console.log(`\n📋 Proxy Verification URLs:\n`);
  
  for (const contractName of contracts) {
    try {
      const proxyAddress = loadProxyAddress(network, contractName, currency);
      if (networkName !== 'localhost') {
        const url = `${baseURL}${proxyAddress}`;
        console.log(`   ${contractName}: ${url}`);
      }
    } catch (error) {
      // アドレスが存在しない場合はスキップ
    }
  }
  
  console.log(`\n   ℹ️  Open these URLs and continue with "Read as Proxy" configuration.\n`);
}

/**
 * メイン処理
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = process.env.CURRENCY as Currency | undefined;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Etherscan Verification`);
  console.log(`🌐 Network: ${network}`);
  if (currency) {
    console.log(`💱 Currency: ${currency}`);
  }
  console.log(`${'='.repeat(60)}\n`);

  if (network === 'localhost') {
    console.log('⚠️  localhostではEtherscan検証は実行できません。');
    return;
  }

  console.log('📖 Fetching deployment addresses...\n');

  let verifiedCount = 0;
  let skippedCount = 0;

  // ============================================================================
  // v1.0 コントラクト検証
  // ============================================================================

  // PriceFeed (v1.0でデプロイ)
  // CJPY用: 実装は共有
  // CUSD用: PriceFeedSingle
  // CEUR用: PriceFeedV3（実装はCJPY用と共有だが、プロキシは別）
  if (!currency || currency === 'CJPY') {
    // CJPY用: PriceFeedV3
    try {
      if (hasAddress(network, `${CONTRACT_NAMES.PriceFeed}Impl`)) {
        const priceFeedImpl = loadImplementationAddress(network, CONTRACT_NAMES.PriceFeed);
        await verifyContract(
          V1_CONTRACTS.PriceFeed,
          `contracts/${V1_CONTRACTS.PriceFeed}.sol:${V1_CONTRACTS.PriceFeed}`,
          priceFeedImpl
        );
        verifiedCount++;
      }
    } catch (error) {
      console.log(`   ⚠️  PriceFeed verification skipped: ${error}`);
      skippedCount++;
    }
  }
  
  // PriceFeedSingle (CUSD専用)
  if (currency === 'CUSD') {
    try {
      if (hasAddress(network, `${CONTRACT_NAMES.PriceFeedSingle}Impl`)) {
        const priceFeedSingleImpl = loadImplementationAddress(network, CONTRACT_NAMES.PriceFeedSingle);
        await verifyContract(
          V2_CONTRACTS.PriceFeedSingle,
          `contracts/${V2_CONTRACTS.PriceFeedSingle}.sol:${V2_CONTRACTS.PriceFeedSingle}`,
          priceFeedSingleImpl
        );
        verifiedCount++;
      }
    } catch (error) {
      console.log(`   ⚠️  PriceFeedSingle verification skipped: ${error}`);
      skippedCount++;
    }
  }
  
  // PriceFeed (CEUR用、実装はCJPY用と共有)
  if (currency === 'CEUR') {
    // CEUR用もPriceFeedV3を使用し、実装はCJPY用と共有
    // 既にCJPY用で検証済みなので、CEUR用の検証はスキップ（実装は同じ）
    console.log(`   ⏭️  PriceFeed (CEUR) uses same implementation as CJPY (already verified)`);
  }

  // CJPY/CUSD/CEUR
  const currencyToken = currency || 'CJPY';
  try {
    if (hasAddress(network, currencyToken)) {
      const tokenAddress = loadAddress(network, currencyToken);
      await verifyContract(
        currencyToken,
        `contracts/${currencyToken}.sol:${currencyToken}`,
        tokenAddress
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  ${currencyToken} verification skipped: ${error}`);
    skippedCount++;
  }

  // FeePool
  try {
    if (hasAddress(network, 'FeePoolImpl')) {
      const feePoolImpl = loadImplementationAddress(network, CONTRACT_NAMES.FeePool);
      const contractName = getLatestContractName('FeePool');
      await verifyContract(
        contractName,
        `contracts/${contractName}.sol:${contractName}`,
        feePoolImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  FeePool verification skipped: ${error}`);
    skippedCount++;
  }

  // CurrencyOS (実装は共有されているため、一度だけ検証)
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.CurrencyOS}Impl`)) {
      const currencyOSImpl = loadImplementationAddress(network, CONTRACT_NAMES.CurrencyOS);
      const contractName = getLatestContractName('CurrencyOS');
      await verifyContract(
        contractName,
        `contracts/${contractName}.sol:${contractName}`,
        currencyOSImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  CurrencyOS verification skipped: ${error}`);
    skippedCount++;
  }

  // Yamato (実装は共有されているため、一度だけ検証)
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.Yamato}Impl`)) {
      const yamatoImpl = loadImplementationAddress(network, CONTRACT_NAMES.Yamato);
      const contractName = getLatestContractName('Yamato');
      await verifyContract(
        contractName,
        `contracts/${contractName}.sol:${contractName}`,
        yamatoImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  Yamato verification skipped: ${error}`);
    skippedCount++;
  }

  // YamatoActions (実装は共有されているため、一度だけ検証)
  const yamatoActions = [
    CONTRACT_NAMES.YamatoDepositor,
    CONTRACT_NAMES.YamatoBorrower,
    CONTRACT_NAMES.YamatoRepayer,
    CONTRACT_NAMES.YamatoWithdrawer,
    CONTRACT_NAMES.YamatoRedeemer,
    CONTRACT_NAMES.YamatoSweeper,
  ];

  for (const actionName of yamatoActions) {
    try {
      if (hasAddress(network, `${actionName}Impl`)) {
        const actionImpl = loadImplementationAddress(network, actionName);
        const contractName = getLatestContractName(actionName);
        await verifyContract(
          contractName,
          `contracts/${contractName}.sol:${contractName}`,
          actionImpl
        );
        verifiedCount++;
      }
    } catch (error) {
      console.log(`   ⚠️  ${actionName} verification skipped: ${error}`);
      skippedCount++;
    }
  }

  // Pool (実装は共有されているため、一度だけ検証)
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.Pool}Impl`)) {
      const poolImpl = loadImplementationAddress(network, CONTRACT_NAMES.Pool);
      const contractName = getLatestContractName('Pool');
      await verifyContract(
        contractName,
        `contracts/${contractName}.sol:${contractName}`,
        poolImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  Pool verification skipped: ${error}`);
    skippedCount++;
  }

  // PriorityRegistry (実装は共有されているため、一度だけ検証)
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.PriorityRegistry}Impl`)) {
      const priorityRegistryImpl = loadImplementationAddress(network, CONTRACT_NAMES.PriorityRegistry);
      const contractName = getLatestContractName('PriorityRegistry');
      await verifyContract(
        contractName,
        `contracts/${contractName}.sol:${contractName}`,
        priorityRegistryImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  PriorityRegistry verification skipped: ${error}`);
    skippedCount++;
  }

  // ============================================================================
  // v1.5 コントラクト検証
  // ============================================================================

  // YMT
  try {
    if (hasAddress(network, V1_5_CONTRACTS.YMT)) {
      const ymtAddress = loadAddress(network, V1_5_CONTRACTS.YMT);
      const ymtVestingAddress = loadAddress(network, V1_5_CONTRACTS.YmtVesting);
      
      await verifyContract(
        V1_5_CONTRACTS.YMT,
        `contracts/${V1_5_CONTRACTS.YMT}.sol:${V1_5_CONTRACTS.YMT}`,
        ymtAddress,
        [ymtVestingAddress] // constructor args
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  YMT verification skipped: ${error}`);
    skippedCount++;
  }

  // veYMT
  try {
    if (hasAddress(network, V1_5_CONTRACTS.veYMT)) {
      const veYmtAddress = loadAddress(network, V1_5_CONTRACTS.veYMT);
      const ymtAddress = loadAddress(network, V1_5_CONTRACTS.YMT);
      
      await verifyContract(
        V1_5_CONTRACTS.veYMT,
        `contracts/${V1_5_CONTRACTS.veYMT}.sol:${V1_5_CONTRACTS.veYMT}`,
        veYmtAddress,
        [ymtAddress] // constructor args
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  veYMT verification skipped: ${error}`);
    skippedCount++;
  }

  // YmtVesting
  try {
    if (hasAddress(network, V1_5_CONTRACTS.YmtVesting)) {
      const ymtVestingAddress = loadAddress(network, V1_5_CONTRACTS.YmtVesting);
      
      await verifyContract(
        V1_5_CONTRACTS.YmtVesting,
        `contracts/${V1_5_CONTRACTS.YmtVesting}.sol:${V1_5_CONTRACTS.YmtVesting}`,
        ymtVestingAddress
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  YmtVesting verification skipped: ${error}`);
    skippedCount++;
  }

  // ScoreRegistry (実装は共有されているため、一度だけ検証)
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.ScoreRegistry}Impl`)) {
      const scoreRegistryImpl = loadImplementationAddress(network, CONTRACT_NAMES.ScoreRegistry);
      await verifyContract(
        V2_CURRENCY_CONTRACTS.ScoreRegistry,
        `contracts/${V2_CURRENCY_CONTRACTS.ScoreRegistry}.sol:${V2_CURRENCY_CONTRACTS.ScoreRegistry}`,
        scoreRegistryImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  ScoreRegistry verification skipped: ${error}`);
    skippedCount++;
  }

  // ScoreWeightController
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.ScoreWeightController}Impl`)) {
      const scoreWeightControllerImpl = loadImplementationAddress(
        network,
        CONTRACT_NAMES.ScoreWeightController
      );
      const contractName = getLatestContractName('ScoreWeightController');
      
      await verifyContract(
        contractName,
        `contracts/${contractName}.sol:${contractName}`,
        scoreWeightControllerImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  ScoreWeightController verification skipped: ${error}`);
    skippedCount++;
  }

  // YmtMinter
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.YmtMinter}Impl`)) {
      const ymtMinterImpl = loadImplementationAddress(network, CONTRACT_NAMES.YmtMinter);
      
      await verifyContract(
        V1_5_CONTRACTS.YmtMinter,
        `contracts/${V1_5_CONTRACTS.YmtMinter}.sol:${V1_5_CONTRACTS.YmtMinter}`,
        ymtMinterImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  YmtMinter verification skipped: ${error}`);
    skippedCount++;
  }

  // ============================================================================
  // v2.0 コントラクト検証
  // ============================================================================

  // YmtOS
  try {
    if (hasAddress(network, `${CONTRACT_NAMES.YmtOS}Impl`)) {
      const ymtOSImpl = loadImplementationAddress(network, CONTRACT_NAMES.YmtOS);
      
      await verifyContract(
        V2_CONTRACTS.YmtOS,
        `contracts/${V2_CONTRACTS.YmtOS}.sol:${V2_CONTRACTS.YmtOS}`,
        ymtOSImpl
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  YmtOS verification skipped: ${error}`);
    skippedCount++;
  }

  // PledgeLib
  try {
    if (hasAddress(network, V1_CONTRACTS.PledgeLib)) {
      const pledgeLibAddress = loadAddress(network, V1_CONTRACTS.PledgeLib);
      
      await verifyContract(
        V1_CONTRACTS.PledgeLib,
        `contracts/Dependencies/${V1_CONTRACTS.PledgeLib}.sol:${V1_CONTRACTS.PledgeLib}`,
        pledgeLibAddress
      );
      verifiedCount++;
    }
  } catch (error) {
    console.log(`   ⚠️  PledgeLib verification skipped: ${error}`);
    skippedCount++;
  }

  // ============================================================================
  // プロキシ検証URL表示
  // ============================================================================

  showProxyVerificationURLs(network, currency);

  // ============================================================================
  // サマリー
  // ============================================================================

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 Verification Summary:`);
  console.log(`   ✅ Verified: ${verifiedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   🌐 Network: ${network}`);
  if (currency) {
    console.log(`   💱 Currency: ${currency}`);
  }
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

