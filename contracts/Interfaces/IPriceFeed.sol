// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeed {
    function fetchPrice() external returns (uint256);

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
