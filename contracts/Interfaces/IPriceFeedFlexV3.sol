// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeedFlexV3 {
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

    function getStatus() external view returns (Status);

    function ethPriceAggregatorInUSD()
        external
        view
        returns (address _ethPriceAggregatorInUSD);

    function jpyPriceAggregatorInUSD()
        external
        view
        returns (address _jpyPriceAggregatorInUSD);
}
