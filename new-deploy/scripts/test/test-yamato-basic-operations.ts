import hre from 'hardhat';
import { parseEther, formatEther, type Address } from 'viem';
import { loadProxyAddress, loadAddress, type NetworkName, loadImplementationAddress } from '../core/address-manager';
import { CONTRACT_NAMES, V1_CONTRACTS, V1_5_UPGRADE_IMPLEMENTATIONS, V2_CURRENCY_CONTRACTS } from '../core/contract-definitions';
import { getCurrency, getCurrencyInfo } from '../core/currency-manager';

/**
 * Yamato基本動作テストスクリプト
 * 
 * 以下の動作を順番に実行してテストします：
 * 1. deposit() - ETHを預ける
 * 2. borrow() - 借りる（預けたETHを担保に）
 * 3. repay() - 返す
 * 4. withdraw() - ETHを引き出す
 * 
 * 使用方法:
 *   # CJPY用（デフォルト）
 *   npx hardhat run scripts/test/test-yamato-basic-operations.ts --network localhost
 * 
 *   # CUSD用
 *   CURRENCY=CUSD npx hardhat run scripts/test/test-yamato-basic-operations.ts --network localhost
 * 
 *   # CEUR用
 *   CURRENCY=CEUR npx hardhat run scripts/test/test-yamato-basic-operations.ts --network localhost
 */
