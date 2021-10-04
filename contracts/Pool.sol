pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Interfaces/IYamato.sol";
import "hardhat/console.sol";

interface IPool {
    function depositRedemptionReserve(uint256 amount) external;

    function useRedemptionReserve(uint256 amount) external;

    function depositSweepReserve(uint256 amount) external;

    function useSweepReserve(uint256 amount) external;

    function accumulateDividendReserve(uint256 amount) external;

    function withdrawDividendReserve(uint256 amount) external;

    function lockETH(uint256 amount) external;

    function sendETH(address recipient, uint256 amount) external;

    function redemptionReserve() external view returns (uint256);

    function sweepReserve() external view returns (uint256);

    function dividendReserve() external view returns (uint256);

    function lockedCollateral() external view returns (uint256);

    function yamato() external view returns (IYamato);
}

contract Pool is IPool {
    IYamato public override yamato;
    uint256 public override redemptionReserve; // Auto redemption pool a.k.a. (kinda) Stability Pool in Liquity
    uint256 public override sweepReserve; // Protocol Controlling Value (PCV) to remove Pledges(coll=0, debt>0)
    uint256 public override dividendReserve; // All redeemed Pledges returns coll=ETH to here.
    uint256 public override lockedCollateral; // All collateralized ETH

    constructor(address _yamato) {
        yamato = IYamato(_yamato);
    }

    event Received(address, uint256);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    modifier onlyYamato() {
        require(msg.sender == address(yamato), "You are not Yamato contract.");
        _;
    }

    function depositRedemptionReserve(uint256 amount)
        public
        override
        onlyYamato
    {
        redemptionReserve += amount;
    }

    function useRedemptionReserve(uint256 amount) public override onlyYamato {
        redemptionReserve -= amount;
    }

    function depositSweepReserve(uint256 amount) public override onlyYamato {
        sweepReserve += amount;
    }

    function useSweepReserve(uint256 amount) public override onlyYamato {
        sweepReserve -= amount;
    }

    function accumulateDividendReserve(uint256 amount)
        public
        override
        onlyYamato
    {
        dividendReserve += amount;
    }

    function withdrawDividendReserve(uint256 amount)
        public
        override
        onlyYamato
    {
        dividendReserve -= amount;
    }

    function lockETH(uint256 amount) public override onlyYamato {
        lockedCollateral += amount;
    }

    function sendETH(address recipient, uint256 amount)
        public
        override
        onlyYamato
    {
        lockedCollateral -= amount;
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "transfer failed");
    }

    /// @notice Provide the data of public storage.
    function getStates()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            redemptionReserve,
            sweepReserve,
            dividendReserve,
            lockedCollateral
        );
    }
}
