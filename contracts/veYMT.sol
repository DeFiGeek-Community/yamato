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
 * @title veYMT Token
 * @notice Locked YMT. An ERC-20 but w/o transfer()
 */

interface IveYMT {
    function mintableInTimeframe(uint _start, uint _end) external view returns (uint);
    function balanceOfAt(address _addr, uint _at) external view returns (uint);
    function totalSupplyAt(uint _at) external view returns (uint);
}

contract veYMT is IveYMT {
    IYamato yamato = IYamato(address(0));

    function mintableInTimeframe(uint _start, uint _end) public view override returns (uint) {
        return 1;
    }

    function balanceOfAt(address _addr, uint _at) public view override returns (uint) {
        return 1;
    }

    function totalSupplyAt(uint _at) public view override returns (uint) {
        return 1;
    }
}