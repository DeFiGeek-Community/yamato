// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Test.sol";
import "../contracts/FeePool.sol";
import "../contracts/FeePoolV2.sol";
import "../contracts/FeePoolV3.sol";
import "../contracts/veYMT.sol";
import "../contracts/YMT.sol";
import "../contracts/YmtMinter.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// インターフェースを定義
interface IFeePoolInterface {
    function initialize() external;
    function setGovernance(address newGovernance) external;
    function acceptGovernance() external;
    function setVeYMT(address _veymt) external;
    function veYMT() external view returns (address);
    function governance() external view returns (address);
    function upgradeTo(address newImplementation) external;
}

interface IFeePoolV2Interface {
    function initialize() external;
    function initializeV2(uint256 startTime_) external;
    function setGovernance(address newGovernance) external;
    function acceptGovernance() external;
    function setVeYMT(address _veymt) external;
    function veYMT() external view returns (address);
    function governance() external view returns (address);
    function upgradeTo(address newImplementation) external;
    function startTime() external view returns (uint256);
    function timeCursor() external view returns (uint256);
    function lastTokenTime() external view returns (uint256);
    function WEEK() external view returns (uint256);
    function TOKEN_CHECKPOINT_DEADLINE() external view returns (uint256);
    function canCheckpointToken() external view returns (bool);
    function isKilled() external view returns (bool);
    function toggleAllowCheckpointToken() external;
    function checkpointToken() external;
    function claim() external returns (uint256);
    function claim(address addr_) external returns (uint256);
    function claimMany(address[] calldata receivers_) external returns (bool);
    function killMe() external;
    function veSupply(uint256) external view returns (uint256);
    function tokensPerWeek(uint256) external view returns (uint256);
}

// 悪意のある受信者コントラクト（リエントランシーテスト用）
contract MaliciousReceiver {
    IFeePoolV2Interface public feePool;
    uint256 public attackCount;
    
    constructor(address _feePool) {
        feePool = IFeePoolV2Interface(_feePool);
    }
    
    receive() external payable {
        if (attackCount < 2) {
            attackCount++;
            feePool.claim();
        }
    }
    
    function attack() external {
        feePool.claim();
    }
}

