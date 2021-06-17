// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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