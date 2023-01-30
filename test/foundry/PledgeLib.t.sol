pragma solidity ^0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xtanaka (0xtanaka@pm.me)
 * Copyright (C) 2022 Yamato Protocol (DeFiGeek Community Japan)
 */

/**
    @notice It is impossible to handle values larger than the maximum number of uint256.
            That's why explicit testing of assumptions is so important.

    [ Assumptions. ]

    +--------------------+---------+----------------+
    |  name              | type    |  unit          |
    +--------------------+---------+----------------+
    |  coll              | uint256 |  ETH           |
    |  debt              | uint256 | Currency(CJPY) |
    | ethPriceInCurrency | uint256 | Currency / ETH |
    +--------------------+---------+----------------+

    Maximum values of ...     type(uint256)
    +------------------------------------+
    |   coll   ≈ 1.15792089 e77 wei      |
    |          ≈ 1.15792089 e59 ETH      |  * ETH decimal = e18
    |   debt   ≈ 1.15792089 e59 CJPY     |
    | ethPrice ≈ 1.15792089 e59 CJPY/ETH |  * price decimal = e18
    +------------------------------------+

    Reference (2022 Oct 17)
    # coll #  [ETH]
      ETH Circulating Supply: 122,373,863.50 ETH
        (https://coinmarketcap.com/currencies/ethereum/)
      -> 1.2237386350 e8 ETH
    # debt #  [currency = CJPY]
      JPY Money Supply M3	1564779.70	1563216.00	JPY Billion	Sep 2022
        (https://tradingeconomics.com/japan/money-supply-m3)
      -> 1.56477970 e15 JPY
    # ethPriceInCurrency #  [currency = JPY]
      Ethereum Price (ETH): ¥196,652.12
        (https://coinmarketcap.com/ja/currencies/ethereum/)
      -> 1.9665212 e5 JPY/ETH

        type(uint256).max : 115792089237316195423570985008687907853269984665640564039457584007913129639935
    decimal: 18

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
import {PledgeLib} from "../../contracts/Dependencies/PledgeLib.sol";
import {IYamato} from "../../contracts/Interfaces/IYamato.sol";
import {IPriceFeedV2} from "../../contracts/interfaces/IPriceFeedV2.sol";

contract PledgeLibTest is Test {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function setUp() public {}

    /*
    ------------------------
        PledgeLib
    ------------------------
        - ✅ getICR(, address _feed)
            - ✅ Success
            - ✅ Fail   - _feed is null address
        - ✅ getICRWithPrice(, _ethPriceInCurrency)
            ⚠️ Changed the calculation logic in getICRWithPrice
            - ✅ Success
        - ✅ addDebt(, _adder)
            - ✅ Success
        - ✅ FR()
            - ✅ Success
            - ✅ Fail   - ICR too low to get fee data.
        - ✅ cappedRedemptionAmount(pledge, uint256 mcr, uint256 icr)
            - ✅ Success
            - ✅ Fail   - overflow
        - ✅ toBeRedeemed(uint256 mcr, uint256 icr, uint256 ethPriceInCurrency)

        No fuzz check because it does not handle numbers.
            - toMem()
            - clone()
            - sync(sPledge, _pledge) // memory to storage
            - assign(mPledge, _pledge) // one memory to the other
            - nil()
    */


    /**
        getICR(
            IYamato.Pledge memory _pledge,
            address _feed
        )

        @param _pledge.coll
        @param _ethPriceInCurrency The multiplication of _pledge.coll and _ethPriceInCurrency cannot exceed the maximum value of uint256.
        @param _priceFeedAddr must not be zero-address

        @dev Use vm.mockCall to assert that the PriceFeedV2 returns _ethPriceInCurrency (fuzz seed: uint256)
        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
    */
    function test_Fuzz_Success_getICR(
        IYamato.Pledge memory _pledge,
        uint256 _ethPriceInCurrency,
        address _priceFeedAddr
    ) public {
        /// Assumptions for success
        if (_ethPriceInCurrency != 0) {
            _pledge.coll = bound(_pledge.coll, 0, type(uint256).max / _ethPriceInCurrency);
        }
        vm.assume(  _priceFeedAddr != address(0) &&
                    _priceFeedAddr != address(console) && /// @dev Verify that it is not and address belonging to a group of test contracts.
                    _priceFeedAddr != address(vm) &&
                    _priceFeedAddr != address(PledgeLib));

        /// Mocking
        vm.mockCall(
            _priceFeedAddr,
            abi.encodeWithSelector(IPriceFeedV2.lastGoodPrice.selector),
            abi.encode(_ethPriceInCurrency)
        );

        /// Execute
        uint256 _ICR = _pledge.getICR(_priceFeedAddr);

        /// Assertions
        if (_pledge.coll == 0 && _pledge.debt == 0) {
            assertEq(_ICR, 0);
        } else if (_pledge.coll > 0 && _pledge.debt == 0) {
            assertEq(_ICR, 2**256 - 1);
        } else {
            uint256 _collInCurrency = (_pledge.coll * _ethPriceInCurrency) / 1e18;
            // Note: ICR is per-ten-k in Yamato
            assertEq(_ICR, (10000 * _collInCurrency) / _pledge.debt);
        }

    }

    /**
        getICR(
            IYamato.Pledge memory _pledge,
            address _feed
        )

        @notice In case _feed address is zero-address, getICR() will always revert with the reason "Feed is null address."
    */
    function test_Fuzz_Fail_getICR_NullAddress(
        IYamato.Pledge memory _pledge
    ) public {
        /// Execute & Revert
        vm.expectRevert("Feed is null address.");
        _pledge.getICR(address(0));
    }


    /**
        getICRWithPrice(
            IYamato.Pledge memory _pledge,
            uint256 _ethPriceInCurrency
        )

        Note    Changed the ICR calculation logic in getICRWithPrice,
                allowing for the handling of the multiplication of _pledge.coll & _ethPriceInCurrency,
                which are 10,000 times larger.

        @param _pledge.coll
        @param _ethPriceInCurrency The multiplication of _pledge.coll and _ethPriceInCurrency cannot exceed the maximum value of uint256.

        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
    */
    function test_Fuzz_Success_getICRWithPrice(
        IYamato.Pledge memory _pledge,
        uint256 _ethPriceInCurrency
    ) public {
        /// Assumptions for success
        if (_ethPriceInCurrency != 0) {
            /// Note Before the change:
            // _pledge.coll = bound(_pledge.coll, 0, type(uint256).max / _ethPriceInCurrency / 10000);
            _pledge.coll = bound(_pledge.coll, 0, type(uint256).max / _ethPriceInCurrency);
        }

        /// Execute
        uint256 _ICR = _pledge.getICRWithPrice(_ethPriceInCurrency);

        /// Assertions
        if (_pledge.debt != 0) {
            /// Note Before the change:
            // assertEq(_ICR, ((10000 * (_pledge.coll * _ethPriceInCurrency)) / 1e18) / _pledge.debt);
            assertEq(_ICR, (_pledge.coll * _ethPriceInCurrency) / 1e14 / _pledge.debt);
        } else {
            if (_pledge.coll > 0) {
                assertEq(_ICR, 2**256 - 1);
            } else {
                assertEq(_ICR, 0);
            }
        }

    }


    /**
        addDebt(
            IYamato.Pledge memory _pledge,
            uint256 _adder
        )

        @param _pledge.debt
        @param _adder The sum of _pledge.debt and _adder cannot exceed the maximum value of uint256.

        Note    e.g. type(uint256).max / 2 ≈ 3.4028237e38
                debt, adder: 5.78960445e58 JPY >> JPY Money Supply M3 (1.56477970 e15 JPY)
                This number is much larger than usage.
    */
    function test_Fuzz_Success_addDebt(
        IYamato.Pledge memory _pledge,
        uint256 _adder
    ) public {
        /// Assumption for success
        _adder = bound(_adder, 0, type(uint256).max - _pledge.debt);

        /// Execute
        IYamato.Pledge memory _pledgeAfter = _pledge.addDebt(_adder);

        /// Assert
        assertEq(_pledge.debt + _adder, _pledgeAfter.debt);
    }


    /**
        FR(uint256 _ICRpertenk)
        @notice FeeRate

        @param _ICRpertenk must be greater than or equal to 13000.
     */
    function test_Fuzz_Success_FR(uint256 _ICRpertenk) public {
        /// Assumption for success
        _ICRpertenk = bound(_ICRpertenk, 13000, type(uint256).max);

        /// Execute
        uint256 _FRpertenk = _ICRpertenk.FR();

        /// Assertions
        if (_ICRpertenk < 15000) {
            assertEq(_FRpertenk, 400 - ((_ICRpertenk - 13000) * 10) / 100);
        } else if (15000 <= _ICRpertenk && _ICRpertenk < 20000) {
            assertEq(_FRpertenk, 200 - ((_ICRpertenk - 15000) * 2) / 100);
        } else if (20000 <= _ICRpertenk && _ICRpertenk < 50000) {
            assertEq(_FRpertenk, 100 - ((_ICRpertenk - 20000) * 3) / 10 / 100);
        } else {
            assertEq(_FRpertenk, 10);
        }
    }

    /**
        FR(uint256 _ICRpertenk)
        @notice FeeRate

        @param _ICRpertenk In case _ICRPertenk is less than 13000,
                            FR() will always revert with the reason "ICR too low to get fee data."
     */
    function test_Fuzz_Fail_FR_ICRTooLow(uint256 _ICRpertenk) public {
        /// Assumption for success
        _ICRpertenk = bound(_ICRpertenk, 0, 12999);

        /// Execute & Revert
        vm.expectRevert("ICR too low to get fee data.");
        _ICRpertenk.FR();
    }


    /**
        cappedRedemptionAmount(
            IYamato.Pledge memory pledge,
            uint256 mcr,
            uint256 icr
        )
        Note    cappedRedemptionAmount is only used in the following context.
                    10000 <= icr && icr < mcr (PledgeLib.toBeRedeemed)

        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.

        @param _pledge.debt
        @param icr >= 10000
        @param mcr > 10000
                10000 <= icr && icr <= mcr
                The multiplication of _pledge.debt and (mur - icr) cannot exceed the maximum value of uint256.
    */
    function test_Fuzz_Success_cappedRedemptionAmount(
        IYamato.Pledge memory _pledge,
        uint256 icr,
        uint256 mcr
    ) public {
        /// Only used in the following context
        vm.assume(10000 <= icr && icr < mcr);

        /// Assumption for success
        vm.assume(_pledge.debt <= type(uint256).max / (mcr - icr));

        /// Execute
        uint256 _toBeRedeemed = _pledge.cappedRedemptionAmount(mcr, icr);

        /// Assertion
        assertEq(_toBeRedeemed, (_pledge.debt * (mcr - icr)) / (mcr - 10000));
    }

    function test_Fuzz_Fail_cappedRedemptionAmount_overflow(
        IYamato.Pledge memory _pledge,
        uint256 icr,
        uint256 mcr
    ) public {
        /// Only used in the following context
        vm.assume(10000 <= icr && icr < mcr);

        /// Assumptions for fail
        vm.assume(mcr - icr > 1);
        _pledge.debt = bound(_pledge.debt, (type(uint256).max / (mcr - icr)) + 1, type(uint256).max);

        /// Execute & Revert
        vm.expectRevert(stdError.arithmeticError);
        _pledge.cappedRedemptionAmount(mcr, icr);
    }


    /**
        toBeRedeemed(
            IYamato.Pledge memory pledge,
            uint256 mcr,
            uint256 icr,
            uint256 ethPriceInCurrency
        )
        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
        @param mcr > 10000
                10000 <= icr && icr <= mcr
     */
    function test_Fuzz_Success_toBeRedeemed(
        IYamato.Pledge memory pledge,
        uint256 mcr,
        uint256 icr,
        uint256 ethPriceInCurrency
    ) public {
        /// Assumptions for success
        // ethPriceInCurrency = bound(ethPriceInCurrency, 0, type(uint256).max);

        if (ethPriceInCurrency != 0 && icr < 10000) {
            pledge.coll = bound(pledge.coll, 0, type(uint256).max / ethPriceInCurrency);
        } else if (10000 <= icr && icr < mcr) {
            vm.assume(pledge.debt <= type(uint256).max / (mcr - icr));
        }

        /// Execute
        uint256 _result = pledge.toBeRedeemed(mcr, icr, ethPriceInCurrency);

        /// Assertions
        if (icr < 10000) {
            // coll-based value
            assertEq(_result,
                (pledge.coll * ethPriceInCurrency) / // Note: getRedeemablesCap's under-MCR value is based on unfetched price
                1e18);
        } else if (10000 <= icr && icr < mcr) {
            // icr=130%-based value
            assertEq(_result, pledge.cappedRedemptionAmount(mcr, icr));
        } else {
            assertEq(_result, 0);
        }
    }
}
