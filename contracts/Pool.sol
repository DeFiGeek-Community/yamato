pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CjpyOS.sol";
import "hardhat/console.sol";

interface IPool {
    event RedemptionReserveDeposited();
    event RedemptionReserveUsed();
    event SweepReserveDeposited();
    event SweepReserveUsed();
    event ETHLocked();
    event ETHSent();
    event CJPYSent();

    function depositRedemptionReserve(uint256 amount) external;

    function useRedemptionReserve(uint256 amount) external;

    function depositSweepReserve(uint256 amount) external;

    function useSweepReserve(uint256 amount) external;

    function lockETH(uint256 amount) external;

    function sendETH(address recipient, uint256 amount) external;

    function sendCJPY(address recipient, uint256 amount) external;

    function redemptionReserve() external view returns (uint256);

    function sweepReserve() external view returns (uint256);

    function lockedCollateral() external view returns (uint256);

    function yamato() external view returns (IYamato);

    function feePool() external view returns (IFeePool);
}

contract Pool is IPool {
    IYamato public override yamato;
    IFeePool public override feePool;
    uint256 public override redemptionReserve; // Auto redemption pool a.k.a. (kinda) Stability Pool in Liquity
    uint256 public override sweepReserve; // Protocol Controlling Value (PCV) to remove Pledges(coll=0, debt>0)
    uint256 public override lockedCollateral; // All collateralized ETH

    constructor(address _yamato) {
        yamato = IYamato(_yamato);
        feePool = IFeePool(yamato.feePool());
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
        emit RedemptionReserveDeposited();
    }

    function useRedemptionReserve(uint256 amount) public override onlyYamato {
        redemptionReserve -= amount;
        emit RedemptionReserveUsed();
    }

    function depositSweepReserve(uint256 amount) public override onlyYamato {
        sweepReserve += amount;
        emit SweepReserveDeposited();
    }

    function useSweepReserve(uint256 amount) public override onlyYamato {
        sweepReserve -= amount;
        emit SweepReserveUsed();
    }

    function lockETH(uint256 amount) public override onlyYamato {
        lockedCollateral += amount;
        emit ETHLocked();
    }

    function sendETH(address recipient, uint256 amount)
        public
        override
        onlyYamato
    {
        require(
            lockedCollateral >= amount,
            "locked collateral must be more than sending amount."
        );
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "transfer failed");
        lockedCollateral -= amount;
        emit ETHSent();
    }

    function sendCJPY(address recipient, uint256 amount)
        public
        override
        onlyYamato
    {
        IERC20 _currency = IERC20(ICjpyOS(yamato.cjpyOS()).currency());
        _currency.transfer(recipient, amount);
        emit CJPYSent();
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
            address(feePool).balance,
            lockedCollateral
        );
    }
}
