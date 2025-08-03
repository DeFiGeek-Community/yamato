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
}

contract FeePoolClaimTest is Test {
    FeePool public feePoolImpl;
    FeePoolV3 public feePoolV2Impl;
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
    function upgradeToV2() internal {
        // FeePoolV2の実装をデプロイ
        vm.startPrank(owner);
        feePoolV2Impl = new FeePoolV3();
        vm.stopPrank();
        
        // アップグレードを実行
        vm.startPrank(governance);
        feePool.upgradeTo(address(feePoolV2Impl));
        vm.stopPrank();
        
        // プロキシインターフェースをV2に更新
        feePoolV2 = IFeePoolV2Interface(address(proxy));
    }

    function initializeV2() internal {
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
    // 基本的なClaimテスト
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
        
        // V2にアップグレード
        upgradeToV2();
        initializeV2();
        
        // 他のテストと同じ時間設定でテスト
        vm.warp(block.timestamp + 7 days);
        
        console.log("=== Week Start Claim Test ===");
        console.log("Current timestamp:", block.timestamp);
        console.log("Week boundary:", (block.timestamp / WEEK) * WEEK);
        console.log("FeePoolV2 startTime:", feePoolV2.startTime());
        console.log("FeePoolV2 timeCursor:", feePoolV2.timeCursor());
        console.log("FeePoolV2 lastTokenTime:", feePoolV2.lastTokenTime());
        console.log("Contract balance before claim:", address(proxy).balance);
        
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
        
        console.log("Claim amount at week start:", claimedAmountWeekStart);
        console.log("User balance after claim:", user1.balance);
        
        // さらに時間を進める
        vm.warp(block.timestamp + 7 days);
        
        console.log("\n=== Week End Claim Test ===");
        console.log("Current timestamp:", block.timestamp);
        console.log("Week boundary:", (block.timestamp / WEEK) * WEEK);
        console.log("FeePoolV2 startTime:", feePoolV2.startTime());
        console.log("FeePoolV2 timeCursor:", feePoolV2.timeCursor());
        console.log("FeePoolV2 lastTokenTime:", feePoolV2.lastTokenTime());
        console.log("Contract balance before claim:", address(proxy).balance);
        
        // 追加でETHを送付（週の終わりでのテスト用）
        uint256 additionalEth = 2 ether;
        sendETH(additionalEth);
        ethAmount += additionalEth;
        
        // ユーザーがclaimを実行
        vm.startPrank(user1);
        uint256 claimedAmountWeekEnd = feePoolV2.claim();
        vm.stopPrank();
        
        console.log("Claim amount at week end:", claimedAmountWeekEnd);
        console.log("User balance after claim:", user1.balance);
        
        // 週の初めと終わりでのclaim量の違いを確認
        console.log("\n=== Comparison Results ===");
        console.log("Week start claim amount:", claimedAmountWeekStart);
        console.log("Week end claim amount:", claimedAmountWeekEnd);
        if (claimedAmountWeekEnd > claimedAmountWeekStart) {
            console.log("Difference (week end - week start):", claimedAmountWeekEnd - claimedAmountWeekStart);
            console.log("Week end claim is higher by:", ((claimedAmountWeekEnd - claimedAmountWeekStart) * 100) / claimedAmountWeekStart, "%");
        } else if (claimedAmountWeekStart > claimedAmountWeekEnd) {
            console.log("Difference (week start - week end):", claimedAmountWeekStart - claimedAmountWeekEnd);
            console.log("Week start claim is higher by:", ((claimedAmountWeekStart - claimedAmountWeekEnd) * 100) / claimedAmountWeekEnd, "%");
        } else {
            console.log("No difference between week start and week end claims");
        }
        
        // claimが成功したことを確認
        assertGt(claimedAmountWeekStart, 0, "Claim amount at week start should be greater than 0");
        assertGt(claimedAmountWeekEnd, 0, "Claim amount at week end should be greater than 0");
        
        // コントラクトの残高が減少したことを確認
        uint256 totalClaimed = claimedAmountWeekStart + claimedAmountWeekEnd;
        assertEq(address(proxy).balance, ethAmount - totalClaimed, "Contract balance should decrease by total claimed amount");
    }

    // ==============================
    // 複数ユーザーのClaimテスト
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
        
        // V2にアップグレード
        upgradeToV2();
        initializeV2();
        
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
    // 時間経過によるClaimテスト
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
        
        // V2にアップグレード
        upgradeToV2();
        initializeV2();
        
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
    // エラーケースのテスト
    // ==============================

    function test_ClaimWithoutLock() public {
        // ユーザーがveYMTにロックしていない状態でclaimを試行
        upgradeToV2();
        initializeV2();
        
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
    // 詳細なClaimテスト
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
        
        // V2にアップグレード
        upgradeToV2();
        initializeV2();
        
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
        
        // V2にアップグレード
        upgradeToV2();
        initializeV2();
        
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
        
        console.log("User1 claim at week start:", claimAtStart);
        console.log("User2 claim at week end:", claimAtEnd);
        console.log("Difference:", claimAtStart > claimAtEnd ? 
            claimAtStart - claimAtEnd : claimAtEnd - claimAtStart);
        
        // 同じロック量なら、同じ週の報酬は同じになるべき
        assertEq(claimAtStart, claimAtEnd, "Same week claims should be equal");
        
        // 次の週に進める
        vm.warp(weekStart + WEEK + 1); // 次の週の開始直後
        
        // ユーザー1が次の週でクレームを試行（0になるべき）
        vm.startPrank(user1);
        uint256 claimNextWeek = feePoolV2.claim();
        vm.stopPrank();
        
        console.log("User1 claim at next week:", claimNextWeek);
        
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
        
        console.log("User1 claim with new ETH:", claimNewWeek);
        
        // 新しいETHが送付されたので、claimは0より大きくなるべき
        assertGt(claimNewWeek, 0, "Should have new rewards after new ETH");
    }
} 