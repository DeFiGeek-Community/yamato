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
import "./Interfaces/IPriorityRegistryV4.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";
import "hardhat/console.sol";

// @dev For gas saving reason, we use percent denominated ICR only in this contract.
contract PriorityRegistryV5 is IPriorityRegistryV4, YamatoStore {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge)) leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength;
    uint256 public override LICR; // Note: Lowest ICR in percent
    mapping(uint256 => FifoQueue) rankedQueue;
    uint256 constant CHECKPOINT_BUFFER = 55;
    uint256 public nextResetRank;

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
            !(_pledge.debt == 0 && _oldICRpercent == 0) &&
            pledgeLength > 0 /* Exclude "new pledge" */ /* Avoid underflow */
        ) {
            _deletePledge(_pledge);
            pledgeLength--;
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

        rankedQueuePush(_newICRpercent, _pledge);
        pledgeLength++;

        /*
            3. Update LICR for new ICR data
        */
        if (
            (_newICRpercent > 0 && _newICRpercent < LICR) || LICR == 0 // newer low // initial upsert
        ) {
            LICR = _newICRpercent;
        }

        /*  
            2-2. Traverse from min(oldICR,newICR) to fill the loss of popRedeemable
        */
        // Note: All deletions could cause traverse.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are checked, don't worry about gas cost explosion.
        // Note: The lowest of oldICR, newICR, or lowestICR are to be the target. If targeted rankedQueue is empty, go upstair and update LICR.
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

        if (LICR > 0) {
            _traverseStartICR = LiquityMath._min(_traverseStartICR, LICR);
            if (rankedQueueLen(_traverseStartICR) == 0)
                _traverseToNextLICR(_traverseStartICR);
        }

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
        pledgeLength--;
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
        @dev Mutable read function. It doesn't change pledgeLength until upsert runs.
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
        uint256 _mcr = uint256(IYamato(yamato()).MCR()) * 100;

        /*
            Dry pop inb4 real pop
        */
        IYamato.Pledge memory poppablePledge = getRankedQueue(
            LICR,
            rankedQueueNextout(LICR)
        );
        IYamato.Pledge memory poppedPledge;
        uint256 _icr = poppablePledge.getICR(priceFeed());

        /*
            Overrun redemption; otherwise, naive redemption
        */
        // Note: "ICR = MCR = Priority" then go to "MCR+1" rank
        // Note: Tolerant against 30% dump + mass redemption
        if (_icr == _mcr && _icr == poppablePledge.priority) {
            for (uint256 i = 1; i < CHECKPOINT_BUFFER; i++) {
                if (!poppedPledge.isCreated) {
                    poppedPledge = rankedQueuePop(floor(_mcr) + i);
                }
            }
            require(
                poppedPledge.isCreated,
                "Nothing were redeemable until the checkpoint priority."
            );
        } else {
            poppedPledge = rankedQueuePop(LICR);
        }

        // Note: priority can be more than MCR, real ICR is the matter. ICR13000 pledge breaks here.
        require(
            poppedPledge.getICR(priceFeed()) < _mcr,
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
        @dev It doesn't change pledgeLength until remove runs.
        @return A pledge
    */
    function popSweepable()
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory _poppedPledge)
    {
        _poppedPledge = rankedQueuePop(0);
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
        if (_nextout < _nextin) {
            while (!_pledge.isCreated && _nextout < _nextin) {
                _pledge = fifoQueue.pledges[_nextout];

                _nextout++;
            }

            if (_pledge.isCreated) {
                delete fifoQueue.pledges[_nextout - 1];
                fifoQueue.nextout = _nextout;
            }
        }
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
    }

    function _traverseToNextLICR(uint256 _icr) internal {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent + CHECKPOINT_BUFFER; // 185*0.7=130 ... It's possible to be "priority=184 but deficit" with 30% dump, but "priority=20000 but deficit" is impossible.
        uint256 _reminder = pledgeLength -
            (rankedQueueLen(0) + rankedQueueLen(floor(2 ** 256 - 1)));
        if (_reminder > 0) {
            uint256 _next = _icr;
            while (true) {
                if (rankedQueueLen(_next) != 0) {
                    LICR = _next; // the first filled rankedQueue
                    break;
                } else if (_next >= _checkpoint) {
                    LICR = _checkpoint - 1; // default LICR
                    break;
                } else {
                    _next++;
                }
            }
        } else {
            LICR = _checkpoint - 1; // default LICR is 184 because every upsert calls traverse but not waste gas
        }
    }

    /*
    ==============================
        Getters
    ==============================
        - getRankedQueue
        - getRedeemablesCap
        - getSweepablesCap
    */
    function getRankedQueue(
        uint256 icr,
        uint256 i
    ) public view override returns (IYamato.Pledge memory) {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        IYamato.Pledge memory zeroPledge = IYamato.Pledge(
            0,
            0,
            false,
            address(0),
            0
        );

        if (icr == _mcrPercent && icr == LICR && rankedQueueLen(icr) == 0) {
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
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent + CHECKPOINT_BUFFER;
        uint256 ethPriceInCurrency = IPriceFeed(priceFeed()).lastGoodPrice();

        uint256 _rank = 1;
        uint256 _nextout = rankedQueueNextout(_rank);
        uint256 _count = pledgeLength -
            (rankedQueueLen(0) + rankedQueueLen(floor(2 ** 256 - 1)));
        IYamato.Pledge memory _pledge = getRankedQueue(_rank, _nextout);
        uint256 _icr = _pledge.getICR(priceFeed());
        while (true) {
            if (
                _icr > _mcrPercent * 100 || _count == 0 || _rank >= _checkpoint
            ) {
                return _cap; // end
            } else {
                if (
                    rankedQueueLen(_rank) > 0 &&
                    (_nextout < rankedQueueTotalLen(_rank)) /* in range */
                ) {
                    if (_pledge.isCreated /* to skip gap */) {
                        // icr check and cap addition
                        if (_icr >= 10000) {
                            // icr=130%-based value
                            _cap += _pledge.cappedRedemptionAmount(
                                _mcrPercent * 100,
                                _icr
                            );
                        } else {
                            // coll-based value
                            _cap +=
                                (_pledge.coll * ethPriceInCurrency) / // Note: getRedeemablesCap's under-MCR value is based on unfetched price
                                1e18;
                        }
                        _count--;
                    }
                    _nextout++; // to next index
                } else {
                    _rank++; // to next rank
                    _nextout = rankedQueueNextout(_rank); // default index
                }
            }
            _pledge = getRankedQueue(_rank, _nextout);
            _icr = _pledge.getICR(priceFeed());
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

    function floor(uint256 _ICRpertenk) internal pure returns (uint256) {
        return _ICRpertenk / 100;
    }

    /*
        ====================
            Upgrade Helpers
        ====================
        - resetQueue
        - syncRankedQueue
    */
    function resetQueue(uint256 _defaultRank) public onlyGovernance {
        if (_defaultRank != 0) {
            nextResetRank = _defaultRank;
        }
        /*
            Reset to avoid fragmented queue and redeem malfunction
        */
        while (rankedQueue[0].pledges.length > 0) {
            rankedQueue[0].pledges.pop();
        }
        while (rankedQueue[floor(2 ** 256 - 1)].pledges.length > 0) {
            rankedQueue[floor(2 ** 256 - 1)].pledges.pop();
        }
        for (uint256 i = nextResetRank; i <= floor(2 ** 256 - 1); i++) {
            if (i > nextResetRank && i % 500 == 0) {
                nextResetRank = i;
                return;
            }
            while (rankedQueue[i].pledges.length > 0) {
                rankedQueue[i].pledges.pop();
            }

            rankedQueue[i].nextout = 0;
        }
    }

    function syncRankedQueue(
        IYamato.Pledge[] calldata pledges
    ) public onlyGovernance {
        for (uint256 i = 0; i < pledges.length; i++) {
            this.upsert(pledges[i]);
        }

        pledgeLength = pledges.length;
    }
}
