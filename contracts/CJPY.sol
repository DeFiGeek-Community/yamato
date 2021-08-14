pragma solidity 0.7.6;

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

import "./Currency.sol";
import "./Yamato.sol";

/**
 * @author 0xMotoko
 * @title CToken (Convertible Token).
 * @notice Very stable.
 */
contract CJPY is Currency {

    constructor(uint initialSupply) Currency("Convertible JPY Token","CJPY") {
        _mint(msg.sender, initialSupply);
    }

}