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
import "./PriceFeed.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/ICurrency.sol";
import "./Interfaces/IYamatoRepayer.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

/// @title Yamato Repayer Contract
/// @author 0xMotoko

contract YamatoRepayerV2 is IYamatoRepayer, YamatoAction {
    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runRepay(address _sender, uint256 _wantToRepayCurrencyAmount)
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
        uint256 senderBalance = IERC20(ICurrencyOS(currencyOS()).currency())
            .balanceOf(_sender);

        /*
            2. Check repayability
        */
        require(_wantToRepayCurrencyAmount > 0, "You are repaying no Currency");
        require(pledge.debt > 0, "You can't repay for a zero-debt pledge.");
        require(
            _wantToRepayCurrencyAmount <= senderBalance,
            "You are trying to repay more than you have."
        ); // V2 (Dec 7, 2021)
        require(
            _wantToRepayCurrencyAmount <= pledge.debt,
            "You are trying to repay more than your debt."
        ); // V2 (Dec 7, 2021)

        /*
            2. Compose a pledge in memory
        */
        pledge.debt -= _wantToRepayCurrencyAmount;

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
        IYamato(yamato()).setTotalDebt(totalDebt - _wantToRepayCurrencyAmount);

        /*
            4-1. Charge Currency
            4-2. Return coll to the redeemer
        */
        ICurrencyOS(currencyOS()).burnCurrency(
            _sender,
            _wantToRepayCurrencyAmount
        );
    }
}
