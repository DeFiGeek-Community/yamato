pragma solidity 0.7.6;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";

interface IPool {
    function depositRedemptionReserve(uint amount) external;
    function useRedemptionReserve(uint amount) external;
    function depositSweepReserve(uint amount) external;
    function useSweepReserve(uint amount) external;
    function accumulateDividendReserve(uint amount) external;
    function withdrawDividendReserve(uint amount) external;
    function lockETH(uint amount) external;
    function sendETH(address recipient, uint amount) external;
    function redemptionReserve() external view returns (uint);
    function sweepReserve() external view returns (uint);
    function dividendReserve() external view returns (uint);
    function lockedCollateral() external view returns (uint);
}



contract Pool is IPool {
    // TODO: Distribute YMT like provideToSP() in the Liquity
    IYamato yamato = IYamato(address(0));
    uint public override redemptionReserve; // Auto redemption pool a.k.a. (kinda) Stability Pool in Liquity
    uint public override sweepReserve; // Protocol Controlling Value (PCV) to remove Pledges(coll=0, debt>0)
    uint public override dividendReserve; // All redeemed Pledges returns coll=ETH to here.
    uint public override lockedCollateral; // All collateralized ETH

    event Received(address, uint);
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    modifier onlyYamato(){
        require(msg.sender == address(yamato), "You are not Yamato contract.");
        _;
    }

    function depositRedemptionReserve(uint amount) public override onlyYamato {
        redemptionReserve += amount;
    }
    function useRedemptionReserve(uint amount) public override onlyYamato {
        redemptionReserve -= amount;
    }

    function depositSweepReserve(uint amount) public override onlyYamato {
        sweepReserve += amount;
    }
    function useSweepReserve(uint amount) public override onlyYamato {
        sweepReserve -= amount;
    }

    function accumulateDividendReserve(uint amount) public override onlyYamato  {
        dividendReserve += amount;
    }
    function withdrawDividendReserve(uint amount) public override onlyYamato {
        dividendReserve -= amount;
    }

    function lockETH(uint amount) public override onlyYamato {
        lockedCollateral += amount;
    }
    function sendETH(address recipient, uint amount) public override onlyYamato {
        lockedCollateral -= amount;
        (bool success,) = payable(recipient).call{value:amount}("");
        require(success, "transfer failed");
    }

    /// @notice Provide the data of public storage.
    function getStates() public view returns (uint, uint, uint, uint) {
        return (redemptionReserve, sweepReserve, dividendReserve, lockedCollateral);
    }
}
