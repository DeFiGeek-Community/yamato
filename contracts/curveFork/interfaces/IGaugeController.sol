// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IGaugeController {
    function gaugeTypes(address addr_) external view returns (uint256);

}