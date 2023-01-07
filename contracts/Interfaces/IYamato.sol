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
    struct FlashLockData {
        uint256 lockedBlockHeight;
    }

    event Deposited(address indexed sender, uint256 ethAmount);
    event Borrowed(address indexed sender, uint256 currencyAmount, uint256 fee);
    event Repaid(address indexed sender, uint256 currencyAmount);
    event Withdrawn(address indexed sender, uint256 ethAmount);
    event Redeemed(
        address indexed sender,
        uint256 currencyAmount,
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
        uint256 currencyAmount,
        uint256 gasCompensationAmount,
        address[] pledgesOwner
    );

    function permitDeps(address _sender) external view returns (bool);

    function getPledge(address _owner) external view returns (Pledge memory);

    function checkFlashLock(
        address _owner
    ) external view returns (bool _isLocked);

    function setFlashLock(address _owner) external;

    function getStates()
        external
        view
        returns (uint256, uint256, uint8, uint8, uint8, uint8);

    function priceFeed() external view returns (address);

    function currencyOS() external view returns (address);

    function pool() external view returns (address);

    function priorityRegistry() external view returns (address);

    function depositor() external view returns (address);

    function borrower() external view returns (address);

    function repayer() external view returns (address);

    function withdrawer() external view returns (address);

    function redeemer() external view returns (address);

    function sweeper() external view returns (address);

    function setPledge(address _owner, Pledge memory _p) external;

    function setTotalColl(uint256 _totalColl) external;

    function setTotalDebt(uint256 _totalDebt) external;

    function MCR() external view returns (uint8);

    function GRR() external view returns (uint8);
}
