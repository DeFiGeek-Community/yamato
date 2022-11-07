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
import { PledgeLib } from "../../contracts/Dependencies/PledgeLib.sol";
import { PriceFeedV2 } from "../../contracts/PriceFeedV2.sol";
import { IYamato } from "../../contracts/Interfaces/IYamato.sol";

contract PledgeLibTest is Test {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;
    
    function setUp() public {}

    /*
    ------------------------
        PledgeLib
    ------------------------
        - ✅getICR(, address _feed)
        - ✅getICRWithPrice(, _ethPriceInCurrency)
        - ✅addDebt(, _adder)
        - ✅FR()
        - ✅cappedRedemptionAmount(pledge, uint256 mcr, uint256 icr)
        - ✅toBeRedeemed(uint256 mcr, uint256 icr, uint256 ethPriceInCurrency)

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
        @param _collPriceInCurrency = coll * ethPriceInCurency <= type(uint256).max [overflow]
        @dev Use vm.mockCall to assert that the PriceFeedV2 returns _ethPriceInCurrency (fuzz seed: uint256)
        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
    */
    function test_success_getICR_fuzz(
        uint256 _collPriceInCurrency, 
        uint256 _debt, 
        bool _isCreated, 
        address _owner, 
        uint256 _priority, 
        uint256 _ethPriceInCurrency
    ) public {
        vm.assume(_ethPriceInCurrency != 0 && _collPriceInCurrency >= _ethPriceInCurrency);
        uint256 _coll = _collPriceInCurrency / _ethPriceInCurrency;

        address mockPriceFeedAddr = address(bytes20("priceFeed"));
        vm.etch(mockPriceFeedAddr, address(new PriceFeedV2()).code);
        vm.mockCall(
            mockPriceFeedAddr,
            abi.encodeWithSelector(bytes4(keccak256("lastGoodPrice()"))),
            abi.encode(_ethPriceInCurrency)
        );

        IYamato.Pledge memory _pledge = IYamato.Pledge({
            coll: _coll,
            debt: _debt,
            isCreated: _isCreated,
            owner: _owner,
            priority: _priority
        });

        _pledge.getICR(mockPriceFeedAddr);
    }

    /**
        getICRWithPrice(
            IYamato.Pledge memory _pledge, 
            uint256 _ethPriceInCurrency
        )
        @param _collPriceInCurrency = coll * ethPriceInCurency <= type(uint256).max [overflow]
        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
    */
    function test_success_getICRWithPrice_fuzz(
        uint256 _collPriceInCurrency, 
        uint256 _debt, 
        bool _isCreated, 
        address _owner, 
        uint256 _priority, 
        uint256 _ethPriceInCurrency
    ) public {
        vm.assume(_ethPriceInCurrency != 0 && _collPriceInCurrency >= _ethPriceInCurrency);
        uint256 _coll = _collPriceInCurrency / _ethPriceInCurrency;

        IYamato.Pledge memory _pledge = IYamato.Pledge({
            coll: _coll,
            debt: _debt,
            isCreated: _isCreated,
            owner: _owner,
            priority: _priority
        });

        _pledge.getICRWithPrice(_ethPriceInCurrency);
    }

    /**
        addDebt(
            IYamato.Pledge memory _pledge,
            uint256 _adder
        )
        @param _debtPlusAdder = _debt + _adder <= type(uint256).max [overflow]
        Note    e.g. type(uint256).max / 2 ≈ 3.4028237e38
                debt, adder: 5.78960445e58 JPY >> JPY Money Supply M3 (1.56477970 e15 JPY)
                This number is much larger than usage.
    */
    function test_success_addDebt_fuzz(
        uint256 _debtPlusAdder, 
        uint256 _debt,
        uint256 _coll,
        bool _isCreated,
        address _owner,
        uint256 _priority
    ) public {
        vm.assume(_debtPlusAdder >= _debt);
        uint256 _adder = _debtPlusAdder - _debt;

        IYamato.Pledge memory _pledge = IYamato.Pledge({
            coll: _coll,
            debt: _debt,
            isCreated: _isCreated,
            owner: _owner,
            priority: _priority
        });

        _pledge.addDebt(_adder);
    }

    /**
        FR(uint256 _ICRpertenk)
        @notice FeeRate
        @param _ICRpertenk >= 13000
     */
    function test_success_FR_fuzz(
        uint256 _ICRpertenk
    ) public {
        vm.assume(_ICRpertenk >= 13000);
        _ICRpertenk.FR();
    }

    /**
        cappedRedemptionAmount(
            IYamato.Pledge memory pledge,
            uint256 mcr,
            uint256 icr
        )
        @param _collPriceInCurrency = coll * ethPriceInCurency <= type(uint256).max [overflow]
        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
        @param mcr > 10000
                10000 <= icr && icr <= mcr
    */
    function test_success_cappedRedemptionAmount_fuzz(
        uint256 _collPriceInCurrency, 
        uint256 _debt, 
        bool _isCreated, 
        address _owner, 
        uint256 _priority, 
        uint256 _ethPriceInCurrency,
        uint256 mcr
    ) public {
        vm.assume(mcr > 10000);
        vm.assume(_ethPriceInCurrency != 0 && _collPriceInCurrency >= _ethPriceInCurrency);
        vm.assume(0 < _debt && _debt <= type(uint256).max / mcr);
        uint256 _coll = _collPriceInCurrency / _ethPriceInCurrency;

        IYamato.Pledge memory _pledge = IYamato.Pledge({
            coll: _coll,
            debt: _debt,
            isCreated: _isCreated,
            owner: _owner,
            priority: _priority
        });

        uint256 icr = _pledge.getICRWithPrice(_ethPriceInCurrency);
        vm.assume(10000 <= icr && icr <= mcr);

        _pledge.cappedRedemptionAmount(mcr, icr);
    }

    /**
        toBeRedeemed(
            IYamato.Pledge memory pledge,
            uint256 mcr,
            uint256 icr,
            uint256 ethPriceInCurrency
        )
        @param _collPriceInCurrency = coll * ethPriceInCurency <= type(uint256).max [overflow]
        Note    e.g. sqrt(type(uint256).max) ≈ 3.4028237e38
                coll: 3.4e20 ETH >> TotalSupply(1.2e8 ETH)
                ethPriceInCurrency: 3.4e20 JPY/ETH >> 1.97e5 JPY/ETH (Oct,2022)
                This number is much larger than usage.
        @param mcr > 10000
                10000 <= icr && icr <= mcr
     */
    function test_success_toBeRedeemed_fuzz(
        uint256 _collPriceInCurrency, 
        uint256 _debt, 
        bool _isCreated, 
        address _owner, 
        uint256 _priority, 
        uint256 _ethPriceInCurrency,
        uint256 mcr
    ) public {
        vm.assume(mcr > 10000);
        vm.assume(_ethPriceInCurrency != 0 && _collPriceInCurrency >= _ethPriceInCurrency);
        vm.assume(0 < _debt && _debt <= type(uint256).max / mcr);
        uint256 _coll = _collPriceInCurrency / _ethPriceInCurrency;

        IYamato.Pledge memory _pledge = IYamato.Pledge({
            coll: _coll,
            debt: _debt,
            isCreated: _isCreated,
            owner: _owner,
            priority: _priority
        });

        uint256 icr = _pledge.getICRWithPrice(_ethPriceInCurrency);
        vm.assume(10000 <= icr && icr < mcr);
        // vm.assume(10000 > icr);
        // vm.assume(icr >= mcr);
        console2.log(icr);
        console2.log(mcr);

        _pledge.toBeRedeemed(mcr, icr, _ethPriceInCurrency);
    }
}