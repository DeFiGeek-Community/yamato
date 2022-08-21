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
import "./Interfaces/IYamatoDepositor.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "hardhat/console.sol";

/// @title Yamato Depositor Contract
/// @author 0xMotoko

contract YamatoDepositor is IYamatoDepositor, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    // @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runDeposit(address _sender) public payable override onlyYamato {
        IPriceFeed(priceFeed()).fetchPrice();
        uint256 _ethAmount = msg.value;

        /*
            1. Compose a pledge in memory
        */
        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (uint256 totalColl, , , , , ) = IYamato(yamato()).getStates();

        pledge.coll += _ethAmount;
        if (!pledge.isCreated) {
            // new pledge
            pledge.isCreated = true;
            pledge.owner = _sender;
        }

        /*
            2. Validate lock
        */
        require(
            !IYamato(yamato()).checkFlashLock(_sender),
            "Those can't be called in the same block."
        );

        /*
            3. Update PriorityRegistry
        */
        pledge.priority = IPriorityRegistry(priorityRegistry()).upsert(pledge);

        /*
            4. Commit pledge modifications
        */
        IYamato(yamato()).setPledge(pledge.owner, pledge);

        /*
            5. Set totalColl
        */
        IYamato(yamato()).setTotalColl(totalColl + _ethAmount);

        /*
            6. Set FlashLock
        */
        IYamato(yamato()).setFlashLock(_sender);

        /*
            7. Send ETH to pool
        */
        (bool success, ) = payable(pool()).call{value: _ethAmount}("");
        require(success, "transfer failed");
    }
}
