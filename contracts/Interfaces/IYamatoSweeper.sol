pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./IYamato.sol";
import "./ICurrencyOS.sol";

interface IYamatoSweeper {
    struct Vars {
        ICurrencyOS _currencyOS;
        uint256 sweepReserve;
        uint256 _poolBalance;
        uint256 _sweepingAmountTmp;
        uint256 _sweepingAmount;
        uint256 _gasCompensationInCurrency;
        uint256 _GRR;
        uint256 _reminder;
        uint256 _maxCount;
        uint256 _loopCount;
        uint256 _toBeSwept;
        IYamato.Pledge[] _bulkedPledges;
        address[] _pledgesOwner;
    }

    function runSweep(
        address _sender
    )
        external
        returns (
            uint256 _sweptAmount,
            uint256 gasCompensationInCurrency,
            address[] memory
        );

    function sweepDebt(
        IYamato.Pledge memory sPledge,
        uint256 maxSweeplable
    ) external returns (IYamato.Pledge memory, uint256, uint256);
}
