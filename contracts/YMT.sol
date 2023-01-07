pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./Interfaces/IYMT.sol";

/**
 * @author 0xMotoko
 * @title YMT Token
 * @notice Divident. Inflatable but the rate is to be decreasing.
 */
contract YMT is IYMT, ERC20Permit {
    address ymtOSProxy;

    constructor(
        uint256 initialSupply,
        address _ymtOSProxy
    ) ERC20Permit("Yamato") ERC20("Yamato", "YMT") {
        _mint(msg.sender, initialSupply);
        ymtOSProxy = _ymtOSProxy;
    }

    modifier onlyYmtOSProxy() {
        require(msg.sender == ymtOSProxy, "You are not Yamato contract.");
        _;
    }

    function mint(
        address to,
        uint256 amount
    ) public virtual override onlyYmtOSProxy {
        _mint(to, amount);
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        require(
            _msgSender() != spender,
            "sender and spender shouldn't be the same."
        );
        require(amount > 0, "Amount is zero.");

        _approve(_msgSender(), spender, amount);
        return true;
    }
}
