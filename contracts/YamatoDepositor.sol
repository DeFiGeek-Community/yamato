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

/// @title Yamato Depositor Contract
/// @author 0xMotoko

interface IYamatoDepositor {
    function runDeposit(address _sender) external payable;

    function yamato() external view returns (address);
    function pool() external view returns (address);
    function priorityRegistry() external view returns (address);
    function feePool() external view returns (address);
    function feed() external view returns (address);
    function currencyOS() external view returns (address);
}

contract YamatoDepositor is IYamatoDepositor, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    // @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runDeposit(address _sender)
        public
        override
        payable
        onlyYamato
    {
        IPriceFeed(feed()).fetchPrice();
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
            2. Update PriorityRegistry
        */
        pledge.priority = IPriorityRegistry(priorityRegistry()).upsert(pledge);

        /*
            3. Commit pledge modifications
        */
        IYamato(yamato()).setPledge(pledge.owner, pledge);

        /*
            4. Set totalColl
        */
        IYamato(yamato()).setTotalColl(totalColl + _ethAmount);

        /*
            5. Send ETH to pool
        */
        (bool success, ) = payable(pool()).call{value: _ethAmount}("");
        require(success, "transfer failed");
        IPool(pool()).lockETH(_ethAmount);
        IYamato(yamato()).setDepositAndBorrowLocks(_sender);
    }
}
