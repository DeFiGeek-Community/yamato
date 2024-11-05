pragma solidity 0.8.4;
// This contract is not in use.

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./veYMT.sol";
import "./Interfaces/IYMT.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IYmtOS.sol";
import "./Interfaces/ICurrencyOSV3.sol";
import "./Dependencies/UUPSBase.sol";

contract YmtOS is IYmtOS, UUPSBase {
    string constant YMT_SLOT_ID = "deps.YMT";
    string constant VEYMT_SLOT_ID = "deps.veYMT";
    string constant YMT_MINTER_SLOT_ID = "deps.ymtMinter";
    string constant WEIGHT_CONTROLLER_SLOT_ID = "deps.ScoreWeightController";

    address[] currencyOSs;

    function initialize(address cjpyCurrencyOS) public override initializer {
        __UUPSBase_init();

        currencyOSs.push(cjpyCurrencyOS);

        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        bytes32 MINTER_KEY = bytes32(keccak256(abi.encode(YMT_MINTER_SLOT_ID)));
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );

        address _ymt = ICurrencyOSV3(cjpyCurrencyOS).YMT();
        address _veYMT = ICurrencyOSV3(cjpyCurrencyOS).veYMT();
        address _ymtMinter = ICurrencyOSV3(cjpyCurrencyOS).ymtMinter();
        address _scoreWeightController = ICurrencyOSV3(cjpyCurrencyOS)
            .scoreWeightController();

        assembly {
            sstore(YMT_KEY, _ymt)
            sstore(VEYMT_KEY, _veYMT)
            sstore(MINTER_KEY, _ymtMinter)
            sstore(WEIGHT_CONTROLLER_KEY, _scoreWeightController)
        }
    }

    modifier onlyCurrencyOSs() {
        require(_exists(), "You are not the registered CurrencyOS.");
        _;
    }

    function _exists() internal returns (bool) {
        for (uint256 i = 0; i < currencyOSs.length; ++i) {
            if (msg.sender == currencyOSs[i]) return true;
        }
        return false;
    }

    function addCurrencyOS(address _currencyOS) external onlyGovernance {
        currencyOSs.push(_currencyOS);
    }

    function YMT() public view override returns (address _YMT) {
        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        assembly {
            _YMT := sload(YMT_KEY)
        }
    }

    function veYMT() public view override returns (address _veYMT) {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            _veYMT := sload(VEYMT_KEY)
        }
    }

    function ymtMinter() public view override returns (address _ymtMinter) {
        bytes32 YMT_MINTER_KEY = bytes32(
            keccak256(abi.encode(YMT_MINTER_SLOT_ID))
        );
        assembly {
            _ymtMinter := sload(YMT_MINTER_KEY)
        }
    }

    function scoreWeightController()
        public
        view
        override
        returns (address _scoreWeightController)
    {
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );
        assembly {
            _scoreWeightController := sload(WEIGHT_CONTROLLER_KEY)
        }
    }

    function exists(address _currencyOS) public view returns (bool) {
        for (uint256 i; i < currencyOSs.length; ++i) {
            if (currencyOSs[i] == _currencyOS) return true;
        }
        return false;
    }
}
