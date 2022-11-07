pragma solidity ^0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xtanaka (0xtanaka@pm.me)
 * Copyright (C) 2022 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable var-name-mixedcase
//solhint-disable func-name-mixedcase
/**
    @dev Using snake_case for the names of the test functions.
         Because the foundry testing library interprets the prefix(testFail) and inverts the result.
         So unexpected reverts may not be found.
         -> https://book.getfoundry.sh/forge/cheatcodes
 */

import "forge-std/Test.sol";
import {ChainLinkMock} from "../../contracts/ChainLinkMock.sol";
import {TellorCallerMock} from "../../contracts/TellorCallerMock.sol";
import {PriceFeedV2} from "../../contracts/PriceFeedV2.sol";
import {CJPY} from "../../contracts/CJPY.sol";
import {FeePool} from "../../contracts/FeePool.sol";
import {CurrencyOSV2} from "../../contracts/CurrencyOSV2.sol";
import {YamatoV3} from "../../contracts/YamatoV3.sol";
import {IYamato} from "../../contracts/Interfaces/IYamato.sol";
import {YamatoDepositorV2} from "../../contracts/YamatoDepositorV2.sol";
import {IYamatoDepositor} from "../../contracts/Interfaces/IYamatoDepositor.sol";
import {YamatoBorrower} from "../../contracts/YamatoBorrower.sol";
import {YamatoRepayerV2} from "../../contracts/YamatoRepayerV2.sol";
import {YamatoWithdrawerV2} from "../../contracts/YamatoWithdrawerV2.sol";
import {YamatoRedeemerV4} from "../../contracts/YamatoRedeemerV4.sol";
import {IYamatoRedeemer} from "../../contracts/Interfaces/IYamatoRedeemer.sol";
import {YamatoSweeperV2} from "../../contracts/YamatoSweeperV2.sol";
import {PoolV2} from "../../contracts/PoolV2.sol";
import {PriorityRegistryV6} from "../../contracts/PriorityRegistryV6.sol";

