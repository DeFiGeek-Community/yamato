pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "../Interfaces/IYamato.sol";
import "hardhat/console.sol";

interface IYamatoSameBlock {
    function deposit() external payable;

    function borrow(uint256 borrowAmountInCurrency) external;

    function withdraw(uint256 ethAmount) external;
}

contract SameBlockClient {
    IYamatoSameBlock y;

    constructor(address _yamato) {
        y = IYamatoSameBlock(_yamato);
    }

    function depositAndBorrow(uint256 borrowAmountInCurrency) public payable {
        y.deposit{value: msg.value}();
        y.borrow(borrowAmountInCurrency);
    }

    function borrowAndWithdraw(
        uint256 borrowAmountInCurrency,
        uint256 ethAmount
    ) public {
        y.borrow(borrowAmountInCurrency);
        y.withdraw(ethAmount);
    }

    function depositAndWithdraw(uint256 ethAmount) public payable {
        y.deposit{value: msg.value}();
        y.withdraw(ethAmount);
    }

    function depositAndBorrowAndWithdraw(
        uint256 borrowAmountInCurrency,
        uint256 ethAmount
    ) public payable {
        y.deposit{value: msg.value}();
        y.borrow(borrowAmountInCurrency);
        y.withdraw(ethAmount);
    }

    function depositFromClient() public payable {
        y.deposit{value: msg.value}();
    }
}