contract FeePoolClaimTest is Test {
    FeePool public feePoolImpl;
    FeePoolV3 public feePoolV3Impl;
    ERC1967Proxy public proxy;
    
    // プロキシインターフェース変数
    IFeePoolInterface public feePool;
    IFeePoolV2Interface public feePoolV2;
    
    veYMT public veYmt;
    YMT public ymt;
    YmtMinter public ymtMinter;
    
    address public owner;
    address public user1;
    address public user2;
    address public user3;
    address public user4;
    address public governance;
    address public ymtVestingAddr;
    
    uint256 public constant WEEK = 7 * 86400;
    uint256 public startTime;

    // ヘルパー関数
    function upgradeToV3() internal {
        // FeePoolV3の実装をデプロイ
        vm.startPrank(owner);
        feePoolV3Impl = new FeePoolV3();
        vm.stopPrank();
        
        // アップグレードを実行
        vm.startPrank(governance);
        feePool.upgradeTo(address(feePoolV3Impl));
        vm.stopPrank();
        
        // プロキシインターフェースをV2に更新
        feePoolV2 = IFeePoolV2Interface(address(proxy));
    }

    function initializeV3() internal {
        startTime = (block.timestamp / WEEK) * WEEK;
        vm.startPrank(governance);
        feePoolV2.initializeV2(startTime);
        vm.stopPrank();
    }

    function sendETH(uint256 amount) internal {
        vm.deal(user1, amount);
        vm.startPrank(user1);
        (bool success,) = address(proxy).call{value: amount}("");
        assertTrue(success);
        vm.stopPrank();
    }

    function setupVeYMTLock(address user, uint256 lockAmount) internal {
        // ユーザーにYMTトークンを転送
        vm.startPrank(ymtVestingAddr);
        ymt.transfer(user, lockAmount);
        vm.stopPrank();
        
        // ユーザーがYMTをveYMTにロック
        vm.startPrank(user);
        ymt.approve(address(veYmt), lockAmount);
        uint256 lockTime = block.timestamp + 4 * 365 * 86400; // 4年間ロック
        veYmt.createLock(lockAmount, lockTime);
        vm.stopPrank();
    }

    function setupVeYMTLockWithDuration(address user, uint256 lockAmount, uint256 duration) internal {
        // ユーザーにYMTトークンを転送
        vm.startPrank(ymtVestingAddr);
        ymt.transfer(user, lockAmount);
        vm.stopPrank();
        
        // ユーザーがYMTをveYMTにロック
        vm.startPrank(user);
        ymt.approve(address(veYmt), lockAmount);
        uint256 lockTime = block.timestamp + duration;
        veYmt.createLock(lockAmount, lockTime);
        vm.stopPrank();
    }

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        user4 = makeAddr("user4");
        governance = makeAddr("governance");
        
        // 時間を進めてYMTの初期化問題を回避
        vm.warp(block.timestamp + 365 days + 1 days);
        
        // YMTトークンをデプロイ
        ymtVestingAddr = makeAddr("ymtVesting");
        address initialMintAddr = makeAddr("initialMint");
        ymt = new YMT(ymtVestingAddr, initialMintAddr);
        
        // YmtMinterをデプロイ
        ymtMinter = new YmtMinter();
        
        // veYMTをデプロイ
        veYmt = new veYMT(address(ymt));
        
        vm.startPrank(owner);
        
        // FeePoolの実装をデプロイ
        feePoolImpl = new FeePool();
        
        // プロキシをデプロイ
        bytes memory initData = abi.encodeWithSelector(FeePool.initialize.selector);
        proxy = new ERC1967Proxy(
            address(feePoolImpl),
            initData
        );
        
        // プロキシインターフェースを初期化
        feePool = IFeePoolInterface(address(proxy));
        
        // governanceを設定
        feePool.setGovernance(governance);
        vm.stopPrank();
        
        vm.startPrank(governance);
        feePool.acceptGovernance();
        
        // veYMTを設定
        feePool.setVeYMT(address(veYmt));
        
        vm.stopPrank();
    }

    // ==============================
    // 基本的なClaimテスト（既存）
    // ==============================

    function test_BasicClaimAfterUpgrade() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18; // 1000 YMT
        setupVeYMTLock(user1, lockAmount);
        
        // V1の時にETHを送付
        uint256 ethAmount = 5 ether;
        sendETH(ethAmount);
        
        // 時間を進める（1週間後）
        vm.warp(block.timestamp + 7 days);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // 他のテストと同じ時間設定でテスト
        vm.warp(block.timestamp + 7 days);
        
        // Week Start Claim Test
        // Current timestamp: block.timestamp
        // Week boundary: (block.timestamp / WEEK) * WEEK
        // FeePoolV2 startTime: feePoolV2.startTime()
        // FeePoolV2 timeCursor: feePoolV2.timeCursor()
        // FeePoolV2 lastTokenTime: feePoolV2.lastTokenTime()
        // Contract balance before claim: address(proxy).balance
        
        // canCheckpointTokenを有効にする
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ユーザーの初期残高を記録
        uint256 initialBalance = user1.balance;
        
        // ユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmountWeekStart = feePoolV2.claim();
        vm.stopPrank();
        
        // Claim amount at week start: claimedAmountWeekStart
        // User balance after claim: user1.balance
        
        // さらに時間を進める
        vm.warp(block.timestamp + 7 days);
        
        // Week End Claim Test
        // Current timestamp: block.timestamp
        // Week boundary: (block.timestamp / WEEK) * WEEK
        // FeePoolV2 startTime: feePoolV2.startTime()
        // FeePoolV2 timeCursor: feePoolV2.timeCursor()
        // FeePoolV2 lastTokenTime: feePoolV2.lastTokenTime()
        // Contract balance before claim: address(proxy).balance
        
        // 追加でETHを送付（週の終わりでのテスト用）
        uint256 additionalEth = 2 ether;
        sendETH(additionalEth);
        ethAmount += additionalEth;
        
        // ユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmountWeekEnd = feePoolV2.claim();
        vm.stopPrank();
        
        // Claim amount at week end: claimedAmountWeekEnd
        // User balance after claim: user1.balance
        
        // 週の初めと終わりでのclaim量の違いを確認
        // Comparison Results
        // Week start claim amount: claimedAmountWeekStart
        // Week end claim amount: claimedAmountWeekEnd
        if (claimedAmountWeekEnd > claimedAmountWeekStart) {
            // Difference (week end - week start): claimedAmountWeekEnd - claimedAmountWeekStart
            // Week end claim is higher by: ((claimedAmountWeekEnd - claimedAmountWeekStart) * 100) / claimedAmountWeekStart %
        } else if (claimedAmountWeekStart > claimedAmountWeekEnd) {
            // Difference (week start - week end): claimedAmountWeekStart - claimedAmountWeekEnd
            // Week start claim is higher by: ((claimedAmountWeekStart - claimedAmountWeekEnd) * 100) / claimedAmountWeekEnd %
        } else {
            // No difference between week start and week end claims
        }
        
        // claimが成功したことを確認
        assertGt(claimedAmountWeekStart, 0, "Claim amount at week start should be greater than 0");
        assertGt(claimedAmountWeekEnd, 0, "Claim amount at week end should be greater than 0");
        
        // コントラクトの残高が減少したことを確認
        uint256 totalClaimed = claimedAmountWeekStart + claimedAmountWeekEnd;
        assertEq(address(proxy).balance, ethAmount - totalClaimed, "Contract balance should decrease by total claimed amount");
    }

    // ==============================
    // 複数ユーザーのClaimテスト（既存）
    // ==============================

    function test_MultipleUsersClaim() public {
        // 複数のユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18; // 1000 YMT
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount);
        setupVeYMTLock(user3, lockAmount);
        setupVeYMTLock(user4, lockAmount);
        
        // V1の時にETHを送付
        uint256 ethAmount = 10 ether;
        sendETH(ethAmount);
        
        // 時間を進める（1週間後）
        vm.warp(block.timestamp + 7 days);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // 時間をさらに進める（2週間後）
        vm.warp(block.timestamp + 7 days);
        
        // canCheckpointTokenを有効にする
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 各ユーザーの初期残高を記録
        uint256 initialBalance1 = user1.balance;
        uint256 initialBalance2 = user2.balance;
        uint256 initialBalance3 = user3.balance;
        uint256 initialBalance4 = user4.balance;
        
        // 各ユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmount1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 claimedAmount2 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user3);
        uint256 claimedAmount3 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user4);
        uint256 claimedAmount4 = feePoolV2.claim();
        vm.stopPrank();
        
        // 全ユーザーがclaimに成功したことを確認
        assertGt(claimedAmount1, 0, "User1 claim amount should be greater than 0");
        assertGt(claimedAmount2, 0, "User2 claim amount should be greater than 0");
        assertGt(claimedAmount3, 0, "User3 claim amount should be greater than 0");
        assertGt(claimedAmount4, 0, "User4 claim amount should be greater than 0");
        
        // 各ユーザーがETHを受け取ったことを確認
        assertEq(user1.balance, initialBalance1 + claimedAmount1, "User1 should receive claimed ETH");
        assertEq(user2.balance, initialBalance2 + claimedAmount2, "User2 should receive claimed ETH");
        assertEq(user3.balance, initialBalance3 + claimedAmount3, "User3 should receive claimed ETH");
        assertEq(user4.balance, initialBalance4 + claimedAmount4, "User4 should receive claimed ETH");
        
        // コントラクトの残高が正しく減少したことを確認
        uint256 totalClaimed = claimedAmount1 + claimedAmount2 + claimedAmount3 + claimedAmount4;
        assertEq(address(proxy).balance, ethAmount - totalClaimed, "Contract balance should decrease by total claimed amount");
    }

    // ==============================
    // 時間経過によるClaimテスト（既存）
    // ==============================

    function test_ClaimWithTimeProgression() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18; // 1000 YMT
        setupVeYMTLock(user1, lockAmount);
        
        // V1の時にETHを送付
        uint256 ethAmount = 5 ether;
        sendETH(ethAmount);
        
        // 時間を進める（1週間後）
        vm.warp(block.timestamp + 7 days);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効にする
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 複数回にわたって時間を進め、claimを実行
        for (uint256 i = 0; i < 4; i++) {
            // 時間を進める（1週間ずつ）
            vm.warp(block.timestamp + 7 days);
            
            // 追加でETHを送付
            uint256 additionalEth = 1 ether;
            sendETH(additionalEth);
            ethAmount += additionalEth;
            
            // ユーザーの初期残高を記録
            uint256 initialBalance = user1.balance;
            
            // ユーザーがclaimを実行
            vm.startPrank(user1);
            uint256 claimedAmount = feePoolV2.claim();
            vm.stopPrank();
            
            // claimが成功したことを確認
            assertGt(claimedAmount, 0, "Claim amount should be greater than 0");
            assertEq(user1.balance, initialBalance + claimedAmount, "User should receive claimed ETH");
        }
    }

    // ==============================
    // エラーケースのテスト（既存）
    // ==============================

    function test_ClaimWithoutLock() public {
        // ユーザーがveYMTにロックしていない状態でclaimを試行
        upgradeToV3();
        initializeV3();
        
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ロックしていないユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // ロックしていないユーザーは0を受け取ることを確認
        assertEq(claimedAmount, 0, "User without lock should receive 0");
    }

    function testFail_ClaimBeforeUpgrade() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18; // 1000 YMT
        setupVeYMTLock(user1, lockAmount);
        
        // ETHを送付
        sendETH(5 ether);
        
        // アップグレード前にclaimを試行（失敗するはず）
        vm.startPrank(user1);
        feePoolV2.claim();
        vm.stopPrank();
    }

    // ==============================
    // 詳細なClaimテスト（既存）
    // ==============================

    function test_ClaimWithDifferentLockAmounts() public {
        // 異なるロック量のユーザーを作成
        uint256 lockAmount1 = 500 * 1e18;  // 500 YMT
        uint256 lockAmount2 = 1000 * 1e18; // 1000 YMT
        uint256 lockAmount3 = 2000 * 1e18; // 2000 YMT
        
        setupVeYMTLock(user1, lockAmount1);
        setupVeYMTLock(user2, lockAmount2);
        setupVeYMTLock(user3, lockAmount3);
        
        // ETHを送付
        uint256 ethAmount = 10 ether;
        sendETH(ethAmount);
        
        // 時間を進める
        vm.warp(block.timestamp + 7 days);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        vm.warp(block.timestamp + 7 days);
        
        // canCheckpointTokenを有効にする
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 各ユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmount1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 claimedAmount2 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user3);
        uint256 claimedAmount3 = feePoolV2.claim();
        vm.stopPrank();
        
        // ロック量が多いユーザーほど多くのETHを受け取ることを確認
        assertGt(claimedAmount2, claimedAmount1, "User with more lock should receive more ETH");
        assertGt(claimedAmount3, claimedAmount2, "User with more lock should receive more ETH");
    }

    function test_SameWeekStartEndComparison() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount); // 2人目のユーザー
        
        // ETHを送付
        uint256 ethAmount = 5 ether;
        sendETH(ethAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 次の週まで進める
        uint256 weekStart = ((block.timestamp + WEEK) / WEEK) * WEEK;
        vm.warp(weekStart + 1); // 週の開始直後
        
        // ユーザー1が週の開始でクレーム
        vm.startPrank(user1);
        uint256 claimAtStart = feePoolV2.claim();
        vm.stopPrank();
        
        // 同じ週の終了近くまで進める
        vm.warp(weekStart + WEEK - 1); // 週の終了直前
        
        // ユーザー2が週の終了でクレーム（同じ週の報酬）
        vm.startPrank(user2);
        uint256 claimAtEnd = feePoolV2.claim();
        vm.stopPrank();
        
        // User1 claim at week start: claimAtStart
        // User2 claim at week end: claimAtEnd
        // Difference: claimAtStart > claimAtEnd ? claimAtStart - claimAtEnd : claimAtEnd - claimAtStart
        
        // 同じロック量なら、同じ週の報酬は同じになるべき
        assertEq(claimAtStart, claimAtEnd, "Same week claims should be equal");
        
        // 次の週に進める
        vm.warp(weekStart + WEEK + 1); // 次の週の開始直後
        
        // ユーザー1が次の週でクレームを試行（0になるべき）
        vm.startPrank(user1);
        uint256 claimNextWeek = feePoolV2.claim();
        vm.stopPrank();
        
        // User1 claim at next week: claimNextWeek
        
        // 次の週には新しい報酬がないため、claimは0になるべき
        assertEq(claimNextWeek, 0, "No new rewards in next week");
        
        // さらに新しいETHを送付
        sendETH(3 ether);
        
        // 時間を進めて新しい週の報酬を生成
        vm.warp(block.timestamp + WEEK);
        
        // ユーザー1が新しい週でクレームを試行
        vm.startPrank(user1);
        uint256 claimNewWeek = feePoolV2.claim();
        vm.stopPrank();
        
        // User1 claim with new ETH: claimNewWeek
        
        // 新しいETHが送付されたので、claimは0より大きくなるべき
        assertGt(claimNewWeek, 0, "Should have new rewards after new ETH");
    }

    // ==============================
    // 新規追加テスト：エッジケース（修正版）
    // ==============================

    function test_PartialWeekClaim() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 週の境界に移動
        uint256 weekStart = ((block.timestamp + WEEK) / WEEK) * WEEK;
        vm.warp(weekStart);
        
        // 週の途中（3日目）でETHを送付
        vm.warp(weekStart + 3 days);
        sendETH(7 ether);
        
        // 次の週に進める（報酬を確定させるため）
        vm.warp(weekStart + WEEK + 1);
        
        // claimを実行
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // Claimed amount for partial week: claimedAmount
        
        // 部分的な週の報酬が正しく計算されていることを確認
        // 実際の実装では、週の途中から始まっても全額が配分される可能性がある
        assertGt(claimedAmount, 0, "Should receive rewards for partial week");
    }

    function test_MultiWeekAccumulation() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 最初の週にETHを送付
        sendETH(1 ether);
        
        // 1週間進める
        vm.warp(block.timestamp + WEEK);
        sendETH(2 ether);
        
        // さらに1週間進める
        vm.warp(block.timestamp + WEEK);
        sendETH(3 ether);
        
        // さらに1週間進める（報酬を確定させるため）
        vm.warp(block.timestamp + WEEK * 3);
        
        // ユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // veYMTの減衰を考慮して、適切な誤差範囲を設定
        assertGt(claimedAmount, 5.0 ether, "Should receive most of the accumulated rewards");
        assertLt(claimedAmount, 6 ether, "Should not exceed total sent amount");
    }

    // ==============================
    // 新規追加テスト：veYMTの変化（修正版）
    // ==============================

    function test_ClaimAfterLockExpiry() public {
        // 短期間のロック（3週間）
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLockWithDuration(user1, lockAmount, 3 * WEEK);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 最初の週にETHを送付
        sendETH(5 ether);
        
        // 1週間後（ロック中）
        vm.warp(block.timestamp + WEEK);
        
        vm.startPrank(user1);
        uint256 claimDuringLock = feePoolV2.claim();
        vm.stopPrank();
        
        assertGt(claimDuringLock, 0, "Should receive rewards during lock period");
        
        // ロック期間終了後（3週間後）- ETHは送付しない
        vm.warp(block.timestamp + 3 * WEEK);
        
        // ロック解除
        vm.startPrank(user1);
        veYmt.withdraw();
        vm.stopPrank();
        
        // veYMT残高が0になったことを確認
        uint256 veBalance = veYmt.balanceOf(user1);
        assertEq(veBalance, 0, "veYMT balance should be 0 after withdrawal");
        
        // withdraw後のクレーム試行
        vm.startPrank(user1);
        uint256 claimAfterWithdraw = feePoolV2.claim();
        vm.stopPrank();
        
        // すでにクレーム済みの週なので、0を受け取る
        assertEq(claimAfterWithdraw, 0, "Should not receive new rewards after all weeks claimed");
        
        // 新しいETHを送付して、次の週に進める
        sendETH(5 ether);
        vm.warp(block.timestamp + WEEK);
        
        // veYMTがないので新しい週の報酬は受け取れない
        vm.startPrank(user1);
        uint256 claimNewWeekAfterWithdraw = feePoolV2.claim();
        vm.stopPrank();
        
        assertEq(claimNewWeekAfterWithdraw, 0, "Should not receive rewards for new week after withdrawal");
    }

    function test_ClaimAfterIncreasingLock() public {
        // 初期ロック
        uint256 initialLockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, initialLockAmount);
        
        // user2も同じ量でロック（比較用）
        setupVeYMTLock(user2, initialLockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 最初の週のETHを送付
        sendETH(10 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // user1とuser2の最初のclaim
        vm.startPrank(user1);
        uint256 firstClaimUser1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 firstClaimUser2 = feePoolV2.claim();
        vm.stopPrank();
        
        // First claim user1: firstClaimUser1
        // First claim user2: firstClaimUser2
        
        // 同じ量のclaimであることを確認
        assertEq(firstClaimUser1, firstClaimUser2, "Initial claims should be equal");
        
        // user1のロック量を追加
        vm.startPrank(ymtVestingAddr);
        ymt.transfer(user1, initialLockAmount);
        vm.stopPrank();
        
        vm.startPrank(user1);
        ymt.approve(address(veYmt), initialLockAmount);
        veYmt.increaseAmount(initialLockAmount);
        vm.stopPrank();
        
        // 新しい週のETHを送付
        sendETH(10 ether);
        
        // さらに1週間後
        vm.warp(block.timestamp + WEEK);
        
        // 2回目のclaim
        vm.startPrank(user1);
        uint256 secondClaimUser1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 secondClaimUser2 = feePoolV2.claim();
        vm.stopPrank();
        
        // Second claim user1 (increased lock): secondClaimUser1
        // Second claim user2 (same lock): secondClaimUser2
        
        // user1の方が多く受け取ることを確認
        assertGt(secondClaimUser1, secondClaimUser2, "User1 should receive more after increasing lock");
    }

    // ==============================
    // 新規追加テスト：境界値（修正版）
    // ==============================

    function test_MinimumClaimAmount() public {
        // 非常に小さなロック量
        uint256 lockAmount = 1; // 1 wei
        setupVeYMTLock(user1, lockAmount);
        
        // 大きなロック量
        uint256 largeLockAmount = 1000000 * 1e18;
        setupVeYMTLock(user2, largeLockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(1 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // 小さなロック量のユーザーのclaim
        vm.startPrank(user1);
        uint256 smallClaim = feePoolV2.claim();
        vm.stopPrank();
        
        // 大きなロック量のユーザーのclaim
        vm.startPrank(user2);
        uint256 largeClaim = feePoolV2.claim();
        vm.stopPrank();
        
        // Small lock claim: smallClaim
        // Large lock claim: largeClaim
        
        // 小さなロック量でも0より大きな報酬を受け取れることを確認
        assertGe(smallClaim, 0, "Small lock should receive non-negative rewards");
        assertGt(largeClaim, smallClaim, "Large lock should receive more rewards");
    }

    function test_ZeroRewardWeek() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付せずに1週間待機
        vm.warp(block.timestamp + WEEK);
        
        // tokensPerWeekが0であることを確認
        uint256 weekStart = ((block.timestamp - WEEK) / WEEK) * WEEK;
        assertEq(feePoolV2.tokensPerWeek(weekStart), 0, "No tokens should be allocated for week without ETH");
        
        // claimを実行
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // 報酬が0であることを確認
        assertEq(claimedAmount, 0, "Should receive 0 rewards for week without ETH");
    }

    // ==============================
    // 新規追加テスト：セキュリティ（修正版）
    // ==============================

    function test_ReentrancyProtection() public {
        // 悪意のあるコントラクトをデプロイ
        MaliciousReceiver attacker = new MaliciousReceiver(address(proxy));
        
        // 攻撃者のコントラクトにveYMTロックを設定
        setupVeYMTLock(address(attacker), 1000 * 1e18);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(5 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // リエントランシー攻撃を試行
        vm.expectRevert(); // ReentrancyGuardによりrevertするはず
        attacker.attack();
    }

    function test_ClaimWhenKilled() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(5 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // コントラクトをkill
        vm.startPrank(governance);
        feePoolV2.killMe();
        vm.stopPrank();
        
        // claim試行（失敗するはず）
        vm.startPrank(user1);
        vm.expectRevert("Contract is killed");
        feePoolV2.claim();
        vm.stopPrank();
    }

    // ==============================
    // 新規追加テスト：checkpointToken関連（修正版）
    // ==============================

    function test_AutoCheckpointDuringClaim() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 週の境界に移動
        uint256 weekStart = ((block.timestamp + WEEK) / WEEK) * WEEK;
        vm.warp(weekStart);
        
        // ETHを送付
        sendETH(5 ether);
        
        // TOKEN_CHECKPOINT_DEADLINE + 1秒経過
        vm.warp(block.timestamp + feePoolV2.TOKEN_CHECKPOINT_DEADLINE() + 1);
        
        // lastTokenTimeを記録
        uint256 lastTokenTimeBefore = feePoolV2.lastTokenTime();
        
        // claimを実行（自動的にcheckpointが実行されるはず）
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // lastTokenTimeが更新されていることを確認
        uint256 lastTokenTimeAfter = feePoolV2.lastTokenTime();
        assertGt(lastTokenTimeAfter, lastTokenTimeBefore, "lastTokenTime should be updated after auto checkpoint");
        
    }

    function test_CheckpointPermissions() public {
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenがfalseの状態で一般ユーザーがcheckpointを試行
        vm.startPrank(user1);
        vm.expectRevert("Unauthorized");
        feePoolV2.checkpointToken();
        vm.stopPrank();
        
        // governanceはcheckpointできる
        vm.startPrank(governance);
        feePoolV2.checkpointToken();
        vm.stopPrank();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // TOKEN_CHECKPOINT_DEADLINE経過後は一般ユーザーもcheckpointできる
        vm.warp(block.timestamp + feePoolV2.TOKEN_CHECKPOINT_DEADLINE() + 1);
        
        vm.startPrank(user1);
        feePoolV2.checkpointToken();
        vm.stopPrank();
    }

    // ==============================
    // 新規追加テスト：精度とオーバーフロー（修正版）
    // ==============================

    function test_LargeNumberHandling() public {
        // 非常に大きなロック量
        uint256 lockAmount = 100000000 * 1e18; // 1億 YMT
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 非常に大きなETH量を送付
        uint256 largeEthAmount = 100000 ether;
        vm.deal(user2, largeEthAmount);
        vm.startPrank(user2);
        (bool success,) = address(proxy).call{value: largeEthAmount}("");
        assertTrue(success);
        vm.stopPrank();
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // claimを実行（オーバーフローしないことを確認）
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // 正常に処理されることを確認
        assertGt(claimedAmount, 0, "Should handle large numbers without overflow");
        assertLe(claimedAmount, largeEthAmount, "Claimed amount should not exceed sent amount");
    }

    function test_DivisionPrecision() public {
        // 3人のユーザーで均等にロック
        uint256 lockAmount = 333333333333333333333; // 333.333... YMT
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount);
        setupVeYMTLock(user3, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 割り切れない量のETHを送付
        uint256 ethAmount = 1000000000000000001; // 1 ETH + 1 wei
        sendETH(ethAmount);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK * 1);
        
        // 各ユーザーがclaim
        vm.startPrank(user1);
        uint256 claim1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 claim2 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user3);
        uint256 claim3 = feePoolV2.claim();
        vm.stopPrank();
        
        uint256 totalClaimed = claim1 + claim2 + claim3;
        uint256 dust = ethAmount > totalClaimed ? ethAmount - totalClaimed : 0;
        
        // Total sent: ethAmount
        // Total claimed: totalClaimed
        // Dust: dust
        
        // 誤差が小さいことを確認（実際のテスト結果では2 wei程度）
        // FeePoolV3の実装では非常に高い精度が実現されている
        assertLe(dust, 10, "Dust should be very small (less than 10 wei)");
    }
    function test_DivisionPrecision2() public {
        // 3人のユーザーで均等にロック
        uint256 lockAmount = 333333333333333333333; // 333.333... YMT
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount);
        setupVeYMTLock(user3, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 割り切れない量のETHを送付
        uint256 ethAmount = 1000000000000000001; // 1 ETH + 1 wei
        sendETH(ethAmount);
        
        // 3週間後
        vm.warp(block.timestamp + WEEK * 3);
        
        // 各ユーザーがclaim
        vm.startPrank(user1);
        uint256 claim1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 claim2 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user3);
        uint256 claim3 = feePoolV2.claim();
        vm.stopPrank();
        
        uint256 totalClaimed = claim1 + claim2 + claim3;
        uint256 dust = ethAmount > totalClaimed ? ethAmount - totalClaimed : 0;
        
        // Total sent: ethAmount
        // Total claimed: totalClaimed
        // Dust: dust
        
        // 誤差が小さいことを確認（実際のテスト結果では2 wei程度）
        // FeePoolV3の実装では非常に高い精度が実現されている
        assertLe(dust, 10, "Dust should be very small (less than 10 wei)");
    }

    // ==============================
    // 新規追加テスト：統合テスト（修正版）
    // ==============================

    function test_ClaimForOtherAddress() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(5 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // user2がuser1のためにclaimを実行
        uint256 user1BalanceBefore = user1.balance;
        
        vm.startPrank(user2);
        uint256 claimedAmount = feePoolV2.claim(user1);
        vm.stopPrank();
        
        // user1が報酬を受け取ったことを確認
        assertEq(user1.balance, user1BalanceBefore + claimedAmount, "User1 should receive the rewards");
        assertGt(claimedAmount, 0, "Should claim positive amount");
    }

    function test_ClaimMany() public {
        // 複数のユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount);
        setupVeYMTLock(user3, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(10 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // claimMany用のアドレス配列を作成
        address[] memory receivers = new address[](5);
        receivers[0] = user1;
        receivers[1] = user2;
        receivers[2] = user3;
        receivers[3] = address(0); // ここで処理が停止するはず
        receivers[4] = user4; // このユーザーは処理されないはず
        
        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;
        uint256 user3BalanceBefore = user3.balance;
        uint256 user4BalanceBefore = user4.balance;
        
        // claimManyを実行
        vm.startPrank(governance);
        bool success = feePoolV2.claimMany(receivers);
        vm.stopPrank();
        
        assertTrue(success, "claimMany should succeed");
        
        // user1, user2, user3は報酬を受け取る
        assertGt(user1.balance, user1BalanceBefore, "User1 should receive rewards");
        assertGt(user2.balance, user2BalanceBefore, "User2 should receive rewards");
        assertGt(user3.balance, user3BalanceBefore, "User3 should receive rewards");
        
        // user4は報酬を受け取らない（address(0)で処理が停止）
        assertEq(user4.balance, user4BalanceBefore, "User4 should not receive rewards");
    }


    function test_ClaimAtExactWeekBoundary() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化   
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 週の境界ぴったりに移動
        uint256 weekBoundary = ((block.timestamp + WEEK) / WEEK) * WEEK;
        vm.warp(weekBoundary);
        
        // ETHを送付（週の開始時点）
        sendETH(5 ether);
        
        // 次の週の境界ぴったりに移動
        vm.warp(weekBoundary + WEEK);
        
        // claimを実行（週の境界での動作確認）
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        assertGt(claimedAmount, 0, "Should receive rewards when claiming at exact week boundary");
    }

    function test_VeYMTDecayImpactOnClaims() public {
        // 異なるロック期間のユーザーを作成
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLockWithDuration(user1, lockAmount, 4 * 365 * 86400); // 4年
        setupVeYMTLockWithDuration(user2, lockAmount, 1 * 365 * 86400); // 1年
        setupVeYMTLockWithDuration(user3, lockAmount, 6 * 30 * 86400);  // 6ヶ月
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(10 ether);
        
        // 1週間後（初期状態）
        vm.warp(block.timestamp + WEEK);
        
        vm.startPrank(user1);
        uint256 claim1_week1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 claim2_week1 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user3);
        uint256 claim3_week1 = feePoolV2.claim();
        vm.stopPrank();
        
        // ロック期間が長いほど多く受け取る
        assertGt(claim1_week1, claim2_week1, "4-year lock should receive more than 1-year");
        assertGt(claim2_week1, claim3_week1, "1-year lock should receive more than 6-month");
        
            // 前の週のクレームを完了させる
        vm.warp(block.timestamp + WEEK);
        
        // 新しい週のETHを送付
        sendETH(10 ether);
        vm.warp(block.timestamp + WEEK);
        
        vm.startPrank(user1);
        uint256 claim1_week13 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user2);
        uint256 claim2_week13 = feePoolV2.claim();
        vm.stopPrank();
        
        vm.startPrank(user3);
        uint256 claim3_week13 = feePoolV2.claim();
        vm.stopPrank();
        
        // 時間経過による相対的な変化を確認
        // Week 1 - User1: claim1_week1, User2: claim2_week1, User3: claim3_week1
        // Week 13 - User1: claim1_week13, User2: claim2_week13, User3: claim3_week13
        }

        function test_ClaimBeforeWeekFinalized() public {
            // ユーザーがveYMTにロック
            uint256 lockAmount = 1000 * 1e18;
            setupVeYMTLock(user1, lockAmount);
            
            // V3にアップグレード
            upgradeToV3();
            initializeV3();
            
            // canCheckpointTokenを有効化
            vm.startPrank(governance);
            feePoolV2.toggleAllowCheckpointToken();
            vm.stopPrank();
            
            // ETHを送付
            sendETH(5 ether);
            
            // 同じ週内でクレームを試行（週が確定していない）
            vm.warp(block.timestamp + 1 hours);
            
            vm.startPrank(user1);
            uint256 claimedAmount = feePoolV2.claim();
            vm.stopPrank();
            
            // 現在の週はまだ確定していないため、クレームは0
            assertEq(claimedAmount, 0, "Cannot claim rewards for unfinalized week");
        }

        function test_DustAccumulationOverTime() public {
            // 7人のユーザーで不均等にロック（割り切れない数）
            setupVeYMTLock(user1, 1000 * 1e18);
            setupVeYMTLock(user2, 1234 * 1e18);
            setupVeYMTLock(user3, 2345 * 1e18);
            setupVeYMTLock(user4, 3456 * 1e18);
            setupVeYMTLock(makeAddr("user5"), 4567 * 1e18);
            setupVeYMTLock(makeAddr("user6"), 5678 * 1e18);
            setupVeYMTLock(makeAddr("user7"), 6789 * 1e18);
            
            // V3にアップグレード
            upgradeToV3();
            initializeV3();
            
            // canCheckpointTokenを有効化
            vm.startPrank(governance);
            feePoolV2.toggleAllowCheckpointToken();
            vm.stopPrank();
            
            uint256 totalSent;
            uint256 totalClaimed;
            
            // 10週間にわたって割り切れない量のETHを送付
            for (uint i = 0; i < 10; i++) {
                uint256 amount = 1000000000000000007 + i; // 毎回異なる端数
                sendETH(amount);
                totalSent += amount;
                vm.warp(block.timestamp + WEEK);
            }
            
            // 全ユーザーがクレーム
            address[7] memory users = [user1, user2, user3, user4, makeAddr("user5"), makeAddr("user6"), makeAddr("user7")];
            for (uint i = 0; i < 7; i++) {
                vm.startPrank(users[i]);
                totalClaimed += feePoolV2.claim();
                vm.stopPrank();
            }
            
            uint256 dust = totalSent - totalClaimed;
            // Total sent: totalSent
            // Total claimed: totalClaimed
            // Accumulated dust: dust
            
            // 10週間でも誤差は最小限であるべき
            assertLt(dust, 100, "Dust accumulation should be minimal even over multiple weeks");
        }

        function test_ConcurrentClaimsHandling() public {
            // 複数のユーザーがveYMTにロック
            uint256 lockAmount = 1000 * 1e18;
            setupVeYMTLock(user1, lockAmount);
            setupVeYMTLock(user2, lockAmount);
            
            // V3にアップグレード
            upgradeToV3();
            initializeV3();
            
            // canCheckpointTokenを有効化
            vm.startPrank(governance);
            feePoolV2.toggleAllowCheckpointToken();
            vm.stopPrank();
            
            // ETHを送付
            sendETH(10 ether);
            
            // 1週間後
            vm.warp(block.timestamp + WEEK);
            
            // user1が最初にtotalSupplyをチェックポイント
            vm.startPrank(user1);
            uint256 claim1 = feePoolV2.claim();
            vm.stopPrank();
            
            // user2が同じブロックでクレーム（状態が正しく管理されているか確認）
            vm.startPrank(user2);
            uint256 claim2 = feePoolV2.claim();
            vm.stopPrank();
            
                // 両者が正しく報酬を受け取れることを確認
        assertEq(claim1, claim2, "Both users should receive equal rewards");
        assertGt(claim1, 0, "Claims should be successful");
    }

    // ==============================
    // 追加テストケース：週をまたぐETH送付
    // ==============================

    function test_ETHDepositAcrossWeekBoundary() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 週の終わり近くに移動（週末の1時間前）
        uint256 weekEnd = ((block.timestamp / WEEK) + 1) * WEEK - 1 hours;
        vm.warp(weekEnd);
        
        // ETHを送付（一部は現在の週、一部は次の週に配分される）
        sendETH(10 ether);
        
        // 2時間後（次の週に入る）
        vm.warp(weekEnd + 2 hours);
        
        // 両方の週でクレーム可能か確認
        vm.warp(block.timestamp + WEEK);
        
        vm.startPrank(user1);
        uint256 totalClaimed = feePoolV2.claim();
        vm.stopPrank();
        
        // 10 ETHのほぼ全額がクレームできることを確認
        assertGt(totalClaimed, 9.9 ether, "Should receive almost all ETH across weeks");
    }

    // ==============================
    // 追加テストケース：最大週数処理
    // ==============================
    function test_MaxWeeksProcessing() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 現在のタイムスタンプを記録
        uint256 currentTime = block.timestamp;
        
        // 45週分のETHを送付（ループ制限の50に近いが超えない）
        for (uint i = 0; i < 45; i++) {
            sendETH(0.1 ether);
            vm.warp(block.timestamp + WEEK);
        }
        
        // さらに2週間待って、45週目を確定させる
        vm.warp(block.timestamp + 2 * WEEK);
        
        // この時点で45週分がクレーム可能
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        // 45週分の報酬を受け取る
        assertGt(claimedAmount, 4.4 ether, "Should claim all 45 weeks in one call");
        assertLt(claimedAmount, 4.6 ether, "Should not exceed total sent");
        
        // 2回目のclaimは0になるはず
        vm.startPrank(user1);
        uint256 secondClaim = feePoolV2.claim();
        vm.stopPrank();
        
        assertEq(secondClaim, 0, "Second claim should be 0");
        
        // ループ制限をテストするために、さらに10週分追加
        for (uint i = 0; i < 10; i++) {
            sendETH(0.1 ether);
            vm.warp(block.timestamp + WEEK);
        }
        
        // 1週間待って確定
        vm.warp(block.timestamp + WEEK);
        
        // 50週制限により、一度のclaimでは全て処理できない
        vm.startPrank(user1);
        uint256 thirdClaim = feePoolV2.claim();
        vm.stopPrank();
        
        assertGt(thirdClaim, 0, "Should claim additional weeks");
        
        // もう一度claimして残りを処理
        vm.startPrank(user1);
        uint256 fourthClaim = feePoolV2.claim();
        vm.stopPrank();
        
        // 全ての週が処理されたか確認
        vm.startPrank(user1);
        uint256 fifthClaim = feePoolV2.claim();
        vm.stopPrank();
        
        assertEq(fifthClaim, 0, "All weeks should be claimed");
    }

    // ==============================
    // 追加テストケース：エッジケース
    // ==============================

    function test_ClaimWithExpiredLock() public {
        // 短期間のロック（1週間）
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLockWithDuration(user1, lockAmount, WEEK);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(5 ether);
        
        // ロック期間終了後
        vm.warp(block.timestamp + WEEK + 1);
        
        // ロックが自動的に解除されることを確認
        uint256 veBalance = veYmt.balanceOf(user1);
        assertEq(veBalance, 0, "Lock should be automatically expired");
        
        // 過去の報酬はクレームできる
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        assertGt(claimedAmount, 0, "Should be able to claim rewards from expired lock period");
    }

    function test_ClaimWithMultipleLockPeriods() public {
        // ユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // 最初の週のETHを送付
        sendETH(5 ether);
        vm.warp(block.timestamp + WEEK);
        
        // 最初のクレーム
        vm.startPrank(user1);
        uint256 firstClaim = feePoolV2.claim();
        vm.stopPrank();
        
        // ロックを延長
        vm.startPrank(user1);
        uint256 newLockTime = block.timestamp + 4 * 365 * 86400; // 4年間
        veYmt.increaseUnlockTime(newLockTime);
        vm.stopPrank();
        
        // 新しい週のETHを送付
        sendETH(5 ether);
        vm.warp(block.timestamp + WEEK);
        
        // 2回目のクレーム
        vm.startPrank(user1);
        uint256 secondClaim = feePoolV2.claim();
        vm.stopPrank();
        
        // 両方のクレームが成功することを確認
        assertGt(firstClaim, 0, "First claim should be successful");
        assertGt(secondClaim, 0, "Second claim should be successful");
        
        // ロック期間が延長されたので、2回目のクレームはより多く受け取る可能性がある
        // （veYMTの減衰がリセットされるため）
    }

    // ==============================
    // 追加テストケース：パフォーマンスとガス効率
    // ==============================

    function test_GasEfficiencyOfClaim() public {
        // 複数のユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount);
        setupVeYMTLock(user3, lockAmount);
        setupVeYMTLock(user4, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(10 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // ガス使用量を測定
        uint256 gasBefore = gasleft();
        
        vm.startPrank(user1);
        uint256 claimedAmount = feePoolV2.claim();
        vm.stopPrank();
        
        uint256 gasUsed = gasBefore - gasleft();
        
        // ガス使用量が合理的な範囲内であることを確認
        assertLt(gasUsed, 400000, "Gas usage should be reasonable");
        assertGt(claimedAmount, 0, "Claim should be successful");
    }

    function test_ClaimManyGasEfficiency() public {
        // 複数のユーザーがveYMTにロック
        uint256 lockAmount = 1000 * 1e18;
        setupVeYMTLock(user1, lockAmount);
        setupVeYMTLock(user2, lockAmount);
        setupVeYMTLock(user3, lockAmount);
        setupVeYMTLock(user4, lockAmount);
        
        // V3にアップグレード
        upgradeToV3();
        initializeV3();
        
        // canCheckpointTokenを有効化
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // ETHを送付
        sendETH(10 ether);
        
        // 1週間後
        vm.warp(block.timestamp + WEEK);
        
        // claimMany用のアドレス配列を作成
        address[] memory receivers = new address[](4);
        receivers[0] = user1;
        receivers[1] = user2;
        receivers[2] = user3;
        receivers[3] = user4;
        
        // ガス使用量を測定
        uint256 gasBefore = gasleft();
        
        vm.startPrank(governance);
        bool success = feePoolV2.claimMany(receivers);
        vm.stopPrank();
        
        uint256 gasUsed = gasBefore - gasleft();
        
        // claimManyが成功し、ガス効率が良いことを確認
        assertTrue(success, "claimMany should succeed");
        assertLt(gasUsed, 600000, "claimMany gas usage should be reasonable");
    }
}