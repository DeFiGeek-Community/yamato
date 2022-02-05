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
import "./Interfaces/IPriorityRegistryV6.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";
import "hardhat/console.sol";

// @dev For gas saving reason, we use percent denominated ICR only in this contract.
contract PriorityRegistryV6 is IPriorityRegistryV6, YamatoStore {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge)) leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength;
    uint256 public override LICR; // Note: Lowest ICR in percent
    mapping(uint256 => FifoQueue) rankedQueue;
    uint256 constant CHECKPOINT_BUFFER = 55;
    uint256 public nextResetRank;
    mapping(address => DeleteDictItem) deleteDict;

    function initialize(address _yamato) public initializer {
        __YamatoStore_init(_yamato);
    }

    /*
    ==============================
        Queue Managers
    ==============================
        - upsert
        - bulkUpsert
        - remove
    */

    /*
        @notice The upsert process is  1. update coll/debt in Yamato-side 2. floor the last ICR to make "level" 3. upsert and return the new "upsert-time ICR"  4. update padded-priority to the Yamato
        @dev It upserts "deposited", "borrowed", "repayed", "partially withdrawn", "redeemed", or "partially swept" pledges.
        @return _newICRpercent is for overwriting Yamato.sol's pledge info
    */
    function upsert(IYamato.Pledge memory _pledge)
        public
        override
        onlyYamato
        returns (uint256)
    {
        IYamato.Pledge[] memory _pledges = new IYamato.Pledge[](1);
        _pledges[0] = _pledge;
        uint256[] memory priorities = bulkUpsert(_pledges);
        return priorities[0];
    }

    /*
        @notice upsert for several pledges without LICR update and traverse
        @return new ICRs in percent
    */
    function bulkUpsert(IYamato.Pledge[] memory _pledges)
        public
        override
        onlyYamato
        returns (uint256[] memory)
    {
        uint256 _deleteCount;
        uint256 _addCount;
        uint256[] memory _newPriorities = new uint256[](_pledges.length);
        for (uint256 i; i < _pledges.length; i++) {
            IYamato.Pledge memory _pledge = _pledges[i];
            if (_pledge.isCreated == false) {
                continue;
            }

            uint256 _oldICRpercent = floor(_pledge.priority);

            require(
                !(_pledge.coll == 0 &&
                    _pledge.debt == 0 &&
                    _oldICRpercent != 0),
                "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
            );

            /*
                1. delete current pledge from sorted pledge and update LICR
            */
            if (
                !(_pledge.debt == 0 && _oldICRpercent == 0) && pledgeLength > 0 /* Exclude "new pledge" */ /* Avoid underflow */
            ) {
                _deletePledge(_pledge);
                _deleteCount++;
            }

            /* 
                2. insert new pledge
            */

            uint256 _newICRPertenk = _pledge.getICR(feed());
            uint256 _newICRpercent = floor(_newICRPertenk);

            require(
                _newICRpercent <= floor(2**256 - 1),
                "priority can't be that big."
            );

            _pledge.priority = _newICRPertenk;

            rankedQueuePush(_newICRpercent, _pledge);
            _addCount++;

            _newPriorities[i] = _newICRPertenk;
        }

        /*
            length update
        */
        pledgeLength = pledgeLength + _addCount - _deleteCount;

        /*
            LICR update or traverse
        */
        // Note: All deletions could cause traverse.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are checked, don't worry about gas cost explosion.
        /*
            LICR determination algo for bulkUpsert
                - The first pledge is ICR-lowest pledge
                - Check the len of the rank
                - If empty, start traversing from that rank.
        */
        uint256 _licrCandidate = _detectLowestICR(_pledges[0].getICR(feed()), floor(_pledges[0].priority), LICR);
        if (rankedQueueLen(_licrCandidate) == 0) {
            _traverseToNextLICR(_licrCandidate);
        }

        return _newPriorities;
    }
    function _detectLowestICR(uint256 _newICRpercent, uint256 _oldICRpercent, uint256 _licr) internal pure returns (uint256 _newLowestICR) {
        if (_oldICRpercent > 0 && _newICRpercent > 0) {
            _newLowestICR = LiquityMath._min(
                _oldICRpercent,
                _newICRpercent
            );
        } else if (_oldICRpercent > 0) {
            _newLowestICR = _oldICRpercent;
        } else if (_newICRpercent > 0) {
            _newLowestICR = _newICRpercent;
        }
        if (_licr > 0) {
            _newLowestICR = LiquityMath._min(_newLowestICR, _licr);
        }
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
            _oldICRpercent == 0 || _oldICRpercent == floor(2**256 - 1),
            "Unintentional priority is given to the remove function."
        );

        _deletePledge(_pledge);
        pledgeLength--;

        /*
            Reset deleteDict to make pledge fresh.
        */
        DeleteDictItem memory _d;
        deleteDict[_pledge.owner] = _d;
    }

    /*
    ==============================
        Mutable Getters
    ==============================
        - popRedeemable
        - popSweepable
    */

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
    function rankedQueuePush(uint256 _icr, IYamato.Pledge memory _pledge)
        public
        override
        onlyYamato
    {
        FifoQueue storage fifoQueue = rankedQueue[_icr];
        deleteDict[_pledge.owner] = DeleteDictItem(
            true,
            fifoQueue.pledges.length
        );
        fifoQueue.pledges.push(_pledge);
    }

    function rankedQueuePop(uint256 _icr)
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory _pledge)
    {
        FifoQueue storage fifoQueue = rankedQueue[_icr];

        uint256 _nextout = fifoQueue.nextout;

        uint256 _nextin = rankedQueueTotalLen(_icr);

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

    function rankedQueueSearchAndDestroy(uint256 _icr, uint256 _i)
        public
        override
        onlyYamato
    {
        FifoQueue storage fifoQueue = rankedQueue[_icr];
        delete fifoQueue.pledges[_i];
    }

    function rankedQueueLen(uint256 _icr) public view returns (uint256 count) {
        FifoQueue storage fifoQueue = rankedQueue[_icr];
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

    function rankedQueueTotalLen(uint256 _icr)
        public
        view
        override
        returns (uint256)
    {
        return rankedQueue[_icr].pledges.length;
    }

    function rankedQueueNextout(uint256 _icr)
        public
        view
        override
        returns (uint256)
    {
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
             deleteDict knows which pledge is in which index.
        @param _pledge the delete target
    */
    function _deletePledge(IYamato.Pledge memory _pledge) internal {
        uint256 _icr = floor(_pledge.priority);
        DeleteDictItem memory _item = deleteDict[_pledge.owner];
        if (
            _item.isCreated /* To distinguish isCreated=true and index=0 */
        ) {
            rankedQueueSearchAndDestroy(_icr, _item.index);
        }
    }

    function _traverseToNextLICR(uint256 _icr) internal {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent + CHECKPOINT_BUFFER; // 185*0.7=130 ... It's possible to be "priority=184 but deficit" with 30% dump, but "priority=20000 but deficit" is impossible.
        uint256 _reminder = pledgeLength -
            (rankedQueueLen(0) + rankedQueueLen(floor(2**256 - 1)));
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
    function getRankedQueue(uint256 _icr, uint256 i)
        public
        view
        override
        returns (IYamato.Pledge memory)
    {
        if (i < rankedQueueTotalLen(_icr)) {
          return rankedQueue[_icr].pledges[i];
        }
    }

    function getRedeemablesCap() external view returns (uint256 _cap) {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent + CHECKPOINT_BUFFER;
        uint256 ethPriceInCurrency = IPriceFeed(feed()).lastGoodPrice();

        uint256 _rank = 1;
        uint256 _nextout = rankedQueueNextout(_rank);
        uint256 _count = pledgeLength -
            (rankedQueueLen(0) + rankedQueueLen(floor(2**256 - 1)));
        IYamato.Pledge memory _pledge = getRankedQueue(_rank, _nextout);
        uint256 _icr = _pledge.getICR(feed());
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
                    if (
                        _pledge.isCreated /* to skip gap */
                    ) {
                        // icr check and cap addition
                        _cap += _pledge.toBeRedeemed(
                            _mcrPercent * 100,
                            _icr,
                            ethPriceInCurrency
                        );
                        _count--;
                    }
                    _nextout++; // to next index
                } else {
                    _rank++; // to next rank
                    _nextout = rankedQueueNextout(_rank); // default index
                }
            }
            _pledge = getRankedQueue(_rank, _nextout);
            _icr = _pledge.getICR(feed());
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
        while (rankedQueue[floor(2**256 - 1)].pledges.length > 0) {
            rankedQueue[floor(2**256 - 1)].pledges.pop();
        }
        for (uint256 i = nextResetRank; i <= floor(2**256 - 1); i++) {
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

    function syncRankedQueue(IYamato.Pledge[] calldata pledges)
        public
        onlyGovernance
    {
        for (uint256 i = 0; i < pledges.length; i++) {
            this.upsert(pledges[i]);
        }

        pledgeLength = pledges.length;
    }



    /******************************
        !!! Deprecated !!!
    ******************************/
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
        return rankedQueuePop(LICR);
    }
}
