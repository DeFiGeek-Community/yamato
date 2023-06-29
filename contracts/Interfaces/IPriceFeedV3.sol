// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPriceFeedV3 {
    function fetchPrice() external returns (uint256);

    function getPrice() external view returns (uint256);

    function lastGoodPrice() external view returns (uint256);
}
