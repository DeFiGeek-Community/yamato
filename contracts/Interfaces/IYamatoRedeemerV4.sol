pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./IYamato.sol";

interface IYamatoRedeemerV4 {
    // To avoid stack too deep error in the functions
    struct RunRedeemVars {
        uint256 ethPriceInCurrency;
        uint256 redeemStart;
        uint256 bearerBalance;
        uint256 currencyAmountStart;
        uint256 _reminder;
        address[] _pledgesOwner;
        uint256 _loopCount;
        uint8 _GRR;
        uint256 _mcrPercent;
        uint256 _nextICR;
        uint256 _nextout;
        uint256 _nextin;
        uint256 _toBeRedeemed;
        uint256 _count;
        uint256 _redeemingAmount;
        uint256 _maxCount;
        IYamato.Pledge[] _bulkedPledges;
    }
}
