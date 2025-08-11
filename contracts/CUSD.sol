pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2024 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./CurrencyV2.sol";

/**
 * @title CToken (Convertible Token).
 * @notice Very stable.
 */
contract CUSD is CurrencyV2 {
    constructor() CurrencyV2("Convertible USD Token", "CUSD") {}
}
