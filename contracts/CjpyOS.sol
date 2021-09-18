pragma solidity 0.7.6;
pragma abicoder v2;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./CurrencyOS.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

interface ICjpyOS {
    function mintCJPY(address to, uint amount) external;
    function burnCJPY(address to, uint amount) external;
    function feed() external view returns (address);
}

contract CjpyOS is CurrencyOS, ICjpyOS {
    using SafeMath for uint256;

    constructor(address cjpyAddr, address ymtAddr, address veYmtAddr, address feedAddr) CurrencyOS(cjpyAddr, ymtAddr, veYmtAddr, feedAddr) {
    }

    function mintCJPY(address to, uint amount) public onlyYamato override {
        _mintCurrency(to, amount);
    }
    function burnCJPY(address to, uint amount) public onlyYamato override {
        _burnCurrency(to, amount);
    }
    function feed() public view override returns (address) {
        return _feed;
    }

}