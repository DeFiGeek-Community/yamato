pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2024 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IYmtMinter {
    function YMT() external view returns (address);

    function scoreWeightController() external view returns (address);

    function minted(
        address user_,
        address score_
    ) external view returns (uint256);
}
