// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IGaugeController {
    function gaugeTypes(address addr_) external view returns (uint256);

    function votingEscrow() external view returns (address);

    function checkpointGauge(address addr) external;

    function addType(string memory name_, uint256 weight_) external;

    function addGauge(
        address addr_,
        int128 gaugeType_,
        uint256 weight_
    ) external;

    function gaugeRelativeWeight(
        address addr,
        uint256 time
    ) external view returns (uint256);
}
