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
import "./PriceFeed.sol";
import "./Interfaces/IYamato.sol";
import "./YmtOSV1.sol";
import "./Dependencies/UUPSBase.sol";
import "hardhat/console.sol";

contract CurrencyOS is ICurrencyOS, UUPSBase {
    IYMT public YMT;
    IveYMT public veYMT;
    address ymtOSProxyAddr;

    address[] public yamatoes;
    bool isYmtOSInitialized = false;

    string CURRENCY_SLOT_ID;
    string PRICEFEED_SLOT_ID;
    string FEEPOOL_SLOT_ID;

    function initialize(
        address currencyAddr,
        address feedAddr,
        address feePoolAddr
    ) public initializer {
        __UUPSBase_init();
        CURRENCY_SLOT_ID = "deps.Currency";
        PRICEFEED_SLOT_ID = "deps.PriceFeed";
        FEEPOOL_SLOT_ID = "deps.FeePool";
        
        bytes32 CURRENCY_KEY = bytes32(keccak256(abi.encode(CURRENCY_SLOT_ID)));
        bytes32 PRICEFEED_KEY = bytes32(keccak256(abi.encode(PRICEFEED_SLOT_ID)));
        bytes32 FEEPOOL_KEY = bytes32(keccak256(abi.encode(FEEPOOL_SLOT_ID)));
        assembly {
            sstore(CURRENCY_KEY, currencyAddr)
            sstore(PRICEFEED_KEY, feedAddr)
            sstore(FEEPOOL_KEY, feePoolAddr)
        }

    }

    function setGovernanceTokens(address _ymtAddr, address _veYmtAddr)
        external
        onlyGovernance
    {
        YMT = IYMT(_ymtAddr);
        veYMT = IveYMT(_veYmtAddr);
    }

    function setYmtOSProxy(address _ymtOSProxyAddr)
        external
        onlyGovernance
        onlyOnce
    {
        ymtOSProxyAddr = _ymtOSProxyAddr;
    }

    modifier onlyOnce() {
        require(!isYmtOSInitialized, "YmtOS is already initialized.");
        isYmtOSInitialized = true;
        _;
    }




    function addYamato(address _yamatoAddr) external onlyGovernance {
        yamatoes.push(_yamatoAddr);
        if (ymtOSProxyAddr != address(0)) {
            IYmtOSV1(ymtOSProxyAddr).addYamatoOfCurrencyOS(_yamatoAddr);
        }
    }

    modifier onlyYamato() {
        if (yamatoes.length == 0) {
            revert("No Yamato is registered.");
        } else {
            for (uint256 i = 0; i < yamatoes.length; i++) {
                if (
                    IYamato(yamatoes[i])
                        .permitDeps(msg.sender)
                ) {
                    _;
                }
            }
        }
    }

    function mintCurrency(address to, uint256 amount) public onlyYamato override {
        ICurrency(currency()).mint(to, amount);
    }

    function burnCurrency(address to, uint256 amount) public onlyYamato override {
        ICurrency(currency()).burn(to, amount);
    }

    function currency() public view override returns (address _currency) {
        bytes32 CURRENCY_KEY = bytes32(keccak256(abi.encode(CURRENCY_SLOT_ID)));
        assembly {
           _currency := sload(CURRENCY_KEY)
        }
    }
    function feed() public view override returns (address _feed) {
        bytes32 PRICEFEED_KEY = bytes32(keccak256(abi.encode(PRICEFEED_SLOT_ID)));
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

}
