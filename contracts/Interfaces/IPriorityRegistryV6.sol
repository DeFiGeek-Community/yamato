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
    struct FifoQueue {
        uint256 nextout;
        IYamato.Pledge[] pledges;
    }
    struct DeleteDictItem {
        bool isCreated;
        uint256 index;
    }

    function upsert(IYamato.Pledge memory _pledge) external returns (uint256);

    function bulkUpsert(IYamato.Pledge[] memory _pledges)
        external
        returns (uint256[] memory);

    function remove(IYamato.Pledge memory _pledge) external;

    function popRedeemable() external returns (IYamato.Pledge memory);

    function popSweepable() external returns (IYamato.Pledge memory);

    function LICR() external view returns (uint256);

    function pledgeLength() external view returns (uint256);

    function rankedQueueNextout(uint256 _icr) external view returns (uint256);

    function rankedQueueTotalLen(uint256 _icr) external view returns (uint256);

    function rankedQueuePush(uint256 _icr, IYamato.Pledge memory _pledge)
        external;

    function rankedQueuePop(uint256 _icr)
        external
        returns (IYamato.Pledge memory _pledge);

    function rankedQueueSearchAndDestroy(uint256 _icr, uint256 _i) external;

    function getRankedQueue(uint256 _icr, uint256 _i)
        external
        view
        returns (IYamato.Pledge memory);
}