contract YamatoTest is Test {

    struct Contracts {
        ChainLinkMock chainLinkMockEthUsd;
        ChainLinkMock chainLinkMockJpyUsd;
        TellorCallerMock tellorCallerMock;
        PriceFeedV2 priceFeed;
        CJPY cjpy;
        FeePool feePool;
        CurrencyOSV2 currencyOS;
        YamatoV3 yamato;
        YamatoDepositorV2 yamatoDepositor;
        YamatoBorrower yamatoBorrower;
        YamatoRepayerV2 yamatoRepayer;
        YamatoWithdrawerV2 yamatoWithdrawer;
        YamatoRedeemerV4 yamatoRedeemer;
        YamatoSweeperV2 yamatoSweeper;
        PoolV2 pool;
        PriorityRegistryV6 priorityRegistry;
    }

    struct TestInitialStatus {
        uint96 tester1Balance;
    }

    Contracts internal c;

    address internal tester1;
    address internal tester2;

    uint96 internal UINT96_MAX = 2**96 - 1;

    string internal constant CURRENCY_OS_SLOT_ID = "deps.CurrencyOS";
    string internal constant YAMATO_DEPOSITOR_SLOT_ID = "deps.YamatoDepositor";
    string internal constant YAMATO_BORROWER_SLOT_ID = "deps.YamatoBorrower";
    string internal constant YAMATO_REPAYER_SLOT_ID = "deps.YamatoRepayer";
    string internal constant YAMATO_WITHDRAWER_SLOT_ID = "deps.YamatoWithdrawer";
    string internal constant YAMATO_REDEEMER_SLOT_ID = "deps.YamatoRedeemer";
    string internal constant YAMATO_SWEEPER_SLOT_ID = "deps.YamatoSweeper";
    string internal constant POOL_SLOT_ID = "deps.Pool";
    string internal constant PRIORITY_REGISTRY_SLOT_ID = "deps.PriorityRegistry";

    function setUp() public {
        tester1 = vm.addr(1);
        tester2 = vm.addr(2);

        vm.deal(tester1, type(uint256).max);
        vm.deal(tester2, 0.1 ether);


        // 0, Mock
        c.chainLinkMockEthUsd = new ChainLinkMock("ETH/USD");
        c.chainLinkMockJpyUsd = new ChainLinkMock("JPY/USD");
        c.tellorCallerMock = new TellorCallerMock();

        c.chainLinkMockEthUsd.simulatePriceMove();
        c.chainLinkMockJpyUsd.simulatePriceMove();
        c.chainLinkMockEthUsd.simulatePriceMove();
        c.chainLinkMockJpyUsd.simulatePriceMove();

        // 1, Currency deploy
        c.cjpy = new CJPY();

        // 2, FeePool deploy
        c.feePool = new FeePool();

        // 3, PriceFeed deploy & initialize
        c.priceFeed = new PriceFeedV2();
        c.priceFeed.initialize(address(c.chainLinkMockEthUsd), address(c.chainLinkMockJpyUsd), address(c.tellorCallerMock));

        // 4, CurrencyOS deploy & initialize
        c.currencyOS = new CurrencyOSV2();
        c.currencyOS.initialize(address(c.cjpy), address(c.priceFeed), address(c.feePool));

        // 5, Yamato deploy & initialize
        c.yamato = new YamatoV3();
        c.yamato.initialize(address(c.currencyOS));

        // 6, Yamato Actions deploy & initialize
        c.yamatoDepositor = new YamatoDepositorV2();
        c.yamatoDepositor.initialize(address(c.yamato));
        c.yamatoBorrower = new YamatoBorrower();
        c.yamatoBorrower.initialize(address(c.yamato));
        c.yamatoRepayer = new YamatoRepayerV2();
        c.yamatoRepayer.initialize(address(c.yamato));
        c.yamatoWithdrawer = new YamatoWithdrawerV2();
        c.yamatoWithdrawer.initialize(address(c.yamato));
        c.yamatoRedeemer = new YamatoRedeemerV4();
        c.yamatoRedeemer.initialize(address(c.yamato));
        c.yamatoSweeper = new YamatoSweeperV2();
        c.yamatoSweeper.initialize(address(c.yamato));

        // 7, Pool deploy & initialize
        c.pool = new PoolV2();
        c.pool.initialize(address(c.yamato));

        // 8, PriorityRegistry deploy & initialize
        c.priorityRegistry = new PriorityRegistryV6();
        c.priorityRegistry.initialize(address(c.yamato));

        // 9, Yamato.permitDeps()
        // c.yamato.permitDeps(address(c.yamato));
        c.yamato.setDeps(
            address(c.yamatoDepositor),
            address(c.yamatoBorrower),
            address(c.yamatoRepayer),
            address(c.yamatoWithdrawer),
            address(c.yamatoRedeemer),
            address(c.yamatoSweeper),
            address(c.pool),
            address(c.priorityRegistry)
        );

        // 10,
        c.currencyOS.addYamato(address(c.yamato));

        // 11, Revoke Tester
        c.yamato.revokeTester();
        c.yamatoDepositor.revokeTester();
        c.yamatoBorrower.revokeTester();
        c.yamatoRepayer.revokeTester();
        c.yamatoWithdrawer.revokeTester();
        c.yamatoRedeemer.revokeTester();
        c.yamatoSweeper.revokeTester();

        // 12,
        c.cjpy.setCurrencyOS(address(c.currencyOS));
        c.cjpy.revokeGovernance();

        // 100
        // verify
    }


    /*
    +++ Yamato Modifiers +++
        - onlyYamato
        - onlyGovernance
    +++ Yamato Setter Functions +++
        - initialize
        - setDeps
        - setPledge(s)
        - setTotalColl
        - setTotalDebt
        - setFlashLock
        - deposit
        - borrow
        - repay
        - withdraw
        - redeem
        - sweep
        - toggle
    +++ Yamato Getter Functions +++
        - checkFlashLock
        - getPledge
        - getStates
        - getIndividualStates
        - yamato, pool, priorityRegistry, depositor, borrower, repayer, withdraw, 
          redeemer, sweeper, currencyOS, feePool
        - permitDeps
        - getDeps
    */


    /*
    ==============================
        Deploy & Settings
    ==============================
        - Assert contract addresses exist
        - Assert setting deps has succeeded
        TODO: Test already deployed contracts using fork
    */

    function test_succeeded_yamato_deploy() public {
        assert(address(c.chainLinkMockEthUsd) != address(0));
        assert(address(c.chainLinkMockJpyUsd) != address(0));
        assert(address(c.tellorCallerMock) != address(0));
        assert(address(c.priceFeed) != address(0));
        assert(address(c.cjpy) != address(0));
        assert(address(c.feePool) != address(0));
        assert(address(c.currencyOS) != address(0));
        assert(address(c.yamato) != address(0));
        assert(address(c.yamatoDepositor) != address(0));
        assert(address(c.yamatoBorrower) != address(0));
        assert(address(c.yamatoRepayer) != address(0));
        assert(address(c.yamatoWithdrawer) != address(0));
        assert(address(c.yamatoRedeemer) != address(0));
        assert(address(c.yamatoSweeper) != address(0));
        assert(address(c.pool) != address(0));
        assert(address(c.priorityRegistry) != address(0));
    }

    function test_succeeded_setDeps() public {
        address[9] memory contractAddresses = c.yamato.getDeps();
        assertEq(contractAddresses[0], address(c.yamato));
        assertEq(contractAddresses[1], address(c.yamatoDepositor));
        assertEq(contractAddresses[2], address(c.yamatoBorrower));
        assertEq(contractAddresses[3], address(c.yamatoRepayer));
        assertEq(contractAddresses[4], address(c.yamatoWithdrawer));
        assertEq(contractAddresses[5], address(c.yamatoRedeemer));
        assertEq(contractAddresses[6], address(c.yamatoSweeper));
        assertEq(contractAddresses[7], address(c.pool));
        assertEq(contractAddresses[8], address(c.priorityRegistry));
    }

    function test_succeeded_deps_address_in_expected_slots() public {
        bytes32 CURRENCY_OS_KEY = bytes32(keccak256(abi.encode(CURRENCY_OS_SLOT_ID)));
        bytes32 YAMATO_DEPOSITOR_KEY = bytes32(keccak256(abi.encode(YAMATO_DEPOSITOR_SLOT_ID)));
        bytes32 YAMATO_BORROWER_KEY = bytes32(keccak256(abi.encode(YAMATO_BORROWER_SLOT_ID)));
        bytes32 YAMATO_REPAYER_KEY = bytes32(keccak256(abi.encode(YAMATO_REPAYER_SLOT_ID)));
        bytes32 YAMATO_WITHDRAWER_KEY = bytes32(keccak256(abi.encode(YAMATO_WITHDRAWER_SLOT_ID)));
        bytes32 YAMATO_REDEEMER_KEY = bytes32(keccak256(abi.encode(YAMATO_REDEEMER_SLOT_ID)));
        bytes32 YAMATO_SWEEPER_KEY = bytes32(keccak256(abi.encode(YAMATO_SWEEPER_SLOT_ID)));
        bytes32 POOL_KEY = bytes32(keccak256(abi.encode(POOL_SLOT_ID)));
        bytes32 PRIORITY_REGISTRY_KEY = bytes32(keccak256(abi.encode(PRIORITY_REGISTRY_SLOT_ID)));

        /// @dev Cast bytes32(slot size) -> uint256 -> uint160(remove pre-padding) -> address
        address currency = address(uint160(uint256(vm.load(address(c.yamato), CURRENCY_OS_KEY))));
        address depositor = address(uint160(uint256(vm.load(address(c.yamato), YAMATO_DEPOSITOR_KEY))));
        address borrower = address(uint160(uint256(vm.load(address(c.yamato), YAMATO_BORROWER_KEY))));
        address repayer = address(uint160(uint256(vm.load(address(c.yamato), YAMATO_REPAYER_KEY))));
        address withdrawer = address(uint160(uint256(vm.load(address(c.yamato), YAMATO_WITHDRAWER_KEY))));
        address redeemer = address(uint160(uint256(vm.load(address(c.yamato), YAMATO_REDEEMER_KEY))));
        address sweeper = address(uint160(uint256(vm.load(address(c.yamato), YAMATO_SWEEPER_KEY))));
        address pool = address(uint160(uint256(vm.load(address(c.yamato), POOL_KEY))));
        address priorityRegistry = address(uint160(uint256(vm.load(address(c.yamato), PRIORITY_REGISTRY_KEY))));

        assertEq(currency, address(c.currencyOS));
        assertEq(depositor, address(c.yamatoDepositor));
        assertEq(borrower, address(c.yamatoBorrower));
        assertEq(repayer, address(c.yamatoRepayer));
        assertEq(withdrawer, address(c.yamatoWithdrawer));
        assertEq(redeemer, address(c.yamatoRedeemer));
        assertEq(sweeper, address(c.yamatoSweeper));
        assertEq(pool, address(c.pool));
        assertEq(priorityRegistry, address(c.priorityRegistry));
    }


    /*
    ==============================
        Set Pledge
    ==============================
        - yamato.setPledge()
        - yamato.setPledges()
    */
    function test_SetPledge() public {}
    function test_SetPledges() public {}


    /*
    =====================================
        Set TotalColl & Set TotalDebt
    =====================================
        - yamato.setTotalColl()
        - yamato.setTotalDebt()
    */
    function test_SetTotalColl() public {}
    function test_SetTotalDebt() public {}


    /*
    ==============================
        Set & Check FlashLock
    ==============================
        - yamato.setFlashLock()
        - yamato.checkFlashLock()
    */
    function test_SetFlashLock() public {}
    function test_CheckFlashLock() public {}


    /*
    ==============================
    # Fuzz -  Deposit
    ==============================
        - yamato.deposit{value}()
        - depositor().runDeposit(_sender)
    */
    function test_success_deposit_fuzz(uint96 amount) public {
        vm.assume(amount >=  0.1 ether);

        TestInitialStatus memory tis;
        tis.tester1Balance = UINT96_MAX;

        vm.prank(tester1);
        c.yamato.deposit{value: amount}();

        IYamato.Pledge memory pledge = c.yamato.getPledge(tester1);

        assertEq(tis.tester1Balance - amount, uint96(tester1.balance));
        assertEq(pledge.coll, uint256(amount));
        assertEq(pledge.debt, 0);
        assertEq(pledge.isCreated, true);
        assertEq(pledge.owner, tester1);
        // assertEq(pledge.priority, uint256(amount));
    }

    function test_fail_deposit_fuzz(uint96 amount) public {
        vm.assume(amount <  0.1 ether);

        TestInitialStatus memory tis;
        tis.tester1Balance = UINT96_MAX;

        vm.prank(tester1);
        vm.expectRevert(bytes("Deposit or Withdraw can't make pledge less than floor size."));
        c.yamato.deposit{value: amount}();
        // assertEq(pledge.priority, uint256(amount));
    }

    function test_success_runDeposit_fuzz(uint96 amount) public {
        vm.assume(amount >= 0.1 ether);

        TestInitialStatus memory tis;
        tis.tester1Balance = UINT96_MAX;

        vm.deal(address(c.yamato), amount);
        assertEq(address(c.yamato).balance, amount);

        vm.prank(address(c.yamato));
        c.yamatoDepositor.runDeposit{value: amount}(tester1);
    
        IYamato.Pledge memory pledge = c.yamato.getPledge(tester1);

        assertEq(address(c.yamato).balance, 0);
        assertEq(pledge.coll, uint256(amount));
        assertEq(pledge.debt, 0);
        assertEq(pledge.isCreated, true);
        assertEq(pledge.owner, tester1);
        // assertEq(pledge.priority, uint256(amount));
    }


    /*
    ==============================
    # Fuzz -  Borrow
    ==============================
        - yamato.borrow(uint256 borrowAmountInCurrency)
        - borrower().runDeposit(_sender, _borrowAmountInCurrency)
    */
    function test_success_borrow_fuzz(uint256 amount, uint8 rate) public {
        // fllor size: coll(deposit) / debt(borrow) = 1.1
        // max borrow = deposit / 1.1
        // 1 / 1.1 = 0.90909090909
        // rate / 255 = 231.818181818
        vm.assume(0 < rate && rate <= 100);
        vm.assume(amount >= 0.1 ether);

        vm.prank(tester1);
        c.yamato.deposit{value: amount}();

        /// @dev Only one action is permitted in the same block
        vm.roll(block.number + 1);

        vm.prank(tester1);
        /// @dev assumed amount is more than 0.1 ether above, so devide first and then multiple to avoid overflow
        c.yamato.borrow(amount / 100 * rate);
    }

    function test_fail_borrow_fuzz() public {}

    function test_success_runBorrow_fuzz(uint8 fuzz) public {}

    function test_fail_runBorrow_fuzz() public {}


    /*
    ==============================
    # Fuzz -  Redeem
    ==============================
        - yamato.redeem(uint256 maxRedemptionCurrencyAmount, bool isCoreRedemption)
        - depositor().runRedeem(RunRedeemArgs)
            RenRedeemArgs
                address sender;
                uint256 wantToRedeemCurrencyAmount;
                bool isCoreRedemption;
    */
    function test_success_redeem_fuzz(uint8 amount) public {
        // c.yamato.redeem(amount, true);
    }

    function test_fail_redeem_fuzz() public {}

    function test_success_runRedeem_fuzz(uint8 fuzz) public {
        // vm.prank(address(c.yamato));
        // IYamatoRedeemer(address(c.yamatoRedeemer)).runRedeem(
        //     IYamatoRedeemer.RunRedeemArgs(
        //         tester1,
        //         fuzz,
        //         true
        //     )
        // );
    }

    function test_fail_runRedeem_fuzz() public {}


    /*
    ==============================
    # Fuzz -  Repay
    ==============================
        - yamato.repay(uint256 borrowAmountInCurrency)
        - borrower().runRepay(_sender, _borrowAmountInCurrency)
    */
    function test_success_repay_fuzz() public {}
    function test_fail_repay_fuzz() public {}
    function test_success_runRepay_fuzz() public {}
    function test_fail_runRepay_fuzz() public {}


    /*
    ==============================
    # Fuzz -  Withdraw
    ==============================
        - yamato.withdraw(uint256 borrowAmountInCurrency)
        - borrower().runWithdraw(_sender, _borrowAmountInCurrency)
    */
    function test_success_withdraw_fuzz() public {}
    function test_fail_withdraw_fuzz() public {}
    function test_success_runWithdraw_fuzz() public {}
    function test_fail_runWithdraw_fuzz() public {}


    /*
    ==============================
    # Fuzz -  Sweep
    ==============================
        - yamato.sweep(uint256 borrowAmountInCurrency)
        - borrower().runSweep(_sender, _borrowAmountInCurrency)
    */
    function test_success_sweep_fuzz() public {}
    function test_fail_sweep_fuzz() public {}
    function test_success_runSweep_fuzz() public {}
    function test_fail_runSweep_fuzz() public {}


    /*
    ==============================
        toggle
    ==============================
        - yamato.toggle()
    */
    function test_success_toggle() public {}
    function test_fail_toggle() public {}




    function testMintCurrency(uint256 fuzz) public {
        uint256 cjpyAmountBefore = c.cjpy.balanceOf(tester1);

        vm.prank(address(c.yamato));
        c.currencyOS.mintCurrency(tester1, fuzz);

        uint256 cjpyAmountAfter = c.cjpy.balanceOf(tester1);

        assertEq(cjpyAmountBefore + fuzz, cjpyAmountAfter);
    }
}
