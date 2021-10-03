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
    function mintableInTimeframe(uint256 _start, uint256 _end)
        external
        view
        returns (uint256);

    function balanceOfAt(address _addr, uint256 _at)
        external
        view
        returns (uint256);

    function totalSupplyAt(uint256 _at) external view returns (uint256);
}

contract veYMT is IveYMT {
    IYamato yamato = IYamato(address(0));

    function mintableInTimeframe(uint256 _start, uint256 _end)
        public
        view
        override
        returns (uint256)
    {
        return 1;
    }

    function balanceOfAt(address _addr, uint256 _at)
        public
        view
        override
        returns (uint256)
    {
        return 1;
    }

    function totalSupplyAt(uint256 _at) public view override returns (uint256) {
        return 1;
    }
}
