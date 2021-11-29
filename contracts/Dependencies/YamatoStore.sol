pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Dependencies/YamatoBase.sol";
import "hardhat/console.sol";

/// @title Yamato Store Base Contract
/// @author 0xMotoko
contract YamatoStore is YamatoBase {
    function __YamatoStore_init(address _yamato) public initializer {
        __YamatoBase_init(_yamato);
        __YamatoStore_init_unchained();
    }
    function __YamatoStore_init_unchained() public initializer {
    }
}
