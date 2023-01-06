pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IveYMT {
    function mintableInTimeframe(
        uint256 _start,
        uint256 _end
    ) external view returns (uint256);

    function balanceOfAt(
        address _addr,
        uint256 _at
    ) external view returns (uint256);

    function totalSupplyAt(uint256 _at) external view returns (uint256);
}
