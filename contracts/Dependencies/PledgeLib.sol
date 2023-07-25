pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "../Interfaces/IYamato.sol";
import "../PriceFeedV3.sol";

library PledgeLib {
    /// @notice Calculate ICR for the memory Pledge
    /// @dev (coll*priceInJpy)/debt, if debt==0 then return uint256-max ICR
    /// @param _pledge having coll and debt
    /// @param _feed Oracle data in decimal=18 padded uint
    /// @return _ICR in uint256
    function getICR(
        IYamato.Pledge memory _pledge,
        address _feed
    ) public view returns (uint256 _ICR) {
        require(_feed != address(0), "Feed is null address.");
        IPriceFeedV3 feed = IPriceFeedV3(_feed);

        uint256 _ethPriceInCurrency = feed.lastGoodPrice(); // dec18 // All Yamato funcs uses fetchPrice before hand and so you can use lastGoodPrice here.
        uint256 _coll = _pledge.coll; // dec18
        uint256 _debt = _pledge.debt; // dec18
        uint256 _collInCurrency = (_coll * _ethPriceInCurrency) / 1e18; // dec18 * dec18 / dec18 = dec18

        if (_coll == 0 && _debt == 0) {
            _ICR = 0;
        } else if (_coll > 0 && _debt == 0) {
            _ICR = 2 ** 256 - 1;
        } else {
            // Note: ICR is per-ten-k in Yamato
            _ICR = (10000 * _collInCurrency) / _debt;
        }
    }

    /// @notice Calculate ICR for the memory Pledge
    /// @dev It's cheaper than "getICR"
    /// @param _pledge having coll and debt
    /// @param _ethPriceInCurrency price in decimal=18 padded uint
    /// @return _ICR in uint256
    function getICRWithPrice(
        IYamato.Pledge memory _pledge,
        uint256 _ethPriceInCurrency
    ) public view returns (uint256 _ICR) {
        uint256 _debt = _pledge.debt; // dec18

        if (_debt != 0) {
            // Note: ICR is per-ten-k in Yamato
            _ICR =
                ((10000 * (_pledge.coll * _ethPriceInCurrency)) / 1e18) /
                _debt;
        } else {
            if (_pledge.coll > 0) {
                _ICR = 2 ** 256 - 1;
            } else {
                _ICR = 0;
            }
        }
    }

    /// @notice Copy the storage Pledge into memory
    /// @param _pledge having all Pledge struct params (coll, debt, isCreated, owner, priority)
    function toMem(
        IYamato.Pledge storage _pledge
    ) public view returns (IYamato.Pledge memory) {
        return
            IYamato.Pledge(
                _pledge.coll,
                _pledge.debt,
                _pledge.isCreated,
                _pledge.owner,
                _pledge.priority
            );
    }

    /// @notice Clone the memory Pledge into memory
    /// @param _pledge having all Pledge struct params (coll, debt, isCreated, owner, priority)
    function clone(
        IYamato.Pledge memory _pledge
    ) public view returns (IYamato.Pledge memory) {
        return
            IYamato.Pledge(
                _pledge.coll,
                _pledge.debt,
                _pledge.isCreated,
                _pledge.owner,
                _pledge.priority
            );
    }

    /// @notice Add debt for the memory Pledge
    /// @param _pledge having all Pledge struct params (coll, debt, isCreated, owner, priority)
    /// @param _adder is how much debt to add
    function addDebt(
        IYamato.Pledge memory _pledge,
        uint256 _adder
    ) public view returns (IYamato.Pledge memory) {
        return
            IYamato.Pledge(
                _pledge.coll,
                _pledge.debt += _adder,
                _pledge.isCreated,
                _pledge.owner,
                _pledge.priority
            );
    }

    /// @notice Sync the storage Pledge with the memory Pledge
    /// @param sPledge having all Pledge struct params (coll, debt, isCreated, owner, priority)
    /// @param _pledge having all Pledge struct params (coll, debt, isCreated, owner, priority)
    function sync(
        IYamato.Pledge storage sPledge,
        IYamato.Pledge memory _pledge
    ) public returns (IYamato.Pledge storage) {
        sPledge.coll = _pledge.coll;
        sPledge.debt = _pledge.debt;
        sPledge.isCreated = _pledge.isCreated;
        sPledge.owner = _pledge.owner;
        sPledge.priority = _pledge.priority;
        return sPledge;
    }

    /// @notice Assign one memory Pledge to the other memory Pledge
    /// @param mPledge is the Pledge that _pledge assigns to, & having all Pledge struct params (coll, debt, isCreated, owner, priority)
    /// @param _pledge is the Pledge that assigns to mPledge, & having all Pledge struct params (coll, debt, isCreated, owner, priority)
    function assign(
        IYamato.Pledge memory mPledge,
        IYamato.Pledge memory _pledge
    ) public returns (IYamato.Pledge memory) {
        mPledge.coll = _pledge.coll;
        mPledge.debt = _pledge.debt;
        mPledge.isCreated = _pledge.isCreated;
        mPledge.owner = _pledge.owner;
        mPledge.priority = _pledge.priority;
        return mPledge;
    }

    /// @notice Overwrite the memory Pledge with 0, false, and zero-address
    function nil(IYamato.Pledge memory) public returns (IYamato.Pledge memory) {
        return IYamato.Pledge(0, 0, false, address(0), 0);
    }

    /// @param _ICRpertenk IndividualCollateralRatio per 10k
    /// @dev Three linear fumula there are
    /// @return _FRpertenk Corresponding fee rate in uint256 per-ten-kilo unit
    function FR(uint256 _ICRpertenk) public view returns (uint256 _FRpertenk) {
        require(_ICRpertenk >= 13000, "ICR too low to get fee data.");
        // if (11000 <= _ICRpertenk && _ICRpertenk < 13000) {
        //     _FRpertenk = 2000 - ((_ICRpertenk - 11000) * 80) / 100;
        // } else
        if (_ICRpertenk < 15000) {
            _FRpertenk = 400 - ((_ICRpertenk - 13000) * 10) / 100;
        } else if (15000 <= _ICRpertenk && _ICRpertenk < 20000) {
            _FRpertenk = 200 - ((_ICRpertenk - 15000) * 2) / 100;
        } else if (20000 <= _ICRpertenk && _ICRpertenk < 50000) {
            _FRpertenk = 100 - ((_ICRpertenk - 20000) * 3) / 10 / 100;
        } else {
            _FRpertenk = 10;
        }
    }

    /**
     * @notice Calculate the max amount that can redeem from the Pledge with MCR & ICR
     * @param pledge is the target pledge that you would like to calculate the max amont
     * @param mcr = Minimum Collateral Ratio
     * @param icr = Individual Collateral Ratio
     * @dev collValuAfter/debtAfter = mcr/10000
            debtAfter = debtBefore - diff
            collValuAfter = collValuBefore - diff
            10000 * (diff - collValuBefore) = mcr * (diff - debtBefore)
            (mcr - 10000) * diff = mcr * debtBefore - 10000 * collValuBefore
            diff = (mcr * debtBefore - 10000 * collValuBefore) / (mcr - 10000) 
            diff =  (mcr - icrBefore) / (mcr - 10000) * debtBefore

            [ Appendix. ]
            Let k = (mcr - icrBefore) / (mcr - 10000)
            diff = k * debtBefore

            Given mcr = 13000, then
            k   = (13000 - icrBefore) / 3000
                = -0.00033333333icrBefore + 4.33333333333 [10000<icrBefore<13000, 0<k<1]
     */
    function cappedRedemptionAmount(
        IYamato.Pledge memory pledge,
        uint256 mcr,
        uint256 icr
    ) public view returns (uint256) {
        return (pledge.debt * (mcr - icr)) / (mcr - 10000);
    }

    /**
     * @notice Calculate the amount of redemption that will be redeemed
     * @param mcr = Minimum Collateral Ratio
     * @param icr = Individual Collateral Ratio
     * @param ethPriceInCurrency is the ETH price fetched from PriceFeed
     */
    function toBeRedeemed(
        IYamato.Pledge memory pledge,
        uint256 mcr,
        uint256 icr,
        uint256 ethPriceInCurrency
    ) public view returns (uint256 _result) {
        if (icr < 10000) {
            // coll-based value
            _result =
                (pledge.coll * ethPriceInCurrency) / // Note: getRedeemablesCap's under-MCR value is based on unfetched price
                1e18;
        } else if (10000 <= icr && icr < mcr) {
            // icr=130%-based value
            _result = cappedRedemptionAmount(pledge, mcr, icr);
        } else {
            _result = 0;
        }
    }
}
