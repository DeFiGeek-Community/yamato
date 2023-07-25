pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./IYamato.sol";

interface IPriorityRegistryV6 {
    function upsert(IYamato.Pledge memory _pledge) external returns (uint256);

    function bulkUpsert(
        IYamato.Pledge[] memory _pledges
    ) external returns (uint256[] memory);

    function remove(IYamato.Pledge memory _pledge) external;

    function LICR() external view returns (uint256);

    function rankedQueueNextout(uint256 _icr) external view returns (uint256);

    function rankedQueueLen(uint256 _icr) external view returns (uint256);

    function rankedQueueTotalLen(uint256 _icr) external view returns (uint256);

    function rankedQueuePush(uint256 _icr, address _pledgeAddr) external;

    function rankedQueuePop(
        uint256 _icr
    ) external returns (address _pledgeAddr);

    function rankedQueueSearchAndDestroy(uint256 _icr, uint256 _i) external;
}
