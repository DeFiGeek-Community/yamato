pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./IYamato.sol";

interface IPriorityRegistry {
    function upsert(IYamato.Pledge memory _pledge) external returns (uint256);

    function remove(IYamato.Pledge memory _pledge) external;

    function popRedeemable() external returns (IYamato.Pledge memory);

    function popSweepable() external returns (IYamato.Pledge memory);

    function LICR() external view returns (uint256);

    function pledgeLength() external view returns (uint256);

    function getLevelIndice(
        uint256 _icr,
        uint256 _i
    ) external view returns (address);

    function nextRedeemable() external view returns (IYamato.Pledge memory);

    function nextSweepable() external view returns (IYamato.Pledge memory);
}
