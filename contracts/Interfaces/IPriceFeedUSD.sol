// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeedUSD {
    enum Status {
        chainlinkWorking
    }

    struct ChainlinkResponse {
        uint80 roundId;
        int256 answer;
        uint256 timestamp;
        bool success;
        uint8 decimals;
    }

    function getStatus() external view returns (Status);

    function ethPriceAggregatorInUSD()
        external
        view
        returns (address _ethPriceAggregatorInUSD);

    /// @notice Mutable price getter.
    function fetchPrice() external returns (uint256);

    /// @notice Immutable price getter.
    function getPrice() external view returns (uint256);

    // The last good price seen from an oracle by Chainlink
    function lastGoodPrice() external view returns (uint256);
}
