pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IYmtOS {
    function initialize(address _YMT, address _veYMT) external;

    function addYamatoOfCurrencyOS(address _yamatoAddr) external;

    function vote(address _currencyOS, address _yamato) external;

    function YMT() external view returns (address _YMT);

    function veYMT() external view returns (address _veYMT);
}
