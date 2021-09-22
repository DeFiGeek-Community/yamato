pragma solidity 0.7.6;
pragma abicoder v2;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "../Yamato.sol";
import "../PriceFeed.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


library PledgeLib {
    using SafeMath for uint;

    /// @notice Calculate ICR for the memory Pledge
    /// @dev (coll*priceInJpy)/debt, if debt==0 then return uint256-max ICR
    /// @param _pledge having coll and debt
    /// @param _feed Oracle data in decimal=18 padded uint
    /// @return ICR in uint256
    function getICR(IYamato.Pledge memory _pledge, address _feed) public returns (uint ICR) {
        IPriceFeed feed = IPriceFeed(_feed);

        uint jpyPerEth = feed.fetchPrice();
        uint collInCjpy = _pledge.coll * jpyPerEth;
        uint debt = _pledge.debt;

        if(debt == 0){
            ICR = 2**256 - 1;
        } else {
            ICR = 100 * collInCjpy / debt;
        }
    }


    function toMem(IYamato.Pledge storage _pledge) public view returns (IYamato.Pledge memory) {
        return IYamato.Pledge(_pledge.coll, _pledge.debt, _pledge.isCreated, _pledge.owner, _pledge.lastUpsertedTimeICRpertenk);
    }

    function addDebt(IYamato.Pledge memory _pledge, uint _adder) public view returns (IYamato.Pledge memory) {
        return IYamato.Pledge(_pledge.coll, _pledge.debt.add(_adder), _pledge.isCreated, _pledge.owner, _pledge.lastUpsertedTimeICRpertenk);
    }



}