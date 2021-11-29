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

/// @title Yamato Repayer Contract
/// @author 0xMotoko

interface IYamatoRepayer {
    function runRepay(address _sender, uint256 _amount) external payable;

    function yamato() external view returns (address);
    function pool() external view returns (address);
    function priorityRegistry() external view returns (address);
    function feePool() external view returns (address);
    function feed() external view returns (address);
    function cjpyOS() external view returns (address);
}

contract YamatoRepayer is IYamatoRepayer, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runRepay(address _sender, uint256 _cjpyAmount)
        public
        override
        nonReentrant
        onlyYamato
    {
        /*
            1. Get feed and Pledge
        */
        IPriceFeed(feed()).fetchPrice();
        Pledge memory pledge = IYamato(yamato()).getPledges(_sender);
        (,uint256 totalDebt, , , , ) = IYamato(yamato()).getStates();

        /*
            2. Check repayability
        */
        require(_cjpyAmount > 0, "You are repaying no CJPY");
        require(
            pledge.debt >= _cjpyAmount,
            "You are repaying more than you are owing."
        );

        /*
            2. Compose a pledge in memory
        */
        pledge.debt -= _cjpyAmount;

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
        IYamato(yamato()).setTotalDebt(totalDebt - _cjpyAmount);

        /*
            4-1. Charge CJPY
            4-2. Return coll to the redeemer
        */
        ICjpyOS(cjpyOS()).burnCJPY(_sender, _cjpyAmount);
    }
}
