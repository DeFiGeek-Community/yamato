pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IYamato {
    struct Pledge {
        uint256 coll;
        uint256 debt;
        bool isCreated;
        address owner;
        uint256 priority;
    }
    event Deposited(address indexed sender, uint256 ethAmount);
    event Borrowed(address indexed sender, uint256 cjpyAmount, uint256 fee);
    event Repaid(address indexed sender, uint256 cjpyAmount);
    event Withdrawn(address indexed sender, uint256 ethAmount);
    event Redeemed(
        address indexed sender,
        uint256 cjpyAmount,
        uint256 ethAmount,
        address[] indexed pledgesOwner
    );
    event RedeemedMeta(
        address indexed sender,
        uint256 price,
        bool isCoreRedemption,
        uint256 gasCompensationAmount
    );
    event Swept(
        address indexed sender,
        uint256 cjpyAmount,
        uint256 gasCompensationAmount,
        address[] pledgesOwner
    );

    function getPledge(address _owner) external view returns (Pledge memory);

    function feed() external view returns (address);

    function MCR() external view returns (uint8);
}
