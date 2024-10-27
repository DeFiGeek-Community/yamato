pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2024 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/ICurrency.sol";
import "./Interfaces/ICurrencyOSV4.sol";
import "./Interfaces/IYmtOS.sol";
import "./Interfaces/IYamatoV3.sol";
import "./Dependencies/UUPSBase.sol";

contract CurrencyOSV4 is ICurrencyOSV4, UUPSBase {
    string constant CURRENCY_SLOT_ID = "deps.Currency";
    string constant PRICEFEED_SLOT_ID = "deps.PriceFeed";
    string constant FEEPOOL_SLOT_ID = "deps.FeePool";
    string constant YMTOS_SLOT_ID = "deps.YmtOS";
    string constant YMT_SLOT_ID = "deps.YMT";
    string constant VEYMT_SLOT_ID = "deps.veYMT";
    string constant YMT_MINTER_SLOT_ID = "deps.ymtMinter";
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

    function setPriceFeed(address feedAddr) external override onlyGovernance {
        bytes32 PRICEFEED_KEY = bytes32(
            keccak256(abi.encode(PRICEFEED_SLOT_ID))
        );
        assembly {
            sstore(PRICEFEED_KEY, feedAddr)
        }
    }

    function setYmtOS(address ymtOSAddr) external override onlyGovernance {
        bytes32 YMTOS_KEY = bytes32(keccak256(abi.encode(YMTOS_SLOT_ID)));
        assembly {
            sstore(YMTOS_KEY, ymtOSAddr)
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

    function ymtMinter() public view override returns (address _ymtMinter) {
        _ymtMinter = IYmtOS(ymtOS()).ymtMinter();
    }

    function scoreWeightController()
        public
        view
        override
        returns (address _scoreWeightController)
    {
        _scoreWeightController = IYmtOS(ymtOS()).scoreWeightController();
    }

    function exists(address _yamato) public view returns (bool) {
        for (uint256 i; i < yamatoes.length; ++i) {
            if (yamatoes[i] == _yamato) return true;
        }
        return false;
    }

    function _permitMe() internal view returns (bool) {
        for (uint256 i; i < yamatoes.length; ++i) {
            if (IYamato(yamatoes[i]).permitDeps(msg.sender)) return true;
        }
        return false;
    }
}
