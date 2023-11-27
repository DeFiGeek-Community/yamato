pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IveYMT {

    struct Point {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
}

    function totalSupply() external view returns (uint256);

    function getLastUserSlope(address addr_) external view returns (int128);

    function lockedEnd(address addr_) external view returns (uint256);

    function balanceOf(
        address addr_,
        uint256 t_
    ) external view returns (uint256);

    function balanceOf(address addr) external view returns (uint256);

    function totalSupply(uint256 t_) external view returns (uint256);

    function userPointEpoch(address _user) external view returns (uint256);

    function userPointHistoryTs(
        address addr,
        uint256 epoch
    ) external view returns (uint256);

    function epoch() external view returns (uint256);

    function userPointHistory(
        address addr,
        uint256 loc
    ) external view returns (Point memory);

    function pointHistory(uint256 loc) external view returns (Point memory);

    function checkpoint() external;
}
