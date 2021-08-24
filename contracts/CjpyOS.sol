pragma solidity 0.7.6;
pragma abicoder v2;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./CurrencyOS.sol";

contract CjpyOS is CurrencyOS {
    constructor(address cjpyAddr, address ymtAddr, address veYmtAddr, address feedAddr) CurrencyOS(cjpyAddr, ymtAddr, veYmtAddr, feedAddr) {
    }
}