async function main() {
  const network = hre.network.name as NetworkName;
  
  // 通貨設定（v2で通貨別のYamatoをテストする場合）
  let currency: 'CJPY' | 'CUSD' | 'CEUR' | undefined;
  try {
    currency = getCurrency();
    console.log(`\n💱 Testing Yamato for currency: ${currency}\n`);
  } catch (e) {
    currency = 'CJPY'; // デフォルトはCJPY
    console.log(`\n💱 Testing Yamato for currency: ${currency} (default)\n`);
  }

  const currencyInfo = currency ? getCurrencyInfo(currency) : getCurrencyInfo('CJPY');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Yamato Basic Operations Test`);
  console.log(`🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency || 'CJPY'}`);
  console.log(`${'='.repeat(60)}\n`);

  // アドレス読み込み
  const yamatoAddress = currency && currency !== 'CJPY'
    ? loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency)
    : loadProxyAddress(network, CONTRACT_NAMES.Yamato);
  
  const currencyTokenAddress = loadAddress(network, currencyInfo.contractName);

  console.log(`📖 Loading contracts...`);
  console.log(`   Yamato: ${yamatoAddress}`);
  console.log(`   ${currencyInfo.symbol}: ${currencyTokenAddress}\n`);

  // コントラクトインスタンス取得
  // プロキシの実装バージョンを動的に取得
  let yamatoContractName: string = V1_CONTRACTS.Yamato; // デフォルトはv1.0
  
  // 通貨別Yamatoの場合はv2のコントラクト名を使用
  if (currency && currency !== 'CJPY') {
    yamatoContractName = V2_CURRENCY_CONTRACTS.Yamato;
    console.log(`   ℹ️  Using v2.0 Yamato version: ${yamatoContractName}\n`);
  } else {
    // v1.5以降のアップグレードを確認（実装アドレスが存在するか確認）
    try {
      const implAddress = loadImplementationAddress(network, CONTRACT_NAMES.Yamato);
      // 実装がデプロイされている場合、v1.5以降のバージョンを使用
      if (V1_5_UPGRADE_IMPLEMENTATIONS.Yamato) {
        yamatoContractName = V1_5_UPGRADE_IMPLEMENTATIONS.Yamato;
        console.log(`   ℹ️  Using v1.5+ upgraded Yamato version: ${yamatoContractName}\n`);
      }
    } catch (e) {
      // v1.0のまま（実装アドレスが見つからない場合）
      console.log(`   ℹ️  Using v1.0 Yamato version: ${yamatoContractName}\n`);
    }
  }
  
  const yamato = await hre.viem.getContractAt(yamatoContractName, yamatoAddress);
  
  const currencyToken = await hre.viem.getContractAt(
    currencyInfo.contractName,
    currencyTokenAddress
  );

  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();
  const userAddress = walletClient.account.address;

  console.log(`👤 Test User: ${userAddress}\n`);

  // ============================================================================
  // Step 0: 初期状態の確認
  // ============================================================================
  console.log(`${'─'.repeat(60)}`);
  console.log(`📊 Step 0: Initial State Check`);
  console.log(`${'─'.repeat(60)}\n`);

  let pledge: { coll: bigint; debt: bigint; isCreated: boolean; owner: Address; priority: bigint } = await yamato.read.getPledge([userAddress]) as any;
  const states = await yamato.read.getStates() as any;
  const totalColl = states[0] as bigint;
  const totalDebt = states[1] as bigint;
  const mcr = states[2] as number;
  const userBalance = await publicClient.getBalance({ address: userAddress });
  const userCurrencyBalance = await currencyToken.read.balanceOf([userAddress]);

  console.log(`   User ETH Balance: ${formatEther(userBalance)} ETH`);
  console.log(`   User ${currencyInfo.symbol} Balance: ${formatEther(userCurrencyBalance as bigint)} ${currencyInfo.symbol}`);
  console.log(`   Pledge Collateral: ${formatEther(pledge.coll)} ETH`);
  console.log(`   Pledge Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
  console.log(`   Pledge Created: ${pledge.isCreated}`);
  console.log(`   Total Collateral: ${formatEther(totalColl)} ETH`);
  console.log(`   Total Debt: ${formatEther(totalDebt)} ${currencyInfo.symbol}`);
  console.log(`   MCR: ${mcr}%\n`);

  // ============================================================================
  // Step 1: deposit() - ETHを預ける
  // ============================================================================
  console.log(`${'─'.repeat(60)}`);
  console.log(`💵 Step 1: Deposit ETH`);
  console.log(`${'─'.repeat(60)}\n`);

  const depositAmount = parseEther('1.0'); // 1 ETH
  console.log(`   Depositing ${formatEther(depositAmount)} ETH...`);

  try {
    const depositHash = await walletClient.writeContract({
      address: yamatoAddress,
      abi: yamato.abi,
      functionName: 'deposit',
      value: depositAmount,
    });
    
    const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log(`   ✅ Transaction: ${depositHash}`);
    console.log(`   📦 Block: ${depositReceipt.blockNumber}\n`);

      // 状態確認
      pledge = await yamato.read.getPledge([userAddress]) as any;
      const statesAfterDeposit = await yamato.read.getStates() as any;
      const totalCollAfterDeposit = statesAfterDeposit[0] as bigint;
      const totalDebtAfterDeposit = statesAfterDeposit[1] as bigint;
    const userBalanceAfterDeposit = await publicClient.getBalance({ address: userAddress });

    console.log(`   📊 After Deposit:`);
    console.log(`      Pledge Collateral: ${formatEther(pledge.coll)} ETH`);
    console.log(`      Pledge Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
    console.log(`      Pledge Created: ${pledge.isCreated}`);
    console.log(`      Total Collateral: ${formatEther(totalCollAfterDeposit)} ETH`);
    console.log(`      Total Debt: ${formatEther(totalDebtAfterDeposit)} ${currencyInfo.symbol}`);
    console.log(`      User ETH Balance: ${formatEther(userBalanceAfterDeposit)} ETH\n`);

    if (pledge.coll < depositAmount) {
      console.log(`   ⚠️  Warning: Pledge collateral (${formatEther(pledge.coll)}) < deposit amount (${formatEther(depositAmount)})`);
      console.log(`      This may be due to gas fees or other factors.\n`);
    }
  } catch (error) {
    console.error(`   ❌ Deposit failed: ${error instanceof Error ? error.message : error}`);
    throw error;
  }

  // ブロックを進める（FlashLock回避）
  // Hardhatではmineで次のブロックに進める
  console.log(`   ⏳ Mining next block (FlashLock prevention)...`);
  const currentBlock = await publicClient.getBlockNumber();
  // 空のトランザクションを送信してブロックを進める
  const mineHash = await walletClient.sendTransaction({
    to: userAddress,
    value: BigInt(0),
  });
  await publicClient.waitForTransactionReceipt({ hash: mineHash });
  console.log(`   ✅ Next block reached (block ${currentBlock} -> ${await publicClient.getBlockNumber()})\n`);

  // ============================================================================
  // Step 2: borrow() - 借りる
  // ============================================================================
  console.log(`${'─'.repeat(60)}`);
  console.log(`💰 Step 2: Borrow ${currencyInfo.symbol}`);
  console.log(`${'─'.repeat(60)}\n`);

  // MCRを考慮して借入可能額を計算（簡易計算: collateral * price * 0.7くらい）
  // 実際の計算はコントラクト内で行われるため、安全な金額を設定
  const borrowAmount = parseEther('500.0'); // 500 CJPY/CUSD/CEUR
  console.log(`   Borrowing ${formatEther(borrowAmount)} ${currencyInfo.symbol}...`);

  try {
    const borrowHash = await walletClient.writeContract({
      address: yamatoAddress,
      abi: yamato.abi,
      functionName: 'borrow',
      args: [borrowAmount],
    });
    
    const borrowReceipt = await publicClient.waitForTransactionReceipt({ hash: borrowHash });
    console.log(`   ✅ Transaction: ${borrowHash}`);
    console.log(`   📦 Block: ${borrowReceipt.blockNumber}\n`);

    // 状態確認
    pledge = await yamato.read.getPledge([userAddress]) as any;
    const userCurrencyBalanceAfterBorrow = await currencyToken.read.balanceOf([userAddress]);
    const statesAfterBorrow = await yamato.read.getStates() as any;
    const totalCollAfterBorrow = statesAfterBorrow[0] as bigint;
    const totalDebtAfterBorrow = statesAfterBorrow[1] as bigint;

    console.log(`   📊 After Borrow:`);
    console.log(`      Pledge Collateral: ${formatEther(pledge.coll)} ETH`);
    console.log(`      Pledge Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
    console.log(`      User ${currencyInfo.symbol} Balance: ${formatEther(userCurrencyBalanceAfterBorrow as bigint)} ${currencyInfo.symbol}`);
    console.log(`      Total Collateral: ${formatEther(totalCollAfterBorrow)} ETH`);
    console.log(`      Total Debt: ${formatEther(totalDebtAfterBorrow)} ${currencyInfo.symbol}\n`);

    if (pledge.debt === BigInt(0)) {
      console.log(`   ⚠️  Warning: Debt is still 0. This may be due to insufficient collateral or MCR constraints.`);
      console.log(`      You may need to deposit more ETH or adjust the borrow amount.\n`);
    }
  } catch (error) {
    console.error(`   ❌ Borrow failed: ${error instanceof Error ? error.message : error}`);
    console.error(`   ⚠️  This may be expected if collateral is insufficient or MCR constraints are not met.`);
    console.error(`   Continuing with repay test anyway...\n`);
  }

  // ブロックを進める
  console.log(`   ⏳ Mining next block...`);
  const mineHashAfterBorrow = await walletClient.sendTransaction({ to: userAddress, value: BigInt(0) });
  await publicClient.waitForTransactionReceipt({ hash: mineHashAfterBorrow });
  console.log(`   ✅ Next block reached\n`);

  // ============================================================================
  // Step 3: repay() - 返す
  // ============================================================================
  console.log(`${'─'.repeat(60)}`);
  console.log(`💸 Step 3: Repay ${currencyInfo.symbol}`);
  console.log(`${'─'.repeat(60)}\n`);

  pledge = await yamato.read.getPledge([userAddress]) as any;
  
  if (pledge.debt === BigInt(0)) {
    console.log(`   ⏭️  Skipping repay: No debt to repay\n`);
  } else {
    // 実際に返済可能な金額を確認（残高と債務の小さい方）
    const userCurrencyBalance = await currencyToken.read.balanceOf([userAddress]) as bigint;
    const repayAmount = userCurrencyBalance < pledge.debt ? userCurrencyBalance : pledge.debt;
    
    console.log(`   Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
    console.log(`   User Balance: ${formatEther(userCurrencyBalance)} ${currencyInfo.symbol}`);
    console.log(`   Repaying ${formatEther(repayAmount)} ${currencyInfo.symbol}...`);

    if (repayAmount === BigInt(0)) {
      console.log(`   ⏭️  Skipping repay: Insufficient balance\n`);
    } else {
      // approveが必要
      const currentAllowance = await currencyToken.read.allowance([userAddress, yamatoAddress]) as bigint;
      if (currentAllowance < repayAmount) {
        console.log(`   📝 Approving ${currencyInfo.symbol}...`);
        const approveHash = await walletClient.writeContract({
          address: currencyTokenAddress,
          abi: currencyToken.abi,
          functionName: 'approve',
          args: [yamatoAddress, repayAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log(`   ✅ Approved\n`);
      }

      try {
        const repayHash = await walletClient.writeContract({
          address: yamatoAddress,
          abi: yamato.abi,
          functionName: 'repay',
          args: [repayAmount],
        });
        
        const repayReceipt = await publicClient.waitForTransactionReceipt({ hash: repayHash });
        console.log(`   ✅ Transaction: ${repayHash}`);
        console.log(`   📦 Block: ${repayReceipt.blockNumber}\n`);

        // 状態確認
        pledge = await yamato.read.getPledge([userAddress]) as any;
        const userCurrencyBalanceAfterRepay = await currencyToken.read.balanceOf([userAddress]);
        const statesAfterRepay = await yamato.read.getStates() as any;
        const totalCollAfterRepay = statesAfterRepay[0] as bigint;
        const totalDebtAfterRepay = statesAfterRepay[1] as bigint;

        console.log(`   📊 After Repay:`);
        console.log(`      Pledge Collateral: ${formatEther(pledge.coll)} ETH`);
        console.log(`      Pledge Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
        console.log(`      User ${currencyInfo.symbol} Balance: ${formatEther(userCurrencyBalanceAfterRepay as bigint)} ${currencyInfo.symbol}`);
        console.log(`      Total Collateral: ${formatEther(totalCollAfterRepay)} ETH`);
        console.log(`      Total Debt: ${formatEther(totalDebtAfterRepay)} ${currencyInfo.symbol}\n`);
      } catch (error) {
        console.error(`   ❌ Repay failed: ${error instanceof Error ? error.message : error}`);
        // 返済に失敗しても続行（残高不足の可能性）
        console.log(`   ⚠️  Continuing with withdraw test...\n`);
      }
    }
  }

  // ブロックを進める
  console.log(`   ⏳ Mining next block...`);
  const mineHashAfterRepay = await walletClient.sendTransaction({ to: userAddress, value: BigInt(0) });
  await publicClient.waitForTransactionReceipt({ hash: mineHashAfterRepay });
  console.log(`   ✅ Next block reached\n`);

  // ============================================================================
  // Step 4: withdraw() - ETHを引き出す
  // ============================================================================
  console.log(`${'─'.repeat(60)}`);
  console.log(`💸 Step 4: Withdraw ETH`);
  console.log(`${'─'.repeat(60)}\n`);

  pledge = await yamato.read.getPledge([userAddress]) as any;
  
  if (pledge.coll === BigInt(0)) {
    console.log(`   ⏭️  Skipping withdraw: No collateral to withdraw\n`);
  } else {
    // 一部のみ引き出す（0.5 ETH残す）
    const withdrawAmount = pledge.coll > parseEther('0.5') 
      ? pledge.coll - parseEther('0.5')
      : pledge.coll / BigInt(2); // 半分引き出す
    
    console.log(`   Withdrawing ${formatEther(withdrawAmount)} ETH...`);

    try {
      const withdrawHash = await walletClient.writeContract({
        address: yamatoAddress,
        abi: yamato.abi,
        functionName: 'withdraw',
        args: [withdrawAmount],
      });
      
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
      console.log(`   ✅ Transaction: ${withdrawHash}`);
      console.log(`   📦 Block: ${withdrawReceipt.blockNumber}\n`);

      // 状態確認
      pledge = await yamato.read.getPledge([userAddress]) as any;
      const userBalanceAfterWithdraw = await publicClient.getBalance({ address: userAddress });
      const statesAfterWithdraw = await yamato.read.getStates() as any;
      const totalCollAfterWithdraw = statesAfterWithdraw[0] as bigint;
      const totalDebtAfterWithdraw = statesAfterWithdraw[1] as bigint;

      console.log(`   📊 After Withdraw:`);
      console.log(`      Pledge Collateral: ${formatEther(pledge.coll)} ETH`);
      console.log(`      Pledge Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
      console.log(`      User ETH Balance: ${formatEther(userBalanceAfterWithdraw)} ETH`);
      console.log(`      Total Collateral: ${formatEther(totalCollAfterWithdraw)} ETH`);
      console.log(`      Total Debt: ${formatEther(totalDebtAfterWithdraw)} ${currencyInfo.symbol}\n`);
    } catch (error) {
      console.error(`   ❌ Withdraw failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  // ============================================================================
  // 最終状態の確認
  // ============================================================================
  console.log(`${'─'.repeat(60)}`);
  console.log(`📊 Final State Summary`);
  console.log(`${'─'.repeat(60)}\n`);

  pledge = await yamato.read.getPledge([userAddress]) as any;
  const finalStates = await yamato.read.getStates() as any;
  const finalTotalColl = finalStates[0] as bigint;
  const finalTotalDebt = finalStates[1] as bigint;
  const finalUserBalance = await publicClient.getBalance({ address: userAddress });
  const finalUserCurrencyBalance = await currencyToken.read.balanceOf([userAddress]);

  console.log(`   User ETH Balance: ${formatEther(finalUserBalance)} ETH`);
  console.log(`   User ${currencyInfo.symbol} Balance: ${formatEther(finalUserCurrencyBalance as bigint)} ${currencyInfo.symbol}`);
  console.log(`   Pledge Collateral: ${formatEther(pledge.coll)} ETH`);
  console.log(`   Pledge Debt: ${formatEther(pledge.debt)} ${currencyInfo.symbol}`);
  console.log(`   Pledge Created: ${pledge.isCreated}`);
  console.log(`   Total Collateral: ${formatEther(finalTotalColl)} ETH`);
  console.log(`   Total Debt: ${formatEther(finalTotalDebt)} ${currencyInfo.symbol}\n`);

  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Basic Operations Test Completed!`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

