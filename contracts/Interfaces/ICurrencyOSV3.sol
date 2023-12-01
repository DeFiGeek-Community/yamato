pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
interface ICurrencyOSV3 {
    function mintCurrency(address to, uint256 amount) external;

    function burnCurrency(address to, uint256 amount) external;

    function priceFeed() external view returns (address);

    function feePool() external view returns (address);

    function currency() external view returns (address);

    function YMT() external view returns (address);

    function veYMT() external view returns (address);

    function ymtMinter() external view returns (address);

    function scoreWeightController() external view returns (address);
}
