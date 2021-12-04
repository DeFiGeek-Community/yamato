pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./YamatoBase.sol";
import "hardhat/console.sol";

/// @title Yamato Action Base Contract
/// @author 0xMotoko
contract YamatoAction is YamatoBase {
    function __YamatoAction_init(address _yamato) internal initializer {
        __YamatoBase_init(_yamato);
        __YamatoAction_init_unchained();
    }

    function __YamatoAction_init_unchained() internal initializer {}

    /*
        These accessors are mandatory for all actions to interact with.
    */
    function pool() public view returns (address) {
        return IYamato(yamato()).pool();
    }

    function priorityRegistry() public view returns (address) {
        return IYamato(yamato()).priorityRegistry();
    }
}
