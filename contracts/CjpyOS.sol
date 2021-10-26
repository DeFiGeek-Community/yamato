pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./CurrencyOS.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Dependencies/SafeMath.sol";
import "hardhat/console.sol";

interface ICjpyOS {
    function mintCJPY(address to, uint256 amount) external;

    function burnCJPY(address to, uint256 amount) external;

    function feed() external view returns (address);

    function feePool() external view returns (address);

    function currency() external view returns (address);
}

contract CjpyOS is ICjpyOS, CurrencyOS {
    using SafeMath for uint256;

    /// @param cjpyAddr just an ERC20
    /// @param feedAddr ERC1967Proxy
    /// @param feePool ERC1967Proxy
    constructor(
        address cjpyAddr,
        address feedAddr,
        address feePool
    ) CurrencyOS(cjpyAddr, feedAddr, feePool) {}

    function mintCJPY(address to, uint256 amount) public override onlyYamato {
        _mintCurrency(to, amount);
    }

    function burnCJPY(address to, uint256 amount) public override onlyYamato {
        _burnCurrency(to, amount);
    }

    function feed() public view override returns (address) {
        return _feed;
    }

    function currency() public view override returns (address) {
        return address(_currency);
    }

    function feePool() public view override returns (address) {
        return _feePool;
    }
}
