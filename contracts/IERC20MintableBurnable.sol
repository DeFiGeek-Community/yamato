pragma solidity 0.7.6;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/


/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20MintableBurnable {
    /**
     * @dev mint token for recipient. Assuming onlyGovernance
     */
    function mint(address to, uint amount) external;
    /**
     * @dev burn token for recipient. Assuming onlyGovernance
     */
    function burnFrom(address account, uint amount) external;

    function transfer(address to, uint amount) external;
}