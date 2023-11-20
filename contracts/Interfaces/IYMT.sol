pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IYMT {
    /**
     * @dev mint token for recipient. Assuming onlyGovernance
     */
    function mint(address to_, uint256 value_) external returns (bool);

    function decimals() external view returns (uint8);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function approve(address spender_, uint256 value_) external;

    function rate() external view returns (uint256);

    function futureEpochTimeWrite() external returns (uint256);
}
