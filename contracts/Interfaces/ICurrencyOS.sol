pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
interface ICurrencyOS {
    function mintCurrency(address to, uint256 amount) external;

    function burnCurrency(address to, uint256 amount) external;

    function priceFeed() external view returns (address);

    function feePool() external view returns (address);

    function currency() external view returns (address);

    function ymtOS() external view returns (address);

    function YMT() external view returns (address);

    function veYMT() external view returns (address);
}
