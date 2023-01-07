pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./Interfaces/IveYMT.sol";

/**
 * @author 0xMotoko
 * @title veYMT Token
 * @notice Locked YMT. An ERC-20 but w/o transfer()
 */

contract veYMT is IveYMT {
    string name;
    string symbol;

    constructor() {
        name = "Voting-escrow Yamato";
        symbol = "veYMT";
    }

    function mintableInTimeframe(
        uint256 _start,
        uint256 _end
    ) public view override returns (uint256) {
        return 1;
    }

    function balanceOfAt(
        address _addr,
        uint256 _at
    ) public view override returns (uint256) {
        return 1;
    }

    function totalSupplyAt(uint256 _at) public view override returns (uint256) {
        return 1;
    }
}
