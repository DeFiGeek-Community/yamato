pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./IYamato.sol";

interface IPriorityRegistryFlexV6 {
    struct FifoQueue {
        uint256 nextout;
        address[] pledges;
    }
    struct DeleteDictItem {
        bool isCreated;
        uint248 index;
    }
    struct BulkUpsertVar {
        uint256 _ethPriceInCurrency;
        uint256[] _newPriorities;
        IYamato.Pledge _pledge;
        uint256 _oldICRpercent;
        uint256 _newICRPertenk;
        uint256 _newICRpercent;
        uint256 _mcrPercent;
        uint256 _checkpoint;
        bool _isSyncAction;
        uint256 _lenAtLICR;
        uint256 _maxCount;
        uint256 _lastIndex;
        uint256 _preStateLowerBoundRank;
        uint256 _postStateLowerBoundRank;
        uint256 _postStateUpperBoundRank;
        bool _isFullAction;
    }
    enum Direction {
        UP,
        DOWN,
        ZERO
    }

    function MAX_PRIORITY() external view returns (uint256);

    function pledgeLength() external view returns (uint256);

    function getRankedQueue(
        uint256 _icr,
        uint256 _i
    ) external view returns (address _pledgeAddr);
}
