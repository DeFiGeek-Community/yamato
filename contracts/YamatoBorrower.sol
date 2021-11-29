pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Pool.sol";
import "./PriorityRegistry.sol";
import "./YMT.sol";
import "./PriceFeed.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "hardhat/console.sol";

/// @title Yamato Borrower Contract
/// @author 0xMotoko

interface IYamatoBorrower {
    function runBorrow(address _sender, uint256 _borrowAmountInCurrency) external returns (uint256 fee);

    function yamato() external view returns (address);
    function pool() external view returns (address);
    function priorityRegistry() external view returns (address);
    function feePool() external view returns (address);
    function feed() external view returns (address);
    function currencyOS() external view returns (address);
}

contract YamatoBorrower is IYamatoBorrower, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runBorrow(address _sender, uint256 _borrowAmountInCurrency)
        public
        override
        onlyYamato
        returns (uint256 fee)
    {
        /*
            1. Ready
        */
        IPriceFeed(feed()).fetchPrice();
        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (,uint256 totalDebt, , , , ) = IYamato(yamato()).getStates();
        uint256 _ICRAfter = pledge.addDebt(_borrowAmountInCurrency).getICR(
            feed()
        );
        uint256 fee = (_borrowAmountInCurrency * _ICRAfter.FR()) / 10000;
        uint256 returnableCurrency = _borrowAmountInCurrency - fee;

        /*
            2. Validate
        */
        require(
            IYamato(yamato()).depositAndBorrowLocks(_sender) < block.number,
            "Borrowing should not be executed within the same block with your deposit."
        );
        require(pledge.isCreated, "This pledge is not created yet.");
        require(
            _ICRAfter >= uint256(IYamato(yamato()).MCR()) * 100,
            "This minting is invalid because of too large borrowing."
        );
        require(fee > 0, "fee must be more than zero.");
        require(returnableCurrency > 0, "(borrow - fee) must be more than zero.");

        /*
            3. Add debt to a pledge in memory
        */
        pledge.debt += _borrowAmountInCurrency;

        /*
            4. Add PriorityRegistry change
        */
        pledge.priority = IPriorityRegistry(priorityRegistry()).upsert(pledge);


        /*
            5. Commit to pledge
        */
        IYamato(yamato()).setPledge(pledge.owner, pledge);


        /*
            5. Update totalDebt
        */
        IYamato(yamato()).setTotalDebt(totalDebt + _borrowAmountInCurrency);

        /*
            5. Cheat guard
        */
        IYamato(yamato()).setWithdrawLocks(_sender);

        /*
            6. Borrowed fund & fee transfer
        */
        ICurrencyOS(currencyOS()).mintCurrency(_sender, returnableCurrency); // onlyYamato
        ICurrencyOS(currencyOS()).mintCurrency(address(IPool(pool())), fee); // onlyYamato

        if (IPool(pool()).redemptionReserve() / 5 <= IPool(pool()).sweepReserve()) {
            IPool(pool()).depositRedemptionReserve(fee);
        } else {
            IPool(pool()).depositSweepReserve(fee);
        }

    }
}
