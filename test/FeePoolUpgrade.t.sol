// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Test.sol";
import "../contracts/FeePool.sol";
import "../contracts/FeePoolV2.sol";
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

contract FeePoolUpgradeTest is Test {
    FeePool public feePoolImpl;
    FeePoolV2 public feePoolV2Impl;
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
    address public governance;
    address public ymtVestingAddr;
    
    uint256 public constant WEEK = 7 * 86400;
    uint256 public startTime;

    // ヘルパー関数
    function upgradeToV2() internal {
        // FeePoolV2の実装をデプロイ
        vm.startPrank(owner);
        feePoolV2Impl = new FeePoolV2();
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

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
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

    function test_InitialDeployment() public {
        // 初期デプロイが正しく行われていることを確認
        assertEq(address(proxy).code.length > 0, true);
        assertEq(address(feePoolImpl).code.length > 0, true);
        assertEq(address(veYmt).code.length > 0, true);
        assertEq(address(ymt).code.length > 0, true);
        assertEq(address(ymtMinter).code.length > 0, true);
    }

    function test_InitialState() public {
        // 初期状態を確認
        assertEq(feePool.veYMT(), address(veYmt));
        assertEq(feePool.governance(), governance);
    }

    function test_ReceiveBeforeUpgrade() public {
        // アップグレード前にETHを送信
        uint256 amount = 1 ether;
        vm.deal(user1, amount);
        vm.startPrank(user1);
        
        (bool success,) = address(proxy).call{value: amount}("");
        assertTrue(success);
        
        vm.stopPrank();
        
        // 残高が正しく反映されていることを確認
        assertEq(address(proxy).balance, amount);
    }

    function test_UpgradeToV2() public {
        // ヘルパー関数を使用してアップグレード
        upgradeToV2();
        
        // アップグレード後もveYMTの設定が保持されていることを確認
        assertEq(feePoolV2.veYMT(), address(veYmt));
    }

    function test_InitializeV2AfterUpgrade() public {
        // ヘルパー関数を使用してアップグレードと初期化
        upgradeToV2();
        initializeV2();
        
        // V2の初期化が正しく行われていることを確認
        assertEq(feePoolV2.startTime(), startTime);
        assertEq(feePoolV2.timeCursor(), startTime);
        assertEq(feePoolV2.lastTokenTime(), startTime);
    }

    function test_UpgradePreservesState() public {
        // アップグレード前にETHを送信
        uint256 amount = 2 ether;
        sendETH(amount);
        
        // ヘルパー関数を使用してアップグレード
        upgradeToV2();
        
        // アップグレード後もETHの残高が保持されていることを確認
        assertEq(address(proxy).balance, amount);
        
        // veYMTの設定も保持されていることを確認
        assertEq(feePoolV2.veYMT(), address(veYmt));
    }

    function testFail_UpgradeUnauthorized() public {
        // 権限がないユーザーがアップグレードを試行
        vm.startPrank(owner);
        feePoolV2Impl = new FeePoolV2();
        vm.stopPrank();
        
        vm.startPrank(user1);
        // 権限がないため失敗するはず
        feePool.upgradeTo(address(feePoolV2Impl));
        vm.stopPrank();
    }

    function test_V2NewFeatures() public {
        // ヘルパー関数を使用してアップグレードと初期化
        upgradeToV2();
        initializeV2();
        
        // V2の新機能をテスト
        assertEq(feePoolV2.WEEK(), WEEK);
        assertEq(feePoolV2.TOKEN_CHECKPOINT_DEADLINE(), 86400);
        assertEq(feePoolV2.canCheckpointToken(), false);
        assertEq(feePoolV2.isKilled(), false);
    }

    function test_CheckpointTokenAfterUpgrade() public {
        // ヘルパー関数を使用してアップグレードと初期化
        upgradeToV2();
        initializeV2();
        
        // ETHを送信
        uint256 amount = 1 ether;
        sendETH(amount);
        
        // 時間を進めてデッドラインを過ぎさせる
        vm.warp(block.timestamp + 86401);
        
        // canCheckpointTokenを有効にする
        vm.startPrank(governance);
        feePoolV2.toggleAllowCheckpointToken();
        vm.stopPrank();
        
        // checkpointTokenが実行できることを確認
        vm.startPrank(user1);
        feePoolV2.checkpointToken();
        vm.stopPrank();
        
        // checkpointTokenが実行されたことを確認
        assertEq(feePoolV2.lastTokenTime(), block.timestamp);
    }
} 