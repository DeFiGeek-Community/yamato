// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface ILiquidityGauge {
    function userCheckpoint(address addr_) external returns (bool);

    function integrateFraction(address addr_) external view returns (uint256);
}