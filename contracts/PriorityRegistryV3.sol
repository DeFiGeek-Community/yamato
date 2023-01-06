pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IPriorityRegistryV3.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";
import "hardhat/console.sol";

// @dev For gas saving reason, we use percent denominated ICR only in this contract.
contract PriorityRegistryV3 is IPriorityRegistryV3, YamatoStore {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge)) leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength;
    uint256 public override LICR; // Note: Lowest ICR in percent
    mapping(uint256 => FifoQueue) rankedQueue;

    function initialize(address _yamato) public initializer {
        __YamatoStore_init(_yamato);
    }

    /*
    ==============================
        Queue Managers
    ==============================
        - upsert
        - remove
    */

    /*
        @notice The upsert process is  1. update coll/debt in Yamato-side 2. floor the last ICR to make "level" 3. upsert and return the new "upsert-time ICR"  4. update padded-priority to the Yamato
        @dev It upserts "deposited", "borrowed", "repayed", "partially withdrawn", "redeemed", or "partially swept" pledges.
        @return _newICRpercent is for overwriting Yamato.sol's pledge info
    */
    function upsert(
        IYamato.Pledge memory _pledge
    ) public override onlyYamato returns (uint256) {
        uint256 _oldICRpercent = floor(_pledge.priority);

        require(
            !(_pledge.coll == 0 && _pledge.debt == 0 && _oldICRpercent != 0),
            "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
        );

        /*
            1. delete current pledge from sorted pledge and update LICR
        */
        if (
            !(_pledge.debt == 0 &&
                _oldICRpercent == 0) /* Exclude "new pledge" */ &&
            pledgeLength > 0 /* Avoid overflow */ &&
            leveledPledges[_oldICRpercent][_pledge.owner].isCreated
            /* whether delete target exists */
        ) {
            // TODO: 1st spec failing here
            _deletePledge(_pledge);
        }

        /* 
            2. insert new pledge
        */

        uint256 _newICRpercent = floor(_pledge.getICR(priceFeed()));

        require(
            _newICRpercent <= floor(2 ** 256 - 1),
            "priority can't be that big."
        );

        _pledge.priority = _newICRpercent * 100;

        leveledPledges[_newICRpercent][_pledge.owner] = _pledge;
        rankedQueuePush(_newICRpercent, _pledge);
        pledgeLength++;

        /*
            3. Update LICR for new ICR data
        */
        if (
            (_newICRpercent > 0 && _newICRpercent < LICR) ||
            LICR == 0 ||
            pledgeLength == 1
        ) {
            LICR = _newICRpercent;
        }

        /*  
            2-2. Traverse from min(oldICR,newICR) to fill the loss of popRedeemable
        */
        // Note: All deletions could cause traverse.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are validated, don't worry about gas.
        // Note: LICR is state variable and it will be undated here.
        uint256 _traverseStartICR;
        if (_oldICRpercent > 0 && _newICRpercent > 0) {
            _traverseStartICR = LiquityMath._min(
                _oldICRpercent,
                _newICRpercent
            );
        } else if (_oldICRpercent > 0) {
            _traverseStartICR = _oldICRpercent;
        } else if (_newICRpercent > 0) {
            _traverseStartICR = _newICRpercent;
        }

        if (_traverseStartICR > 0) _traverseToNextLICR(_traverseStartICR);

        return _newICRpercent * 100;
    }

    /*
        @dev It removes "just full swept" or "just full withdrawn" pledges.
    */
    function remove(IYamato.Pledge memory _pledge) public override onlyYamato {
        uint256 _oldICRpercent = floor(_pledge.priority);
        /*
            1. Delete a valid pledge
        */
        // Note: The original (in-Yamato.sol) pledge has to be zero
        require(
            _pledge.coll == 0,
            "Removal Error: coll has to be zero for removal."
        );
        require(
            _pledge.debt == 0,
            "Removal Error: debt has to be zero for removal."
        );

        // Note: In full withdrawal scenario, this value is MAX_UINT
        require(
            _oldICRpercent == 0 || _oldICRpercent == floor(2 ** 256 - 1),
            "Unintentional priority is given to the remove function."
        );

        _deletePledge(_pledge);
    }

    /*
    ==============================
        Mutable Getters
    ==============================
        - popRedeemable
        - popSweepable
    */

    /*
        @notice LICR-based lowest ICR pledge getter
        @dev Mutable read function. It pops.
        @return A pledge
    */
    function popRedeemable()
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory)
    {
        require(
            pledgeLength > 0,
            "pledgeLength=0 :: Need to upsert at least once."
        );
        require(LICR > 0, "licr=0 :: Need to upsert at least once.");
        require(
            rankedQueueLen(LICR) > 0,
            "The current lowest ICR data is inconsistent with actual sorted pledges."
        );

        IYamato.Pledge memory poppedPledge = rankedQueuePop(LICR);

        // Note: Don't check priority, real ICR is the matter. ICR13000 pledge breaks here.
        require(
            poppedPledge.getICR(priceFeed()) <
                uint256(IYamato(yamato()).MCR()) * 100,
            "You can't redeem if redeemable candidate is more than MCR."
        );

        // Note: pop is deletion. So traverse could be needed. But traversing is currently done by upsert.
        // Note: redeem() has popRedeemable() first then upsert next, hence traversing will be done.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are validated, don't worry about gas.
        // Note: LICR is state variable and it will be undated here.

        return poppedPledge;
    }

    /*
        @notice zero ICR pledge getter
        @return A pledge
    */
    function popSweepable()
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory)
    {
        return rankedQueuePop(0);
    }

    /*
    ==============================
        Fifo Managers (public, because of testability)
    ==============================
        - rankedQueuePush
        - rankedQueuePop
        - rankedQueueSearchAndDestroy
        - rankedQueueLen
        - rankedQueueTotalLen
    */
    function rankedQueuePush(
        uint256 _icr,
        IYamato.Pledge memory _pledge
    ) public override onlyYamato {
        rankedQueue[_icr].pledges.push(_pledge);
    }

    function rankedQueuePop(
        uint256 _icr
    ) public override onlyYamato returns (IYamato.Pledge memory _pledge) {
        FifoQueue storage fifoQueue = rankedQueue[_icr];

        uint256 _nextout = fifoQueue.nextout;

        uint256 _nextin = rankedQueueTotalLen(_icr);

        require(
            rankedQueueLen(_icr) > 0,
            "Pop must not be done for empty queue"
        );
        require(_nextout < _nextin, "Can't pop outbound data.");
        while (!_pledge.isCreated && _nextout < _nextin) {
            _pledge = fifoQueue.pledges[_nextout];

            _nextout++;
        }

        require(_pledge.isCreated, "All queue were empty");
        delete fifoQueue.pledges[_nextout - 1];
        fifoQueue.nextout = _nextout;
    }

    function rankedQueueSearchAndDestroy(
        uint256 _icr,
        uint256 _i
    ) public override onlyYamato {
        FifoQueue storage rankedQueue = rankedQueue[_icr];
        require(
            rankedQueueLen(_icr) > 0,
            "Searched queue must have at least an item"
        );
        require(
            rankedQueue.nextout <= _i,
            "Search index must be more than next-out"
        );
        require(
            _i < rankedQueueTotalLen(_icr),
            "Search index must be less than the last index"
        );
        require(rankedQueue.pledges[_i].isCreated, "Delete target was null");

        delete rankedQueue.pledges[_i];
    }

    function rankedQueueLen(uint256 _icr) public view returns (uint256 count) {
        FifoQueue memory fifoQueue = rankedQueue[_icr];
        for (
            uint256 i = fifoQueue.nextout;
            i < rankedQueueTotalLen(_icr);
            i++
        ) {
            if (fifoQueue.pledges[i].isCreated) {
                count++;
            }
        }
    }

    function rankedQueueTotalLen(uint256 _icr) public view returns (uint256) {
        return rankedQueue[_icr].pledges.length;
    }

    function rankedQueueNextout(uint256 _icr) public view returns (uint256) {
        return rankedQueue[_icr].nextout;
    }

    /*
    ==============================
        Internal Function
    ==============================
        - _deletePledge
        - _traverseToNextLICR
    */
    /*
        @dev delete of "address[] storage" causes gap in the list.
             For reasonably gas-saved delete, you must swap target with tail then delete it.
        @param _pledge the delete target
    */
    function _deletePledge(IYamato.Pledge memory _pledge) internal {
        uint256 icr = floor(_pledge.priority);
        address _owner = _pledge.owner;
        uint256 _nextout = rankedQueue[icr].nextout;
        uint256 _nextin = rankedQueueTotalLen(icr);
        while (_nextout <= _nextin) {
            IYamato.Pledge memory targetPledge = getRankedQueue(icr, _nextout);

            if (targetPledge.owner == _owner) {
                rankedQueueSearchAndDestroy(icr, _nextout);
                break;
            }
            _nextout++;
        }
        pledgeLength -= 1;
    }

    function _traverseToNextLICR(uint256 _icr) internal {
        uint256 _mcr = uint256(IYamato(yamato()).MCR());

        bool infLoopish = pledgeLength ==
            rankedQueueLen(0) + rankedQueueLen(floor(2 ** 256 - 1));
        // Note: The _oldICRpercent == LICR now, and that former LICR-level has just been nullified. New licr is needed.

        if (
            rankedQueueLen(_icr) == 0 /* Confirm the level is nullified */ &&
            _icr == LICR /* Confirm the deleted ICR is lowest  */ &&
            pledgeLength > 1 /* Not to scan infinitely */ &&
            LICR != 0 /* If 1st take, leave it to the logic in the bottom */
        ) {
            if (infLoopish) {
                // Note: Okie you avoided inf loop but make sure you don't redeem ICR=MCR pledge
                LICR = _mcr - 1;
            } else {
                // TODO: Out-of-gas fail safe
                uint256 _next = _icr;
                while (rankedQueueLen(_next) == 0 /* this level is empty! */) {
                    _next++;
                } // Note: if exist or out-of-range, stop it and set that level as the LICR
                LICR = _next;
            }
        }
    }

    /*
    ==============================
        Getters
    ==============================
        - nextRedeemable
        - nextSweepable
        - getRankedQueue
        - getRedeemablesCap
        - getSweepablesCap
    */
    function nextRedeemable()
        public
        view
        override
        returns (IYamato.Pledge memory _poppingPledge)
    {
        if (
            rankedQueueLen(LICR) == 0 ||
            rankedQueueTotalLen(LICR) == 0 ||
            rankedQueueTotalLen(LICR) > rankedQueue[LICR].nextout
        ) {
            return IYamato.Pledge(0, 0, false, address(0), 0);
        }

        _poppingPledge = rankedQueue[LICR].pledges[rankedQueue[LICR].nextout];
    }

    function nextSweepable()
        public
        view
        override
        returns (IYamato.Pledge memory _poppingPledge)
    {
        if (rankedQueueLen(0) == 0) {
            return IYamato.Pledge(0, 0, false, address(0), 0);
        }
        _poppingPledge = rankedQueue[0].pledges[rankedQueue[0].nextout];
    }

    function getRankedQueue(
        uint256 icr,
        uint256 i
    ) public view override returns (IYamato.Pledge memory) {
        uint256 _mcr = uint256(IYamato(yamato()).MCR());
        IYamato.Pledge memory zeroPledge = IYamato.Pledge(
            0,
            0,
            false,
            address(0),
            0
        );

        if (icr == _mcr && icr == LICR && rankedQueueLen(icr) == 0) {
            return zeroPledge;
        }

        if (rankedQueueTotalLen(icr) == 0) {
            return zeroPledge;
        }

        if (rankedQueueTotalLen(icr) - 1 >= i) {
            return rankedQueue[icr].pledges[i];
        } else {
            return zeroPledge;
        }
    }

    function getRedeemablesCap() external view returns (uint256 _cap) {
        uint256 mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 ethPriceInCurrency = IPriceFeed(priceFeed()).lastGoodPrice();

        uint256 _rank = 1;
        uint256 _nextout = rankedQueueNextout(_rank);
        IYamato.Pledge memory _pledge;
        while (true) {
            if (rankedQueueLen(_rank) > 0) {
                _pledge = getRankedQueue(_rank, _nextout);
                uint256 _icr = _pledge.getICR(priceFeed());
                if (_icr > 13000) {
                    return _cap; // end
                } else {
                    // to next index
                    _nextout++;
                    if (_nextout < rankedQueueTotalLen(_rank)) {
                        // icr check and cap addition
                        if (_icr >= 10000) {
                            // icr=130%-based value
                            _cap += _pledge.cappedRedemptionAmount(
                                mcrPercent * 100,
                                _icr
                            );
                        } else {
                            // coll-based value
                            _cap += (_pledge.coll * ethPriceInCurrency) / 1e18;
                        }
                    } else {
                        // index outbounded
                        _rank++; // to next rank
                        _nextout = rankedQueueNextout(_rank); // default index
                        break;
                    }
                }
            } else {
                _rank++;
            }
        }
    }

    function getSweepablesCap() external view returns (uint256 _cap) {
        IYamato.Pledge memory _pledge;
        uint256 _nextout = rankedQueue[0].nextout;
        uint256 _nextin = rankedQueueTotalLen(0);
        while (_nextout <= _nextin) {
            _pledge = getRankedQueue(0, _nextout);
            if (_pledge.isCreated) {
                _cap += _pledge.debt;
            }
            _nextout++;
        }
    }

    function floor(uint256 _ICRpertenk) internal returns (uint256) {
        return _ICRpertenk / 100;
    }

    /*
        ====================
            Upgrade Helpers
        ====================
        - syncRankedQueue
    */
    function syncRankedQueue(
        IYamato.Pledge[] calldata pledges
    ) public onlyGovernance {
        for (uint256 i = 0; i < pledges.length; i++) {
            this.upsert(pledges[i]);
        }
    }
}
