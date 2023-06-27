pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/ICurrency.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYMT.sol";
import "./veYMT.sol";
import "./Interfaces/IYamato.sol";
import "./YmtOS.sol";
import "./Dependencies/UUPSBase.sol";
import "hardhat/console.sol";

contract CurrencyOS is ICurrencyOS, UUPSBase {
    string constant CURRENCY_SLOT_ID = "deps.Currency";
    string constant PRICEFEED_SLOT_ID = "deps.PriceFeed";
    string constant FEEPOOL_SLOT_ID = "deps.FeePool";
    string constant YMTOS_SLOT_ID = "deps.YmtOS";

    /*
        ===========================
        !!! DANGER ZONE BEGINS !!!
        ===========================
    */
    address[] public yamatoes;

    /*
        ===========================
        !!! DANGER ZONE ENDED !!!
        ===========================
    */

    function initialize(
        address currencyAddr,
        address feedAddr,
        address feePoolAddr
    ) public initializer {
        __UUPSBase_init();

        bytes32 CURRENCY_KEY = bytes32(keccak256(abi.encode(CURRENCY_SLOT_ID)));
        bytes32 PRICEFEED_KEY = bytes32(
            keccak256(abi.encode(PRICEFEED_SLOT_ID))
        );
        bytes32 FEEPOOL_KEY = bytes32(keccak256(abi.encode(FEEPOOL_SLOT_ID)));
        assembly {
            sstore(CURRENCY_KEY, currencyAddr)
            sstore(PRICEFEED_KEY, feedAddr)
            sstore(FEEPOOL_KEY, feePoolAddr)
        }
    }

    function setDeps(address _ymtOS) public onlyGovernance {
        bytes32 YMTOS_KEY = bytes32(keccak256(abi.encode(YMTOS_SLOT_ID)));
        assembly {
            sstore(YMTOS_KEY, _ymtOS)
        }
    }

    modifier onlyYamato() {
        if (yamatoes.length == 0) {
            revert("No Yamato is registered.");
        } else {
            require(_permitMe(), "You are not Yamato deps.");
            _;
        }
    }

    /*
        =====================
        Public Functions
        =====================
    */
    function addYamato(address _yamatoAddr) external onlyGovernance {
        require(!exists(_yamatoAddr), "Duplicated Yamato.");
        yamatoes.push(_yamatoAddr);
        if (ymtOS() != address(0)) {
            IYmtOS(ymtOS()).addYamatoOfCurrencyOS(_yamatoAddr);
        }
    }

    function mintCurrency(
        address to,
        uint256 amount
    ) public override onlyYamato {
        ICurrency(currency()).mint(to, amount);
    }

    function burnCurrency(
        address to,
        uint256 amount
    ) public override onlyYamato {
        ICurrency(currency()).burn(to, amount);
    }

    /*
        =====================
        Getter Functions
        =====================
    */
    function currency() public view override returns (address _currency) {
        bytes32 CURRENCY_KEY = bytes32(keccak256(abi.encode(CURRENCY_SLOT_ID)));
        assembly {
            _currency := sload(CURRENCY_KEY)
        }
    }

    function priceFeed() public view override returns (address _feed) {
        bytes32 PRICEFEED_KEY = bytes32(
            keccak256(abi.encode(PRICEFEED_SLOT_ID))
        );
        assembly {
            _feed := sload(PRICEFEED_KEY)
        }
    }

    function feePool() public view override returns (address _feePool) {
        bytes32 FEEPOOL_KEY = bytes32(keccak256(abi.encode(FEEPOOL_SLOT_ID)));
        assembly {
            _feePool := sload(FEEPOOL_KEY)
        }
    }

    function ymtOS() public view override returns (address _ymtOS) {
        bytes32 YMTOS_KEY = bytes32(keccak256(abi.encode(YMTOS_SLOT_ID)));
        assembly {
            _ymtOS := sload(YMTOS_KEY)
        }
    }

    function YMT() public view override returns (address _YMT) {
        _YMT = IYmtOS(ymtOS()).YMT();
    }

    function veYMT() public view override returns (address _veYMT) {
        _veYMT = IYmtOS(ymtOS()).veYMT();
    }

    function exists(address _yamato) public view returns (bool) {
        for (uint256 i = 0; i < yamatoes.length; i++) {
            if (yamatoes[i] == _yamato) return true;
        }
        return false;
    }

    function _permitMe() internal returns (bool) {
        for (uint256 i = 0; i < yamatoes.length; i++) {
            if (IYamato(yamatoes[i]).permitDeps(msg.sender)) return true;
        }
        return false;
    }
}
