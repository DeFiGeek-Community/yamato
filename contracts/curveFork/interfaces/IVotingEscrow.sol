// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IVotingEscrow {
    function getLastUserSlope(address addr_) external view returns (int128);

    function lockedEnd(address addr_) external view returns (uint256);

    function balanceOf(address addr_, uint256 t_)
        external
        view
        returns (uint256);

    //function balanceOf(address addr)external view returns (uint256);
    function totalSupply(uint256 t_) external view returns (uint256);

    function getUserPointEpoch(address _user)
        external
        view
        returns (uint256);

    function userPointHistoryTs(address _addr, uint256 _idx)
        external
        view
        returns (uint256);

}