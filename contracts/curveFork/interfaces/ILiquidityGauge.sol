// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ILiquidityGauge {
    function userCheckpoint(address addr_) external returns (bool);

    function integrateFraction(address addr_) external view returns (uint256);

    function deposit(uint256 _value, address _addr) external;

    function withdraw(uint256 _value) external;
}
