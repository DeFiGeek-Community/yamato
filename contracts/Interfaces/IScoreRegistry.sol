pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IScoreRegistry {
    function checkpoint(address addr_) external;

    function updateScoreLimit(
        address addr_,
        uint256 debt_,
        uint256 totaldebt_
    ) external;

    function userCheckpoint(address addr_) external returns (bool);

    function integrateFraction(address addr_) external view returns (uint256);
}
