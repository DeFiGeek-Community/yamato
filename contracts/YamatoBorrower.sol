pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Pool.sol";
import "./YMT.sol";
import "./PriceFeedV3.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoBorrower.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "hardhat/console.sol";

/// @title Yamato Borrower Contract
/// @author 0xMotoko

contract YamatoBorrower is IYamatoBorrower, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runBorrow(
        address _sender,
        uint256 _borrowAmountInCurrency
    ) public override onlyYamato returns (uint256 fee) {
        /*
            1. Ready
        */
        IPriceFeedV3(priceFeed()).fetchPrice();
        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (, uint256 totalDebt, , , , ) = IYamato(yamato()).getStates();
        uint256 _ICRAfter = pledge.addDebt(_borrowAmountInCurrency).getICR(
            priceFeed()
        );
        fee = (_borrowAmountInCurrency * _ICRAfter.FR()) / 10000;
        uint256 returnableCurrency = _borrowAmountInCurrency - fee;

        /*
            2. Validate
        */
        require(
            !IYamato(yamato()).checkFlashLock(_sender),
            "Those can't be called in the same block."
        );
        require(pledge.isCreated, "This pledge is not created yet.");
        require(
            _ICRAfter >= uint256(IYamato(yamato()).MCR()) * 100,
            "This minting is invalid because of too large borrowing."
        );
        require(fee > 0, "fee must be more than zero.");
        require(
            returnableCurrency > 0,
            "(borrow - fee) must be more than zero."
        );

        /*
            3. Set FlashLock
        */
        IYamato(yamato()).setFlashLock(_sender);

        /*
            4. Add debt to a pledge in memory
        */
        pledge.debt += _borrowAmountInCurrency;

        /*
            5. Add PriorityRegistry change
        */
        pledge.priority = IPriorityRegistryV6(priorityRegistry()).upsert(
            pledge
        );

        /*
            6. Commit to pledge
        */
        IYamato(yamato()).setPledge(pledge.owner, pledge);

        /*
            7. Update totalDebt
        */
        IYamato(yamato()).setTotalDebt(totalDebt + _borrowAmountInCurrency);

        /*
            8. Borrowed fund & fee transfer
        */
        ICurrencyOS(currencyOS()).mintCurrency(_sender, returnableCurrency); // onlyYamato

        if (
            IPool(pool()).redemptionReserve() / 5 <=
            IPool(pool()).sweepReserve()
        ) {
            IPool(pool()).depositRedemptionReserve(fee);
        } else {
            IPool(pool()).depositSweepReserve(fee);
        }
    }
}
