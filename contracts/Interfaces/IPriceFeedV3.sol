// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeedV3 {
    /// @notice Mutable price getter.
    function fetchPrice() external returns (uint256);

    /// @notice Immutable price getter.
    function getPrice() external view returns (uint256);

    // The last good price seen from an oracle by Chainlink
    function lastGoodPrice() external view returns (uint256);
}
