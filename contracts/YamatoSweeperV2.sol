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
import "./Interfaces/IYamatoV3.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoSweeper.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "hardhat/console.sol";

/// @title Yamato Sweeper Contract
/// @author 0xMotoko

contract YamatoSweeperV2 is IYamatoSweeper, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    // @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runSweep(address _sender)
        public
        override
        onlyYamato
        returns (
            uint256 _sweptAmount,
            uint256 gasCompensationInCurrency,
            address[] memory _pledgesOwner
        )
    {
        IPriceFeed(feed()).fetchPrice();

        IYamatoSweeper.Vars memory vars;

        vars.sweepReserve = IPool(pool()).sweepReserve();
        require(
            vars.sweepReserve > 0,
            "Sweep failure: sweep reserve is empty."
        );
        vars._GRR = IYamato(yamato()).GRR();
        vars.maxGasCompensation = vars.sweepReserve * (vars._GRR / 100);
        vars._reminder = vars.sweepReserve - vars.maxGasCompensation; //Note: Secure gas compensation
        vars._gasReductedSweepCapacity = vars._reminder;
        vars.pledgeLength = IPriorityRegistry(priorityRegistry())
            .pledgeLength();
        vars._pledgesOwner = new address[](vars.pledgeLength);
        vars._bulkedPledges = new IYamato.Pledge[](vars.pledgeLength);
        vars._maxCount = IYamatoV3(yamato()).maxRedeemableCount();

        /*
            1. Sweeping
        */
        IYamato _yamato = IYamato(yamato());
        IPriorityRegistryV6 _prv6 = IPriorityRegistryV6(priorityRegistry());
        while (true) {
            address _pledgeAddr = _prv6.rankedQueuePop(0);

            if (_pledgeAddr == address(0)) {
                break;
            }

            IYamato.Pledge memory _pledge = _yamato.getPledge(_pledgeAddr);

            uint256 _pledgeDebt = _pledge.debt;

            if (_pledgeDebt >= vars._reminder) {
                _pledge.debt = _pledgeDebt - vars._reminder;
                vars._reminder = 0;
                vars._toBeSwept += _pledgeDebt - vars._reminder;
            } else {
                _pledge.debt = 0;
                vars._reminder -= _pledgeDebt;
                vars._toBeSwept += _pledgeDebt;
            }
            _pledge.coll = 0; // Note: Sometimes very tiny coll would be there but ignore it.

            vars._pledgesOwner[vars._loopCount] = _pledge.owner; // Note: For event
            vars._bulkedPledges[vars._loopCount] = _pledge;

            vars._loopCount++;

            if (vars._toBeSwept >= vars._gasReductedSweepCapacity) {
                break; /* redeeming amount reached to the target */
            }
            if (vars._loopCount >= vars._maxCount) {
                break;
            }
        }
        require(vars._toBeSwept > 0, "At least a pledge should be swept.");

        /*
            Update pledges
        */
        for (uint256 i; i < vars._bulkedPledges.length; i++) {
            IYamato.Pledge memory _pledge = vars._bulkedPledges[i];
            if (_pledge.debt == 0) {
                _prv6.remove(_pledge);
                _yamato.setPledge(_pledge.owner, _pledge.nil());
            } else {
                _prv6.upsert(_pledge);
                _yamato.setPledge(_pledge.owner, _pledge);
            }
        }

        /*
            Update global state
        */
        (, uint256 totalDebt, , , , ) = _yamato.getStates();
        _yamato.setTotalDebt(totalDebt - vars._toBeSwept);

        /*
            Reserve reduction and burn CJPY
        */
        IPool(pool()).useSweepReserve(vars._toBeSwept);
        ICurrencyOS(currencyOS()).burnCurrency(pool(), vars._toBeSwept);

        /*
            Gas compensation
        */
        uint256 gasCompensationInCurrency = vars._toBeSwept * (vars._GRR / 100);
        IPool(pool()).sendCurrency(msg.sender, gasCompensationInCurrency); // Not sendETH. But redemption returns in ETH and so it's a bit weird.
        IPool(pool()).useSweepReserve(gasCompensationInCurrency);

        return (vars._toBeSwept, gasCompensationInCurrency, vars._pledgesOwner);
    }

    /*
        @dev Deprecated in V2.
    */
    function sweepDebt(IYamato.Pledge memory sPledge, uint256 maxSweeplable)
        public
        override
        onlyYamato
        returns (
            IYamato.Pledge memory,
            uint256,
            uint256
        )
    {
        IYamato.Pledge memory sPledge;
        uint256 reminder;
        uint256 sweepingAmount;
        return (sPledge, reminder, sweepingAmount);
    }
}
