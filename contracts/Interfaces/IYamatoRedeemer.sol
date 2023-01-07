pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./IYamato.sol";

interface IYamatoRedeemer {
    // To avoid stack too deep error in the functions
    struct RunRedeemArgs {
        address sender;
        uint256 wantToRedeemCurrencyAmount;
        bool isCoreRedemption;
    }
    struct RunRedeemVars {
        uint256 ethPriceInCurrency;
        uint256 redeemStart;
        uint256 bearerBalance;
        uint256 currencyAmountStart;
        uint256 _reminder;
        address[] _pledgesOwner;
        uint256 _loopCount;
        uint8 _GRR;
    }
    struct RedeemedArgs {
        uint256 totalRedeemedCurrencyAmount;
        uint256 totalRedeemedEthAmount;
        address[] _pledgesOwner;
        uint256 ethPriceInCurrency;
        uint256 gasCompensationInETH;
    }

    function redeemPledge(
        IYamato.Pledge memory sPledge,
        uint256 currencyAmount,
        uint256 ethPriceInCurrency
    ) external returns (IYamato.Pledge memory, uint256);

    function runRedeem(
        RunRedeemArgs memory
    ) external returns (RedeemedArgs memory);
}
