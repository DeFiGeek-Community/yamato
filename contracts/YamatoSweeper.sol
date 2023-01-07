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
import "./Interfaces/IYamatoSweeper.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "hardhat/console.sol";

/// @title Yamato Sweeper Contract
/// @author 0xMotoko

contract YamatoSweeper is IYamatoSweeper, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    // @dev no reentrancy guard because action funcs are protected by permitDeps()
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
        IPriceFeed(priceFeed()).fetchPrice();
        uint256 sweepStart = IPool(pool()).sweepReserve();
        require(sweepStart > 0, "Sweep failure: sweep reserve is empty.");
        uint8 _GRR = IYamato(yamato()).GRR();
        uint256 maxGasCompensation = sweepStart * (_GRR / 100);
        uint256 _reminder = sweepStart - maxGasCompensation; //Note: Secure gas compensation
        uint256 _maxSweeplableStart = _reminder;
        address[] memory _pledgesOwner = new address[](
            IPriorityRegistry(priorityRegistry()).pledgeLength()
        );
        uint256 _loopCount = 0;

        /*
            1. Sweeping
        */
        while (_reminder > 0) {
            try IPriorityRegistry(priorityRegistry()).popSweepable() returns (
                IYamato.Pledge memory _sweepablePledge
            ) {
                if (!_sweepablePledge.isCreated) break; // Note: No any more redeemable pledges
                if (_sweepablePledge.owner == address(0x00)) break; // Note: No any more redeemable pledges

                IYamato.Pledge memory sPledge = IYamato(yamato()).getPledge(
                    _sweepablePledge.owner
                );

                if (!sPledge.isCreated) break; // Note: registry-yamato mismatch
                if (sPledge.debt == 0) break; // Note: A once-swept pledge is called twice
                _pledgesOwner[_loopCount] = _sweepablePledge.owner; // Note: For event
                (
                    IYamato.Pledge memory _sweptPledge,
                    uint256 _sweptReminder,
                    uint256 sweepingAmount
                ) = this.sweepDebt(sPledge, _reminder);
                _reminder = _sweptReminder;
                sPledge = _sweptPledge;
                IYamato(yamato()).setPledge(sPledge.owner, sPledge);

                (, uint256 totalDebt, , , , ) = IYamato(yamato()).getStates();
                IYamato(yamato()).setTotalDebt(totalDebt - sweepingAmount);

                if (_reminder > 0) {
                    IPriorityRegistry(priorityRegistry()).remove(sPledge);
                    IYamato(yamato()).setPledge(sPledge.owner, sPledge.nil());
                }
                _loopCount++;
            } catch {
                break;
            } /* Oversweeping Flow */
        }
        require(
            _maxSweeplableStart > _reminder,
            "At least a pledge should be swept."
        );

        /*
            2. Gas compensation
        */
        uint256 _sweptAmount = sweepStart - _reminder;
        uint256 gasCompensationInCurrency = _sweptAmount * (_GRR / 100);
        IPool(pool()).sendCurrency(_sender, gasCompensationInCurrency); // Not sendETH. But redemption returns in ETH and so it's a bit weird.
        IPool(pool()).useSweepReserve(gasCompensationInCurrency);

        return (_sweptAmount, gasCompensationInCurrency, _pledgesOwner);
    }

    function sweepDebt(
        IYamato.Pledge memory sPledge,
        uint256 maxSweeplable
    )
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory, uint256, uint256)
    {
        uint256 sweepingAmount;
        uint256 reminder;

        /*
            1. sweeping amount and reminder calculation
        */
        if (maxSweeplable > sPledge.debt) {
            sweepingAmount = sPledge.debt;
            reminder = maxSweeplable - sPledge.debt;
        } else {
            sweepingAmount = maxSweeplable;
            reminder = 0;
        }

        /*
            2. Sweeping
        */
        sPledge.debt -= sweepingAmount;

        /*
            3. Budget reduction
        */
        IPool(pool()).useSweepReserve(sweepingAmount);
        ICurrencyOS(currencyOS()).burnCurrency(pool(), sweepingAmount);

        return (sPledge, reminder, sweepingAmount);
    }
}
