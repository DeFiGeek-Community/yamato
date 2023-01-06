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
import "./Interfaces/IYamatoRepayer.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "hardhat/console.sol";

/// @title Yamato Repayer Contract
/// @author 0xMotoko

contract YamatoRepayer is IYamatoRepayer, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runRepay(
        address _sender,
        uint256 _currencyAmount
    ) public override onlyYamato {
        /*
            1. Get feed and Pledge
        */
        IPriceFeed(priceFeed()).fetchPrice();
        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (, uint256 totalDebt, , , , ) = IYamato(yamato()).getStates();

        /*
            2. Check repayability
        */
        require(_currencyAmount > 0, "You are repaying no Currency");
        require(pledge.debt > 0, "You can't repay for a zero-debt pledge.");

        /*
            2. Compose a pledge in memory
        */
        uint256 _repayAmount;
        if (_currencyAmount < pledge.debt) {
            _repayAmount = _currencyAmount;
        } else {
            _repayAmount = pledge.debt;
        }
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
