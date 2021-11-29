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
import "./CjpyOS.sol";
import "./PriceFeed.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "hardhat/console.sol";

/// @title Yamato Withdrawer Contract
/// @author 0xMotoko

interface IYamatoWithdrawer {
    function runWithdraw(address _sender, uint256 _ethAmount) external payable;

    function yamato() external view returns (address);
    function pool() external view returns (address);
    function priorityRegistry() external view returns (address);
    function feePool() external view returns (address);
    function feed() external view returns (address);
    function cjpyOS() external view returns (address);
}

contract YamatoWithdrawer is IYamatoWithdrawer, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runWithdraw(address _sender, uint256 _ethAmount)
        public
        override
        onlyYamato
    {
        /*
            1. Get feed and pledge
        */
        IPriceFeed(feed()).fetchPrice();
        IYamato.Pledge memory pledge = IYamato(yamato).getPledge(_sender);
        (uint256 totalColl, , , , , ) = IYamato(yamato).getStates();

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
            IYamato(yamato).withdrawLocks(_sender) <= block.timestamp,
            "Withdrawal is being locked for this sender."
        );
        require(
            pledge.getICR(feed()) >= uint256(IYamato(yamato).MCR()) * 100,
            "Withdrawal failure: ICR is not more than MCR."
        );

        /*
            3. Update pledge
        */

        // Note: SafeMath unintentionally checks full withdrawal
        pledge.coll = pledge.coll - _ethAmount;
        IYamato(yamato).setPledge(pledge.owner, pledge);

        IYamato(yamato).setTotalDebt(totalColl - _ethAmount);

        /*
            4. Validate and update PriorityRegistry
        */
        if (pledge.coll == 0 && pledge.debt == 0) {
            /*
                4-a. Clean full withdrawal
            */
            IPriorityRegistry(priorityRegistry()).remove(pledge);
            IYamato(yamato).setPledge(pledge.owner, pledge.nil());
        } else {
            /*
                4-b. Reasonable partial withdrawal
            */
            require(
                pledge.getICR(feed()) >= uint256(IYamato(yamato).MCR()) * 100,
                "Withdrawal failure: ICR can't be less than MCR after withdrawal."
            );
            pledge.priority = IPriorityRegistry(priorityRegistry()).upsert(
                pledge
            );
            IYamato(yamato).setPledge(pledge.owner, pledge);
        }

        /*
            5-1. Charge CJPY
            5-2. Return coll to the withdrawer
        */
        IPool(pool()).sendETH(_sender, _ethAmount);
    }
}
