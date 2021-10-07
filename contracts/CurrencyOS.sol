pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/ICurrency.sol";
import "./Interfaces/IYMT.sol";
import "./veYMT.sol";
import "./PriceFeed.sol";
import "./Interfaces/IYamato.sol";
import "./YmtOSV1.sol";
import "./Dependencies/SafeMath.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";

contract CurrencyOS {
    using SafeMath for uint256;

    ICurrency public currency;
    IYMT public YMT;
    IveYMT public veYMT;
    address _feed;
    address governance;
    address ymtOSProxyAddr;
    address[] public yamatoes;
    bool isYmtOSInitialized = false;

    constructor(address currencyAddr, address feedAddr) {
        currency = ICurrency(currencyAddr);
        _feed = feedAddr;
        governance = msg.sender;
    }

    function setGovernanceTokens(address _ymtAddr, address _veYmtAddr)
        external
        onlyGovernance
    {
        YMT = IYMT(_ymtAddr);
        veYMT = IveYMT(_veYmtAddr);
    }

    function addYamato(address _yamatoAddr) external onlyGovernance {
        yamatoes.push(_yamatoAddr);
        if (ymtOSProxyAddr != address(0)) {
            IYmtOSV1(ymtOSProxyAddr).addYamatoOfCurrencyOS(_yamatoAddr);
        }
    }

    function setYmtOSProxy(address _ymtOSProxyAddr)
        external
        onlyGovernance
        onlyOnce
    {
        ymtOSProxyAddr = _ymtOSProxyAddr;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "You are not the governer.");
        _;
    }
    modifier onlyOnce() {
        require(!isYmtOSInitialized, "YmtOS is already initialized.");
        isYmtOSInitialized = true;
        _;
    }

    modifier onlyYamato() {
        if (yamatoes.length == 0) {
            revert("No Yamato is registered.");
        } else {
            for (uint256 i = 0; i < yamatoes.length; i++) {
                if (msg.sender == yamatoes[i]) {
                    _;
                } else if (yamatoes.length.sub(1) == i) {
                    revert("Caller is not Yamato");
                } else {}
            }
        }
    }

    function _mintCurrency(address to, uint256 amount) internal {
        currency.mint(to, amount);
    }

    function _burnCurrency(address to, uint256 amount) internal {
        currency.burn(to, amount);
    }
}
