pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./UUPSBase.sol";
import "../Interfaces/IYamato.sol";
import "../Interfaces/ICurrencyOS.sol";
import "hardhat/console.sol";

/// @title Yamato Action and Yamato Store Base Contract
/// @author 0xMotoko
contract YamatoBase is UUPSBase {
    string internal YAMATO_SLOT_ID;

    function __YamatoBase_init(address _yamato) internal initializer {
        __UUPSBase_init();
        __YamatoBase_init_unchained(_yamato);
    }

    function __YamatoBase_init_unchained(address _yamato) internal initializer {
        YAMATO_SLOT_ID = "deps.Yamato";
        bytes32 YAMATO_KEY = bytes32(keccak256(abi.encode(YAMATO_SLOT_ID)));
        assembly {
            sstore(YAMATO_KEY, _yamato)
        }
    }

    /// @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function yamato() public view virtual returns (address _yamato) {
        bytes32 YAMATO_KEY = bytes32(keccak256(abi.encode(YAMATO_SLOT_ID)));
        assembly {
            _yamato := sload(YAMATO_KEY)
        }
    }

    /// @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function currencyOS() public view virtual returns (address) {
        return IYamato(yamato()).currencyOS();
    }

    /// @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function feePool() public view virtual returns (address) {
        return ICurrencyOS(currencyOS()).feePool();
    }

    /// @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function priceFeed() public view virtual returns (address) {
        return ICurrencyOS(currencyOS()).priceFeed();
    }

    /// @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function permitDeps(address _sender) public view virtual returns (bool) {
        return IYamato(yamato()).permitDeps(_sender);
    }

    modifier onlyYamato() virtual {
        require(permitDeps(msg.sender), "You are not Yamato contract.");
        _;
    }
}
