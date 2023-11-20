pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IScoreController {
    function scoreTypes(address addr_) external view returns (uint256);

    function votingEscrow() external view returns (address);

    function checkpointScore(address addr) external;

    function checkpoint(address addr_) external;

    function updateScoreLimit(address addr_, uint256 l_, uint256 L_) external;

    function userCheckpoint(address addr_) external returns (bool);

    function addType(string memory name_, uint256 weight_) external;

    function addCurrency(
        address addr_,
        int128 scoreType_,
        uint256 weight_
    ) external;

    function scoreRelativeWeight(
        address addr,
        uint256 time
    ) external view returns (uint256);
}
