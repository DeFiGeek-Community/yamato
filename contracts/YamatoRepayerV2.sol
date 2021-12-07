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
import "./Interfaces/ICurrency.sol";

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Yamato Repayer Contract
/// @author 0xMotoko

import "./YamatoRepayer.sol";

contract YamatoRepayerV2 is IYamatoRepayer, YamatoAction {

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runRepay(address _sender, uint256 _wantToRepayAmount)
        public
        override
        onlyYamato
    {
        /*
            1. Get feed and Pledge
        */
        IPriceFeed(feed()).fetchPrice();
        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (, uint256 totalDebt, , , , ) = IYamato(yamato()).getStates();
        uint256 senderBalance = IERC20(ICurrencyOS(currencyOS()).currency()).balanceOf(_sender);

        /*
            2. Check repayability
        */
        require(_wantToRepayAmount > 0, "You are repaying no Currency");
        require(pledge.debt > 0, "You can't repay for a zero-debt pledge.");
        

        /*
            2. Compose a pledge in memory
        */

        // repayAmount must be less than equal balance
        uint256 _repayAmount = (_wantToRepayAmount <= senderBalance) ? _wantToRepayAmount : senderBalance;

        // repayAmount must be less than equal pledge debt amount
        _repayAmount = (_repayAmount < pledge.debt) ? _repayAmount : pledge.debt;

        // Note: "_repayAmount is less than debt but more than balance" causes bad UX
        // when a borrower directly try repaying all debt
        // but if she doesn't have enough currenct due to the fee reduction.
        pledge.debt -= _repayAmount;



        /*
            3. Add PriorityRegistry update result to a pledge in memory
        */
        pledge.priority = IPriorityRegistry(priorityRegistry()).upsert(pledge);

        /*
            4. Commit a pledge in memory to YamatoStore
        */
        IYamato(yamato()).setPledge(pledge.owner, pledge);

        /*
            5. Commit totalDebt
        */
        IYamato(yamato()).setTotalDebt(totalDebt - _repayAmount);

        /*
            4-1. Charge Currency
            4-2. Return coll to the redeemer
        */
        ICurrencyOS(currencyOS()).burnCurrency(_sender, _repayAmount);
    }
}
