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
import "./Dependencies/LiquityMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IYamatoV3.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoSweeper.sol";
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

    /// @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runSweep(
        address _sender
    )
        public
        override
        onlyYamato
        returns (
            uint256 _sweptAmount,
            uint256 gasCompensationInCurrency,
            address[] memory _pledgesOwner
        )
    {
        IPriceFeedV3(priceFeed()).fetchPrice();

        IYamatoSweeper.Vars memory vars;

        vars._GRR = IYamato(yamato()).GRR();
        vars._currencyOS = ICurrencyOS(currencyOS());
        vars.sweepReserve = IPool(pool()).sweepReserve();
        vars._poolBalance = IERC20(vars._currencyOS.currency()).balanceOf(
            pool()
        );
        vars._sweepingAmountTmp = LiquityMath._min(
            vars.sweepReserve,
            vars._poolBalance
        );
        vars._sweepingAmount =
            (vars._sweepingAmountTmp * (100 - vars._GRR)) /
            100;
        vars._gasCompensationInCurrency =
            vars._sweepingAmountTmp -
            vars._sweepingAmount;

        if (vars._sweepingAmountTmp > 0 && vars._sweepingAmount == 0) {
            revert("Sweep budget is too small to pay gas reward.");
        }
        require(
            vars._sweepingAmount > 0,
            "Sweep failure: sweep reserve is empty."
        );
        vars._reminder = vars._sweepingAmount;
        vars._maxCount = IYamatoV3(yamato()).maxRedeemableCount();
        vars._pledgesOwner = new address[](vars._maxCount);
        vars._bulkedPledges = new IYamato.Pledge[](vars._maxCount);

        /*
            1. Sweeping
        */
        IYamato _yamato = IYamato(yamato());
        IPriorityRegistryV6 _prv6 = IPriorityRegistryV6(priorityRegistry());
        require(_prv6.rankedQueueLen(0) > 0, "No sweepables.");
        while (true) {
            address _pledgeAddr = _prv6.rankedQueuePop(0);

            if (_pledgeAddr == address(0)) {
                break;
            }

            IYamato.Pledge memory _pledge = _yamato.getPledge(_pledgeAddr);

            uint256 _pledgeDebt = _pledge.debt;

            if (_pledgeDebt >= vars._reminder) {
                _pledge.debt = _pledgeDebt - vars._reminder;
                vars._toBeSwept += vars._reminder;
                vars._reminder = 0;
            } else {
                _pledge.debt = 0;
                vars._toBeSwept += _pledgeDebt;
                vars._reminder -= _pledgeDebt;
            }

            _pledge.coll = 0; // Note: Sometimes very tiny coll would be there but ignore it. Don't reduce totalColl.

            vars._pledgesOwner[vars._loopCount] = _pledge.owner; // Note: For event
            vars._bulkedPledges[vars._loopCount] = _pledge;

            vars._loopCount++;

            if (vars._toBeSwept >= vars._sweepingAmount) {
                break; /* redeeming amount reached to the target */
            }
            if (vars._loopCount >= vars._maxCount) {
                break;
            }
        }
        require(vars._toBeSwept > 0, "At least a pledge should be swept.");
        require(vars._sweepingAmount >= vars._toBeSwept, "Too much sweeping.");

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
            Update global state for 99%
        */
        (, uint256 totalDebt, , , , ) = _yamato.getStates();
        _yamato.setTotalDebt(totalDebt - vars._toBeSwept);

        /*
            Reserve reduction for 99%
        */
        IPool(pool()).useSweepReserve(vars._toBeSwept);
        vars._currencyOS.burnCurrency(pool(), vars._toBeSwept);

        /*
            Gas compensation for 1%
        */
        IPool(pool()).sendCurrency(_sender, vars._gasCompensationInCurrency); // Not sendETH. But redemption returns in ETH and so it's a bit weird.
        IPool(pool()).useSweepReserve(vars._gasCompensationInCurrency);

        return (
            vars._toBeSwept,
            vars._gasCompensationInCurrency,
            vars._pledgesOwner
        );
    }

    /// @dev Deprecated in V2.
    function sweepDebt(
        IYamato.Pledge memory sPledge,
        uint256 maxSweeplable
    )
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory, uint256, uint256)
    {
        IYamato.Pledge memory sPledge;
        uint256 reminder;
        uint256 sweepingAmount;
        return (sPledge, reminder, sweepingAmount);
    }
}
