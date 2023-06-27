// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeedV3 {
    enum Status {
        chainlinkWorking
    }

    struct ChainlinkResponse {
        uint80 roundId;
        int256 answer;
        uint256 timestamp;
        bool success;
        uint8 decimals;
        int256 subAnswer;
        uint8 subDecimal;
        uint256 subTimestamp;
    }

    function fetchPrice() external returns (uint256);

    function getPrice() external view returns (uint256);

    function getStatus() external view returns (Status);

    function getIsAdjusted() external view returns (bool);

    function lastGoodPrice() external view returns (uint256);

    function ethPriceAggregatorInUSD()
        external
        view
        returns (address _ethPriceAggregatorInUSD);

    function jpyPriceAggregatorInUSD()
        external
        view
        returns (address _jpyPriceAggregatorInUSD);
}
