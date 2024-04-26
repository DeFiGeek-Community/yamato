pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IScoreWeightController {
    function veYMT() external view returns (address);

    function checkpointScore(address addr) external;

    function checkpoint(address addr_) external;

    function addScore(address addr_, uint256 weight_) external;

    function scoreRelativeWeight(
        address addr,
        uint256 time
    ) external view returns (uint256);

    function scores(address addr) external view returns (int128);
}
