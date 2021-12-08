pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./IYamato.sol";

interface IYamatoSweeper {
    function runSweep(address _sender)
        external
        returns (
            uint256 _sweptAmount,
            uint256 gasCompensationInCurrency,
            address[] memory
        );

    function sweepDebt(IYamato.Pledge memory sPledge, uint256 maxSweeplable)
        external
        returns (
            IYamato.Pledge memory,
            uint256,
            uint256
        );
}
