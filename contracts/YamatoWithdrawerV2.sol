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
import "./Interfaces/IYamatoV3.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoWithdrawer.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "hardhat/console.sol";

/// @title Yamato Withdrawer Contract
/// @author 0xMotoko
contract YamatoWithdrawerV2 is IYamatoWithdrawer, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    /// @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runWithdraw(
        address _sender,
        uint256 _ethAmount
    ) public override onlyYamato {
        /*
            1. Get feed and pledge
        */
        IPriceFeedV3(priceFeed()).fetchPrice();
        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (uint256 totalColl, , , , , ) = IYamato(yamato()).getStates();

        /*
            2. Validate
        */
        require(
            _ethAmount <= pledge.coll,
            "Withdrawal amount must be less than equal to the target coll amount."
        );
        require(
            _ethAmount <= totalColl,
            "Withdrawal amount must be less than equal to the total coll amount."
        );
        require(
            !IYamato(yamato()).checkFlashLock(_sender),
            "Those can't be called in the same block."
        );
        require(
            pledge.getICR(priceFeed()) > uint256(IYamato(yamato()).MCR()) * 100,
            "Withdrawal failure: ICR is not more than MCR."
        );

        /*
            3. Set flashlock
        */
        IYamato(yamato()).setFlashLock(_sender);

        /*
            4. Update pledge
        */
        // Note: SafeMath unintentionally checks full withdrawal
        pledge.coll -= _ethAmount;

        IYamato(yamato()).setPledge(pledge.owner, pledge);

        IYamato(yamato()).setTotalColl(totalColl - _ethAmount);

        /*
            5. Validate and update PriorityRegistry
        */
        if (pledge.coll == 0 && pledge.debt == 0) {
            /*
                5-a. Clean full withdrawal
            */
            IPriorityRegistry(priorityRegistry()).remove(pledge);
        } else {
            /*
                5-b. Reasonable partial withdrawal
            */
            require(
                pledge.coll >= IYamatoV3(yamato()).collFloor(),
                "Deposit or Withdraw can't make pledge less than floor size."
            );
            require(
                pledge.getICR(priceFeed()) >=
                    uint256(IYamato(yamato()).MCR()) * 100,
                "Withdrawal failure: ICR can't be less than MCR after withdrawal."
            );
            pledge.priority = IPriorityRegistry(priorityRegistry()).upsert(
                pledge
            );
        }
        IYamato(yamato()).setPledge(pledge.owner, pledge);

        /*
            6-1. Charge CJPY
            6-2. Return coll to the withdrawer
        */
        IPool(pool()).sendETH(_sender, _ethAmount);
    }
}
