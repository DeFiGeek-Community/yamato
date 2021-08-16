pragma solidity 0.7.6;
pragma abicoder v2;
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Yamato
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 *
 * This Factory is a fork of Murray Software's deliverables.
 * And this entire project is including the fork of Hegic Protocol.
 * Hence the license is alinging to the GPL-3.0
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./CurrencyOS.sol";

contract CjpyOS is CurrencyOS {
    constructor(address cjpyAddr, address ymtAddr, address veYmtAddr, address feedAddr) CurrencyOS(cjpyAddr, ymtAddr, veYmtAddr, feedAddr) {
    }
}