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
    using SafeMath for uint256;

    /// @notice Calculate ICR for the memory Pledge
    /// @dev (coll*priceInJpy)/debt, if debt==0 then return uint256-max ICR
    /// @param _pledge having coll and debt
    /// @param _feed Oracle data in decimal=18 padded uint
    /// @return _ICR in uint256
    function getICR(IYamato.Pledge memory _pledge, address _feed)
        public
        returns (uint256 _ICR)
    {
        IPriceFeed feed = IPriceFeed(_feed);

        uint256 _jpyPerEth = feed.fetchPrice();
        uint256 _collInCjpy = _pledge.coll * _jpyPerEth;
        uint256 _coll = _pledge.coll;
        uint256 _debt = _pledge.debt;

        if (_coll == 0 && _debt == 0) {
            revert(
                "Arithmetic Error: Yamato doesn't define the ICR of coll=0 debt=0 pledge."
            );
        } else if (_debt == 0) {
            _ICR = 2**256 - 1;
        } else {
            // Note: ICR is per-ten-k in Yamato
            _ICR = (10000 * _collInCjpy) / _debt;
        }
    }

    function toMem(IYamato.Pledge storage _pledge)
        public
        view
        returns (IYamato.Pledge memory)
    {
        return
            IYamato.Pledge(
                _pledge.coll,
                _pledge.debt,
                _pledge.isCreated,
                _pledge.owner,
                _pledge.lastUpsertedTimeICRpertenk
            );
    }

    function addDebt(IYamato.Pledge memory _pledge, uint256 _adder)
        public
        view
        returns (IYamato.Pledge memory)
    {
        return
            IYamato.Pledge(
                _pledge.coll,
                _pledge.debt.add(_adder),
                _pledge.isCreated,
                _pledge.owner,
                _pledge.lastUpsertedTimeICRpertenk
            );
    }
}
