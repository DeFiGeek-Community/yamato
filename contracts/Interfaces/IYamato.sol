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
        address[] pledgesOwner
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

    function withdrawLocks(address _owner) external view returns (uint256);

    function depositAndBorrowLocks(address _owner)
        external
        view
        returns (uint256);

    function getStates()
        external
        view
        returns (
            uint256,
            uint256,
            uint8,
            uint8,
            uint8,
            uint8
        );

    function yamatoHelper() external view returns (address);

    function feed() external view returns (address);

    function cjpyOS() external view returns (address);

    function setPledge(address _owner, Pledge memory _p) external;

    function setTotalColl(uint256 _totalColl) external;

    function setTotalDebt(uint256 _totalDebt) external;

    function MCR() external view returns (uint8);

    function GRR() external view returns (uint8);
}
