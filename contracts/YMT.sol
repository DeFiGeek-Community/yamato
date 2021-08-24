pragma solidity 0.7.6;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/


//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "./Yamato.sol";

/**
 * @author 0xMotoko
 * @title YMT Token
 * @notice Divident. Inflatable but the rate is to be decreasing. 
 */
contract YMT is ERC20PresetMinterPauser {
    IYamato yamato = IYamato(address(0));
    constructor(uint256 initialSupply) ERC20PresetMinterPauser("Yamato", "YMT") {
        _mint(msg.sender, initialSupply);
    }

    modifier onlyYamato(){
        require(msg.sender == address(yamato), "You are not Yamato contract.");
        _;
    }

    function mint(address to, uint amount) public virtual override onlyYamato() {
        _mint(to, amount);
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        require(_msgSender() != spender, "sender and spender shouldn't be the same.");
        require(amount > 0, "Amount is zero.");

        _approve(_msgSender(), spender, amount);
        return true;
    }

}