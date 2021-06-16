pragma solidity ^0.8.3;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Yamato
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 *
 * This Factory is a fork of Murray Software's deliverables.
 * And this entire project is including the fork of Hegic Protocol.
 * Hence the license is alinging to the GPL-3.0
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";

contract Pool is IPool {
    // TODO: Distribute YMT like provideToSP() in the Liquity
    IYamato yamato = address(0);
    uint public redemptionReserve; // Auto redemption pool a.k.a. (kinda) Stability Pool in Liquity
    uint public debtCancelReserve; // Protocol Controlling Value (PCV) to remove Pledges(coll=0, debt>0)
    uint public dividendReserve; // All redeemed Pledges returns coll=ETH to here.
    uint public lockedCollateral; // All collateralized ETH
    modifier onlyYamato(){
        require(msg.sender == address(yamato), "You are not Yamato contract.");
        _;
    }

    function depositRedemptionReserve(uint amount) public onlyYamato {
        redemptionReserve += amount;
    }
    function useRedemptionReserve(uint amount) public onlyYamato {
        redemptionReserve -= amount;
    }

    function depositDebtCancelReserve(uint amount) public onlyYamato {
        debtCancelReserve += amount;
    }
    function useDebtCancelReserve(uint amount) public onlyYamato {
        debtCancelReserve -= amount;
    }

    function accumulateDividendReserve(uint amount) public onlyYamato  {
        dividendReserve += amount;
    }
    function withdrawDividendReserve(uint amount) public onlyYamato {
        dividendReserve -= amount;
    }

    function lockETH(uint amount) public onlyYamato {
        lockedCollateral += amount;
    }
    function sendETH(address recipient, uint amount) public onlyYamato {
        lockedCollateral -= amount;
        (bool success,) = payable(recipient).call{value:amount}("");
        require(success, "transfer failed");
    }

}

interface IPool {
    
}