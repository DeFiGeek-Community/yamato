// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ICRV {
    function mint(address to_, uint256 value_) external returns (bool);
}