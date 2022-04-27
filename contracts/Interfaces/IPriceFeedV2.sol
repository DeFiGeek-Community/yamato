// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeedV2 {
    enum Status {
        chainlinkWorking,
        usingTellorChainlinkUntrusted,
        bothOraclesUntrusted,
        usingTellorChainlinkFrozen,
        usingChainlinkTellorUntrusted
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

    function tellorCaller() external view returns (address _tellorCaller);
}
