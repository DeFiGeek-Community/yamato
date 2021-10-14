pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "../Interfaces/IYamato.sol";
import "../PriceFeed.sol";
import "./SafeMath.sol";

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
        require(_feed != address(0), "Feed is null address.");
        IPriceFeed feed = IPriceFeed(_feed);

        uint256 _jpyPerEth = feed.lastGoodPrice(); // dec18
        uint256 _coll = _pledge.coll; // dec18
        uint256 _debt = _pledge.debt; // dec18
        uint256 _collInCjpy = (_coll * _jpyPerEth) / 1e18; // dec18 * dec18 / dec18 = dec18

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
                _pledge.priority
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
                _pledge.priority
            );
    }

    /// @param _ICRpertenk IndividualCollateralRatio per 10k
    /// @dev Three linear fumula there are
    /// @return _FRpertenk Corresponding fee rate in uint256 per-ten-kilo unit
    function FR(uint256 _ICRpertenk) public view returns (uint256 _FRpertenk) {
        require(_ICRpertenk >= 11000, "ICR too low to get fee data.");
        if (11000 <= _ICRpertenk && _ICRpertenk < 13000) {
            _FRpertenk = 2000 - ((_ICRpertenk - 11000) * 80) / 100;
        } else if (13000 <= _ICRpertenk && _ICRpertenk < 15000) {
            _FRpertenk = 400 - ((_ICRpertenk - 13000) * 10) / 100;
        } else if (15000 <= _ICRpertenk && _ICRpertenk < 20000) {
            _FRpertenk = 200 - ((_ICRpertenk - 15000) * 2) / 100;
        } else if (20000 <= _ICRpertenk && _ICRpertenk < 50000) {
            _FRpertenk = 100 - ((_ICRpertenk - 20000) * 3) / 10 / 100;
        } else {
            _FRpertenk = 10;
        }
    }
}
