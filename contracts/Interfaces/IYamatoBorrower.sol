pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
interface IYamatoBorrower {
    function runBorrow(
        address _sender,
        uint256 _borrowAmountInCurrency
    ) external returns (uint256 fee);
}
