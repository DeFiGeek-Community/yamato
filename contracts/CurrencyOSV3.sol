pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/ICurrency.sol";
import "./Interfaces/ICurrencyOSV3.sol";
import "./Interfaces/IYMT.sol";
import "./veYMT.sol";
import "./Interfaces/IYamatoV3.sol";
import "./Dependencies/UUPSBase.sol";
import "hardhat/console.sol";

contract CurrencyOSV3 is ICurrencyOSV3, UUPSBase {
    string constant CURRENCY_SLOT_ID = "deps.Currency";
    string constant PRICEFEED_SLOT_ID = "deps.PriceFeed";
    string constant FEEPOOL_SLOT_ID = "deps.FeePool";
    string constant YMT_SLOT_ID = "deps.YMT";
    string constant VEYMT_SLOT_ID = "deps.veYMT";
    string constant MINTER_SLOT_ID = "deps.Minter";
    string constant WEIGHT_CONTROLLER_SLOT_ID = "deps.ScoreWeightController";

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

    event YamatoAdded(address _yamatoAddr);

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

    function setPriceFeed(address feedAddr) external onlyGovernance {
        bytes32 PRICEFEED_KEY = bytes32(
            keccak256(abi.encode(PRICEFEED_SLOT_ID))
        );
        assembly {
            sstore(PRICEFEED_KEY, feedAddr)
        }
    }

    function setYMT(address ymtAddr) external onlyGovernance {
        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        assembly {
            sstore(YMT_KEY, ymtAddr)
        }
    }

    function setVeYMT(address veYmtAddr) external onlyGovernance {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            sstore(VEYMT_KEY, veYmtAddr)
        }
    }

    function setYmtMinter(address ymtMinterAddr) external onlyGovernance {
        bytes32 MINTER_KEY = bytes32(keccak256(abi.encode(MINTER_SLOT_ID)));
        assembly {
            sstore(MINTER_KEY, ymtMinterAddr)
        }
    }

    function setScoreWeightController(
        address scoreWeightControllerAddr
    ) external onlyGovernance {
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );
        assembly {
            sstore(WEIGHT_CONTROLLER_KEY, scoreWeightControllerAddr)
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
        emit YamatoAdded(_yamatoAddr);
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
        bytes32 MINTER_KEY = bytes32(keccak256(abi.encode(MINTER_SLOT_ID)));
        assembly {
            _ymtMinter := sload(MINTER_KEY)
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

    function exists(address _yamato) public view returns (bool) {
        for (uint256 i = 0; i < yamatoes.length; i++) {
            if (yamatoes[i] == _yamato) return true;
        }
        return false;
    }

    function _permitMe() internal view returns (bool) {
        for (uint256 i = 0; i < yamatoes.length; i++) {
            if (IYamato(yamatoes[i]).permitDeps(msg.sender)) return true;
        }
        return false;
    }
}
