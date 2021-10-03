pragma solidity 0.7.6;
pragma abicoder v2;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./IERC20MintableBurnable.sol";
import "./PriceFeed.sol";
import "./Yamato.sol";
import "./YmtOSV1.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";

contract CurrencyOS {
    using SafeMath for uint256;

    IERC20MintableBurnable public currency;
    IERC20MintableBurnable public YMT;
    IERC20MintableBurnable public veYMT;
    address _feed;
    address governance;
    address ymtOSProxyAddr;
    address[] public yamatoes;
    bool isYmtOSInitialized = false;

    constructor(
        address currencyAddr,
        address ymtAddr,
        address veYmtAddr,
        address feedAddr
    ) {
        currency = IERC20MintableBurnable(currencyAddr);
        YMT = IERC20MintableBurnable(ymtAddr);
        veYMT = IERC20MintableBurnable(veYmtAddr);
        _feed = feedAddr;
        governance = msg.sender;
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
        currency.burnFrom(to, amount);
    }
}
