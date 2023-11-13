// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IMinter {
    function token() external view returns (address);

    function controller() external view returns (address);

    function minted(
        address user_,
        address gauge_
    ) external view returns (uint256);
}
